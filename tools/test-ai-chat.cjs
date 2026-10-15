/**
 * AI 领养匹配助手（/chat）端到端测试。
 *
 * 【test:live】会向线上写入数据，仅由委托方显式运行。
 * 对话请求会写入限频事件，并可能消耗真实模型额度。
 *
 * 覆盖：健康检查、CORS 预检、SSE 协议、流式是否真实、
 *       宠物档案是否读到、限频是否生效、异常输入是否被拦截。
 *
 * 用法：node tools/test-ai-chat.cjs
 *      AI_BASE=https://... node tools/test-ai-chat.cjs
 */
const BASE = process.env.AI_BASE || 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.ap-shanghai.app.tcloudbase.com/ai-stream';
const SITE_ORIGIN = 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.tcloudbaseapp.com';

let passed = 0;
let failed = 0;
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`✅ ${label}`);
  } else {
    failed += 1;
    console.log(`❌ ${label}${detail ? `\n     ${detail}` : ''}`);
  }
}

/** 读一条 SSE 流，记录每个事件的到达时刻与内容。 */
async function readSse(url, body) {
  const startedAt = Date.now();
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE_ORIGIN },
    body: JSON.stringify(body)
  });
  const contentType = response.headers.get('content-type') || '';
  const allowOrigin = response.headers.get('access-control-allow-origin') || '';
  if (!response.body) return { status: response.status, contentType, allowOrigin, events: [], arrivals: [], firstByteMs: null, totalMs: Date.now() - startedAt };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  const arrivals = [];
  let buffer = '';
  let firstByteMs = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const at = Date.now() - startedAt;
    if (firstByteMs === null) firstByteMs = at;
    arrivals.push(at);
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() || '';
    for (const part of parts) {
      const line = part.split('\n').find(l => l.startsWith('data:'));
      if (!line) continue;
      try {
        events.push(JSON.parse(line.slice(5).trim()));
      } catch {
        /* 忽略不完整行 */
      }
    }
  }
  return { status: response.status, contentType, allowOrigin, events, arrivals, firstByteMs, totalMs: Date.now() - startedAt };
}

(async () => {
  console.log(`目标：${BASE}\n`);

  console.log('--- 1. 健康检查 ---');
  const health = await (await fetch(`${BASE}/`)).json();
  check('服务可达且返回 ok', health?.ok === true, JSON.stringify(health));
  check('不泄露 API Key（只回显模式）', typeof health?.mockMode === 'boolean' && health.model !== undefined && !JSON.stringify(health).includes('sk-'), JSON.stringify(health));
  console.log(`     当前模式：${health?.mockMode ? 'mock（未配 DEEPSEEK_API_KEY）' : `真实模型 ${health.model}`}`);

  console.log('\n--- 2. CORS 预检（前端跨域必需）---');
  const preflight = await fetch(`${BASE}/chat`, { method: 'OPTIONS', headers: { Origin: SITE_ORIGIN } });
  check('预检返回 204', preflight.status === 204, `实际 ${preflight.status}`);
  check('允许本站来源', preflight.headers.get('access-control-allow-origin') === SITE_ORIGIN, preflight.headers.get('access-control-allow-origin'));

  console.log('\n--- 3. /chat 正常对话（SSE 流式）---');
  const chat = await readSse(`${BASE}/chat`, {
    messages: [{ role: 'user', content: '我和家人一起住，白天有人在家，有养猫经验，想找一只性格温和的狗狗。' }]
  });
  check('HTTP 200', chat.status === 200, `实际 ${chat.status}`);
  check('返回 text/event-stream', chat.contentType.includes('text/event-stream'), chat.contentType);
  check('带正确的 CORS 允许来源', chat.allowOrigin === SITE_ORIGIN, chat.allowOrigin);

  // 限频（同一 IP 10 分钟 15 次）会表现为一串莫名其妙的失败，
  // 容易让人误以为功能坏了。单独识别出来，给出明确提示。
  const rateError = chat.events.find(e => e.type === 'error' && /频繁/.test(e.message || ''));
  if (rateError) {
    console.log('\n⚠️  被限频拦下了，本次没有真正测到功能。');
    console.log('    限频规则：同一 IP 10 分钟内 15 次、每天 120 次。');
    console.log('    这不是功能故障 —— 等约 10 分钟再跑即可。');
    process.exit(2);
  }

  const meta = chat.events.find(e => e.type === 'meta');
  const deltas = chat.events.filter(e => e.type === 'delta');
  const done = chat.events.find(e => e.type === 'done');
  check('首个事件是 meta', chat.events[0]?.type === 'meta', JSON.stringify(chat.events[0]));
  check('meta 带 mock 标记', typeof meta?.mock === 'boolean', JSON.stringify(meta));
  // 接口契约变更说明：改造前 meta 里带 petCount（把全部档案塞进提示词的旧做法）。
  // 现在改为工具调用模式，首屏不再预载档案，因此改报「已加载多少个工具」；
  // 宠物数量由工具按需查询（见 tools/test-ai-tools.cjs）。
  // petCount 前端从未使用过，去掉不影响任何界面。
  check('meta 报告了已加载的工具数量', Number(meta?.tools) >= 5, JSON.stringify(meta));
  check('收到多个 delta 增量块（不是一整段）', deltas.length >= 5, `实际 ${deltas.length} 块`);
  check('以 done 事件正常结束', Boolean(done), JSON.stringify(chat.events.slice(-2)));
  check('没有 error 事件', !chat.events.some(e => e.type === 'error'), JSON.stringify(chat.events.find(e => e.type === 'error')));
  check('确实是流式（首字节远早于结束）', chat.firstByteMs !== null && chat.firstByteMs < chat.totalMs * 0.6, `首字节 ${chat.firstByteMs}ms / 总 ${chat.totalMs}ms`);

  const answer = deltas.map(d => d.text).join('');
  console.log(`     回复长度 ${answer.length} 字，前 80 字：${answer.slice(0, 80).replace(/\n/g, ' ')}`);
  check('回复内容非空', answer.length > 10, answer);

  console.log('\n--- 4. 异常输入被拦截 ---');
  const empty = await readSse(`${BASE}/chat`, { messages: [] });
  const emptyError = empty.events.find(e => e.type === 'error');
  check('空对话返回 error 事件', Boolean(emptyError), JSON.stringify(empty.events));
  check('错误信息对用户可读', /描述|情况|格式/.test(emptyError?.message || ''), emptyError?.message);

  const badRole = await readSse(`${BASE}/chat`, { messages: [{ role: 'assistant', content: '我先说话' }] });
  check('最后一条不是用户消息时被拦截', Boolean(badRole.events.find(e => e.type === 'error')), JSON.stringify(badRole.events));

  console.log('\n--- 5. 超长输入被截断（不报错、不放大）---');
  const huge = await readSse(`${BASE}/chat`, { messages: [{ role: 'user', content: '啊'.repeat(5000) }] });
  check('超长输入仍能正常返回', Boolean(huge.events.find(e => e.type === 'done')) && !huge.events.some(e => e.type === 'error'), JSON.stringify(huge.events.slice(0, 2)));

  console.log('\n--- 6. 隐私边界：回复中不应出现内部字段 ---');
  const allText = answer + JSON.stringify(chat.events);
  for (const forbidden of ['source_ip_hash', 'browser_token_hash', 'edit_token', 'internal_note', 'contact_normalized']) {
    check(`不含内部字段「${forbidden}」`, !allText.includes(forbidden), allText.slice(0, 200));
  }

  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  process.exit(failed ? 1 : 0);
})();
