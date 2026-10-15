/**
 * AI 流式代理（CloudBase HTTP 云函数）
 *
 * 为什么单独一个函数：SSE 流式响应只在 HTTP（Web）云函数上支持，
 * 现有 yard-api 是 Event 类型，通过网关只返回一次性 JSON。
 *
 * 路由（HTTP 访问服务会剥掉 `/ai-stream` 前缀，函数内看到的是 `/chat`）：
 *   GET  /            健康信息
 *   POST /chat        访客侧「AI 领养匹配助手」，SSE 流式返回
 *
 * 前端收到的 SSE 事件（每行 `data: {json}`）：
 *   {"type":"meta","mock":false,"petCount":6}
 *   {"type":"delta","text":"..."}          // 增量正文，前端累加即可
 *   {"type":"done"}                        // 正常结束
 *   {"type":"error","message":"..."}       // 出错（HTTP 仍是 200，因为流已开始）
 *
 * ── 安全设计（比赛技术文档可直接引用）──
 *   1. API Key 只从环境变量 DEEPSEEK_API_KEY 读取，**绝不下发前端**；
 *   2. 访客侧按 IP 限频（复用 rate_limit_events 表），防止刷爆额度；
 *   3. 请求体与消息长度都有硬上限；
 *   4. 只把「宠物公开档案」+「用户自己输入的内容」发给模型，
 *      **不发送任何申请人隐私数据**；
 *   5. 模型输出只当文本流回前端，**不执行其中任何指令**；
 *   6. 未配置 API Key 时进入 mock 模式，前端与演示不依赖外网与额度。
 */
const http = require('node:http');
const crypto = require('node:crypto');
const { createToolkit } = require('./tools');
const { createKnowledge } = require('./knowledge');
const { createVision, TOKENHUB_MULTIMODAL_URL, VL_MODEL, VL_DIMENSION } = require('./vision');

const PORT = Number(process.env.PORT) || 9000;
const DEEPSEEK_HOST = 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// ── 输入硬上限 ──────────────────────────────────────────────
const MAX_BODY_BYTES = 16 * 1024;
/** 以图搜宠要传 base64 图片，请求体上限单独放大（前端已把图压到 768px 以内）。 */
const MAX_PHOTO_BODY_BYTES = 1200 * 1024;
const MAX_MESSAGE_CHARS = 600;
const MAX_TURNS = 8;
const MAX_OUTPUT_TOKENS = 900;

// ── 限频（10 分钟窗口 + 24 小时日上限）──────────────────────
const RATE_KIND = 'ai_chat';
const RATE_WINDOW_MAX = 15;
const RATE_DAILY_MAX = 120;

// ── CORS ────────────────────────────────────────────────────
// ⚠️ 实测结论：CloudBase HTTP 访问服务**自带 CORS**——对本站域名会自动加上
// Access-Control-Allow-Origin 与 Allow-Credentials，对其他来源则一律不放行。
//
// 如果自己也写一遍 ACAO，两个值会被合并成 `origin,origin`，
// 浏览器判定为非法值而**拒绝整个请求**（这个坑真的踩到了）。
// 因此这里**不自行设置任何 CORS 响应头**，完全交给平台处理。
// 只保留 OPTIONS 分支，避免预检请求落到业务逻辑上。

function text(value, max = 1000) {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}
function hash(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  return forwarded || String(req.headers['x-real-ip'] || '') || '';
}

// ── 数据库：与 yard-api 相同的特权通道（ExecutePGSql）──────────
// 注意：函数内的 app.rdb() 以 anon 身份运行，读不到受限表，
// 因此这里沿用 yard-api 已验证的 OpenAPI 通道。
function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}
function tc3Date(timestamp) {
  const d = new Date(timestamp * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function hmacSha256(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest();
}
/**
 * 解析可用于 ExecutePGSql 的临时凭证。
 *
 * 与 yard-api 的做法一致，但这里**不依赖 @cloudbase/node-sdk**：
 * 云函数运行时本来就会把带角色的临时凭证注入成环境变量，直接读即可，
 * 少一个依赖也少一份部署负担。环境变量拿不到时再退回腾讯云元数据服务。
 */
async function resolveSecret() {
  const secretId = text(process.env.TENCENTCLOUD_SECRETID, 300);
  const secretKey = text(process.env.TENCENTCLOUD_SECRETKEY, 300);
  if (secretId && secretKey) {
    return { source: 'env', secretId, secretKey, sessionToken: text(process.env.TENCENTCLOUD_SESSIONTOKEN, 4000) };
  }

  const roleName = process.env.ROLE_NAME || 'TCB_QcsRole';
  try {
    const response = await fetch(`http://metadata.tencentyun.com/latest/meta-data/cam/security-credentials/${roleName}`, { signal: AbortSignal.timeout(1500) });
    if (response.ok) {
      const payload = await response.json();
      if (payload?.TmpSecretId && payload?.TmpSecretKey) {
        return { source: 'metadata', secretId: payload.TmpSecretId, secretKey: payload.TmpSecretKey, sessionToken: payload.Token || '' };
      }
    }
  } catch {
    /* 交给调用方统一报错 */
  }
  return null;
}
async function executePgSql(sql) {
  const credentials = await resolveSecret();
  const { secretId, secretKey, sessionToken } = credentials || {};
  const envId = process.env.TCB_ENV || process.env.SCF_NAMESPACE;
  if (!secretId || !secretKey || !envId) throw new Error('AI 服务暂不可用（凭据缺失）。');
  const service = 'tcb';
  const host = 'tcb.tencentcloudapi.com';
  const method = 'POST';
  const region = process.env.TENCENTCLOUD_REGION || process.env.TCB_REGION || 'ap-shanghai';
  const body = JSON.stringify({ EnvId: envId, Sql: sql });
  const timestamp = Math.floor(Date.now() / 1000);
  const date = tc3Date(timestamp);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = `${method}\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256Hex(body)}`;
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${date}/${service}/tc3_request\n${sha256Hex(canonicalRequest)}`;
  const kDate = hmacSha256(`TC3${secretKey}`, date);
  const kSigning = hmacSha256(hmacSha256(kDate, service), 'tc3_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  const headers = {
    Authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${date}/${service}/tc3_request, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'Content-Type': 'application/json',
    Host: host,
    'X-TC-Action': 'ExecutePGSql',
    'X-TC-Region': region,
    'X-TC-Timestamp': String(timestamp),
    'X-TC-Version': '2018-06-08'
  };
  if (sessionToken) headers['X-TC-Token'] = sessionToken;
  const response = await fetch(`https://${host}/`, { method, headers, body });
  const result = await response.json();
  if (!response.ok || result?.Response?.Error) {
    throw new Error(result?.Response?.Error?.Message || 'AI 服务暂不可用（数据库）。');
  }
  return result.Response;
}
function sqlResult(response) {
  if (!Array.isArray(response?.Rows) || !response.Rows.length) throw new Error('AI 服务暂不可用（无返回）。');
  const row = JSON.parse(response.Rows[0]);
  const value = Array.isArray(row) ? row[0] : row;
  return typeof value === 'string' ? JSON.parse(value) : value;
}

/** 工具层与知识层拿到的是"执行 SQL 并返回解析后 JSON"的能力，不关心底层通道。 */
const runSql = async sql => sqlResult(await executePgSql(sql));
const knowledge = createKnowledge({ query: runSql, embed: texts => embedTexts(texts) });
const toolkit = createToolkit({ query: runSql, knowledge });
const vision = createVision({ query: runSql, embedImage: input => embedImage(input) });

/** Agent 最多进行几轮工具调用。超过就强制收口，避免无限循环烧额度。 */
const MAX_TOOL_ROUNDS = 3;
/** 单条工具结果写回上下文时的长度上限，防止把上下文撑爆。 */
const MAX_TOOL_RESULT_CHARS = 8000;
/**
 * 正文缓冲阈值（字符）。
 *
 * 模型有时会在调用工具前先"自言自语"一句，而且常常是英文
 * （实测出现过 "I'll look into suitable cats and the adoption requirements"
 * 这类 60 多字的句子），直接流出去会混进最终回答里。
 *
 * 处理办法：**带工具的轮次里**正文先缓冲，只有超过这个长度才认为
 * "这是正文而不是开场白"，开始下发；较短的句子一旦这一轮出现工具调用就整体丢弃。
 * 阈值取 200 是因为实测的开场白都在 100 字以内，而真正的回答远超这个长度。
 */
const PREAMBLE_MAX_CHARS = 200;

/** 访客侧限频：同一 IP 在 10 分钟内过多、或当天过多，直接拒绝。 */
async function checkRateLimit(ip) {
  const key = `${RATE_KIND}:ip:${hash(ip || 'unknown')}`;
  const sql = `WITH recent AS (
      SELECT count(*) AS n FROM public.rate_limit_events
      WHERE event_kind = ${sqlLiteral(RATE_KIND)} AND key_hash = ${sqlLiteral(key)}
        AND created_at >= NOW() - INTERVAL '10 minutes'
    ), daily AS (
      SELECT count(*) AS n FROM public.rate_limit_events
      WHERE event_kind = ${sqlLiteral(RATE_KIND)} AND key_hash = ${sqlLiteral(key)}
        AND created_at >= NOW() - INTERVAL '24 hours'
    ), logged AS (
      INSERT INTO public.rate_limit_events (id, event_kind, key_hash, created_at)
      VALUES (${sqlLiteral(`ai_${crypto.randomUUID()}`)}, ${sqlLiteral(RATE_KIND)}, ${sqlLiteral(key)}, NOW())
      RETURNING 1
    )
    SELECT jsonb_build_object(
      'allowed', (SELECT n FROM recent) < ${RATE_WINDOW_MAX} AND (SELECT n FROM daily) < ${RATE_DAILY_MAX},
      'recent', (SELECT n FROM recent), 'daily', (SELECT n FROM daily)
    ) AS result FROM (SELECT count(*) FROM logged) AS _`;
  return sqlResult(await executePgSql(sql));
}

/**
 * 工具模式下的系统提示词。
 *
 * 与档案注入模式最大的区别：**不再把宠物档案塞进来**，
 * 而是告诉它有哪些工具、以及"先查再答"的纪律。
 * 这样档案涨到几百只也不会撑爆上下文。
 */
function buildToolSystemPrompt() {
  return `你是「成都猫狗小院」流浪动物领养平台的 AI 领养匹配助手。

你可以调用工具查询小院的真实数据。**凡涉及具体宠物、领养政策、回访情况，必须先查再答**，不要凭印象作答；工具说没有，就如实说没有，绝不编造。

你的任务：根据访客描述的自身情况（居住条件、作息、养宠经验、家人态度等），推荐 1-3 只最合适的宠物，并说明理由。

必须遵守：
1. 只推荐工具查到的、真实存在的宠物，用档案里的名字称呼；
2. 每推荐一只都要说明**为什么适合**，理由要能对应到档案里的具体条目；
3. **主动指出访客可能没考虑到的风险**：租房是否经房东同意、家人是否都同意、白天家中是否有人、封窗防护、经济与时间投入、现有宠物是否合得来；
4. 如果访客条件与宠物都不太匹配，如实说明并给改善建议，不要硬推；
5. 不替小院做任何承诺（不能说"一定能领养"），最终由小院与申请人沟通后决定；
6. **调用工具时不要输出任何文字**（包括英文的"我来查一下"），直接发起调用；
7. 语气亲切、简洁，用中文，不要 markdown 标题符号，不要输出 JSON；
8. 控制在 300 字以内。`;
}

/** 档案注入模式的系统提示词（降级路径用）。核心约束：只能用档案里的信息，不许编。 */
function buildCatalogPrompt(pets) {
  const catalog = pets
    .map(pet => {
      const lines = [
        `名称：${pet.name}（${pet.type}·${pet.gender}·${pet.age}）`,
        `领养状态：${pet.status}`,
        pet.tags.length ? `标签：${pet.tags.join('、')}` : '',
        pet.description ? `性格与情况：${pet.description}` : '',
        pet.health ? `健康情况：${pet.health}` : '',
        pet.requirements ? `领养要求：${pet.requirements}` : '',
        pet.pauseReason ? `暂不开放原因：${pet.pauseReason}` : ''
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n\n');

  return `你是「成都猫狗小院」流浪动物领养平台的 AI 领养匹配助手。

小院当前在册的宠物档案如下（这是你唯一可用的宠物信息来源）：
"""
${catalog}
"""

你的任务：根据访客描述的自身情况（居住条件、作息、养宠经验、家人态度等），从上面的档案里推荐 1-3 只最合适的宠物。

必须遵守：
1. **只能推荐档案里真实存在的宠物**，用档案里的名字称呼它们，绝不编造不存在的宠物或信息。
2. 每推荐一只，都要说明**为什么适合**，理由必须能对应到档案里的具体条目。
3. **主动指出访客可能没考虑到的风险**，例如：租房是否经房东同意、家人是否全部同意、白天家中是否有人、经济与时间投入、现有宠物是否合得来。
4. 如果访客的条件与所有宠物都不太匹配，要**如实说明**，并给出改善建议，不要硬推。
5. 不要替小院做任何承诺（不能承诺"一定能领养"），最终由小院与申请人沟通后决定。
6. 语气亲切、简洁，用中文，不要用 markdown 标题符号，不要输出 JSON。
7. 控制在 300 字以内。`;
}

/** 校验并规范化前端传来的对话历史。 */
function normalizeMessages(raw) {
  if (!Array.isArray(raw)) throw new Error('对话格式不正确。');
  const turns = raw
    .slice(-MAX_TURNS)
    .map(item => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: text(item?.content, MAX_MESSAGE_CHARS)
    }))
    .filter(item => item.content);
  if (!turns.length) throw new Error('请先描述一下你的情况。');
  if (turns[turns.length - 1].role !== 'user') throw new Error('最后一条消息需要来自访客。');
  return turns;
}

function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/** mock 模式：没配 API Key 时也能完整跑通前后端与演示。 */
async function streamMock(res, pets, messages) {
  const asked = messages[messages.length - 1].content;
  const candidates = pets.filter(pet => pet.status === '待领养').slice(0, 2);
  const pick = candidates[0] || pets[0];
  const body = pick
    ? `【当前为演示模式，未接入大模型】\n你提到「${text(asked, 60)}」。根据小院现有档案，我建议你先了解 ${pick.name}：${pick.age}的${pick.type}，${text(pick.description, 80) || '性格温和'}。它的领养要求是：${text(pick.requirements, 80) || '暂未特别注明'}。\n同时提醒你确认两件事：居住地是否允许养宠、家人是否全部同意。这两点没确认好，后续容易出现退养。`
    : '【当前为演示模式】小院目前还没有在册宠物档案，请稍后再来。';
  for (const chunk of body.match(/[\s\S]{1,12}/g) || []) {
    writeSse(res, { type: 'delta', text: chunk });
    await new Promise(resolve => setTimeout(resolve, 45));
  }
  writeSse(res, { type: 'done', mock: true });
  res.end();
}

/** 真实调用：把 DeepSeek 的 SSE 流转换成我们自己的精简协议。 */
async function streamDeepSeek(res, pets, messages, apiKey) {
  const upstream = await fetch(`${DEEPSEEK_HOST}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      stream: true,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.7,
      messages: [{ role: 'system', content: buildCatalogPrompt(pets) }, ...messages]
    })
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    // 只回传状态码与截断后的原因，避免把上游响应头等信息泄露给前端
    throw new Error(`AI 服务返回 ${upstream.status}${detail ? `：${text(detail, 120)}` : ''}`);
  }

  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of upstream.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) writeSse(res, { type: 'delta', text: delta });
      } catch {
        /* 上游偶发不完整行，跳过即可 */
      }
    }
  }
  writeSse(res, { type: 'done', mock: false });
  res.end();
}

/**
 * 把工具结果压缩成一行给页面看的人类可读说明。
 * 目的：让访客知道 AI「正在查什么、查到了什么」，而不是干等。
 */
function summarizeToolResult(name, result) {
  if (!result) return '';
  if (result.ok === false) return `失败：${text(result.message, 60)}`;
  switch (name) {
    case 'search_knowledge':
      return result.count ? `找到 ${result.count} 段相关资料` : '没有相关资料';
    case 'search_pets':
      return result.count ? `找到 ${result.count} 只` : '没有符合条件的';
    case 'get_pet_profile':
      return result.pet ? `读取「${text(result.pet.name, 20)}」的档案` : '未找到';
    case 'get_adoption_policy':
      return '读取领养政策';
    case 'get_follow_up_history':
      return result.hasHistory ? `${result.updates.length} 条回访记录` : `${text(result.petName, 20)}暂无回访记录`;
    case 'check_requirement_gaps':
      return result.missingCount ? `发现 ${result.missingCount} 项还没提到` : '常见要求都已提到';
    default:
      return '查询完成';
  }
}

/**
 * 发起一次流式补全，并把内容与工具调用一起收回来。
 *
 * 为什么用流式而不是"先非流式问一轮再流式答"：
 * 后者每次都要多打一次模型，延迟翻倍；流式聚合 tool_calls 的分片虽然多写一点代码，
 * 但正文能边生成边下发，访客不用干等。
 */
async function streamCompletion(res, convo, apiKey, { withTools }) {
  const upstream = await fetch(`${DEEPSEEK_HOST}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      stream: true,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.7,
      messages: convo,
      ...(withTools ? { tools: toolkit.definitions, tool_choice: 'auto' } : {})
    })
  });

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    const error = new Error(`AI 服务返回 ${upstream.status}${detail ? `：${text(detail, 160)}` : ''}`);
    error.upstreamStatus = upstream.status;
    error.upstreamDetail = detail;
    throw error;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let streamed = false;
  // 未下发的正文缓冲，用于挡掉"调工具前的自言自语"（见 PREAMBLE_MAX_CHARS）
  let pending = '';
  // 工具调用在流里是分片下发的：先给 id 与函数名，参数再一点点拼。按 index 归并。
  const toolCalls = [];

  for await (const chunk of upstream.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') continue;
      let parsed;
      try {
        parsed = JSON.parse(data);
      } catch {
        continue; // 上游偶发不完整行，跳过
      }
      const delta = parsed?.choices?.[0]?.delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
        if (!withTools || streamed) {
          // 不带工具的轮次（最终回答）直接流；
          // 带工具的轮次一旦开始下发，后续也继续流。
          streamed = true;
          writeSse(res, { type: 'delta', text: delta.content });
        } else {
          pending += delta.content;
          if (pending.length >= PREAMBLE_MAX_CHARS) {
            // 超过阈值，说明这是正文而非开场白，开始下发
            streamed = true;
            writeSse(res, { type: 'delta', text: pending });
            pending = '';
          }
        }
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const part of delta.tool_calls) {
          const index = Number(part.index) || 0;
          if (!toolCalls[index]) toolCalls[index] = { id: '', type: 'function', function: { name: '', arguments: '' } };
          if (part.id) toolCalls[index].id = part.id;
          if (part.function?.name) toolCalls[index].function.name += part.function.name;
          if (part.function?.arguments) toolCalls[index].function.arguments += part.function.arguments;
        }
      }
    }
  }

  const calls = toolCalls.filter(Boolean);
  // 这一轮没有工具调用 → 缓冲里的就是正文，补发出去（短回答可能一直没超过阈值）
  if (!calls.length && pending) {
    streamed = true;
    writeSse(res, { type: 'delta', text: pending });
  }
  // 有工具调用 → pending 是调工具前的自言自语，直接丢弃，不下发给访客

  return { content, toolCalls: calls, streamed };
}

/**
 * Agent 循环：模型自己决定查什么、查几次。
 *
 * 轮次上限 MAX_TOOL_ROUNDS，最后一轮**不再提供工具**，强制它基于已有信息收口作答，
 * 避免"查了又查"把额度烧光。
 */
async function runAgent(res, messages, apiKey) {
  const convo = [{ role: 'system', content: buildToolSystemPrompt() }, ...messages];
  for (let round = 1; round <= MAX_TOOL_ROUNDS; round += 1) {
    const withTools = round < MAX_TOOL_ROUNDS;
    const { content, toolCalls } = await streamCompletion(res, convo, apiKey, { withTools });
    if (!toolCalls.length) return; // 已直接作答并流式下发完毕

    convo.push({ role: 'assistant', content: content || null, tool_calls: toolCalls });
    for (const call of toolCalls) {
      const name = text(call.function?.name, 40);
      writeSse(res, { type: 'tool', name, status: 'running' });
      const result = await toolkit.execute(name, call.function?.arguments);
      writeSse(res, { type: 'tool', name, status: 'done', ok: result?.ok !== false, summary: summarizeToolResult(name, result) });
      // 检索到依据时单独发一条「来源」，前端在回答下方列出。
      // 不依赖模型自己引用——它可能忘了说，而"依据可查"是可解释性的硬要求。
      if (Array.isArray(result?.sources) && result.sources.length) {
        writeSse(res, { type: 'sources', items: result.sources.slice(0, 6) });
      }
      convo.push({
        role: 'tool',
        tool_call_id: text(call.id, 80) || `call_${round}`,
        content: JSON.stringify(result).slice(0, MAX_TOOL_RESULT_CHARS)
      });
    }
  }
}

/**
 * 带降级的对话入口。
 *
 * 工具调用不被上游支持时（部分模型或代理不支持 tools 参数），
 * 自动退回"把档案直接注入提示词"的老做法 —— 匹配助手不会因此整体失效。
 * 只有在**还没有向访客下发任何内容**时才能安全重试；已经流出去的文字无法收回。
 */
async function runAgentWithFallback(res, messages, apiKey) {
  let streamedAnything = false;
  const originalWrite = res.write.bind(res);
  res.write = (chunk, ...rest) => {
    streamedAnything = true;
    return originalWrite(chunk, ...rest);
  };
  try {
    await runAgent(res, messages, apiKey);
  } catch (error) {
    const unsupportedTools = error.upstreamStatus === 400 && /tool/i.test(String(error.upstreamDetail || ''));
    if (!streamedAnything && (unsupportedTools || error.upstreamStatus === 400)) {
      console.error('工具调用不可用，退回档案注入模式：', error.message);
      writeSse(res, { type: 'meta', note: 'degraded', reason: '工具调用不可用，已退回档案注入模式' });
      const pets = await toolkit.loadPetCatalog();
      writeSse(res, { type: 'meta', petCount: pets.length, degraded: true });
      await streamDeepSeek(res, pets, messages, apiKey);
      return;
    }
    throw error;
  }
}

function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new Error('请求内容过大。'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new Error('请求格式不正确。'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * 解析大模型 API Key。
 *
 * 优先级：环境变量 DEEPSEEK_API_KEY > 数据库 yard_settings.ai_config.apiKey
 *
 * 为什么不把 Key 写进 cloudbaserc.json：那个文件是要提交进仓库的，
 * 写进去等于把密钥公开。改成「管理员在后台填、存数据库」的套路，
 * 与企业微信机器人地址完全一致——不进代码、不用重新部署、随时可换。
 * 数据库里该 key 不在公开只读策略内，匿名访客读不到。
 *
 * 结果在实例内缓存 60 秒，避免每次对话都多一次数据库查询。
 */
let cachedApiKey = null;
let cachedApiKeyAt = 0;
const API_KEY_CACHE_MS = 60 * 1000;

async function resolveApiKey() {
  const fromEnv = text(process.env.DEEPSEEK_API_KEY, 200);
  if (fromEnv) return { key: fromEnv, source: 'env' };

  if (cachedApiKey !== null && Date.now() - cachedApiKeyAt < API_KEY_CACHE_MS) return cachedApiKey;
  try {
    const response = await executePgSql("SELECT jsonb_build_object('key', COALESCE((SELECT value->>'apiKey' FROM public.yard_settings WHERE key='ai_config' LIMIT 1), '')) AS result");
    const resolved = { key: text(sqlResult(response)?.key, 200), source: 'database' };
    cachedApiKey = resolved;
    cachedApiKeyAt = Date.now();
    return resolved;
  } catch (error) {
    console.error('读取 AI 配置失败：', error.message);
    return { key: '', source: 'none' };
  }
}

/**
 * 解析 TokenHub Key（向量化与图像理解用）。
 *
 * 与 DeepSeek Key 存在同一个 ai_config 里，但用途完全独立：
 * DeepSeek 负责"说话"，TokenHub 负责"把文字和照片变成向量"。
 * 同样只在服务端读取，绝不下发前端。
 */
let cachedTokenhubKey = null;
let cachedTokenhubKeyAt = 0;

async function resolveTokenhubKey() {
  const fromEnv = text(process.env.TOKENHUB_API_KEY, 200);
  if (fromEnv) return fromEnv;
  if (cachedTokenhubKey !== null && Date.now() - cachedTokenhubKeyAt < API_KEY_CACHE_MS) return cachedTokenhubKey;
  try {
    const response = await executePgSql("SELECT jsonb_build_object('key', COALESCE((SELECT value->>'tokenhubApiKey' FROM public.yard_settings WHERE key='ai_config' LIMIT 1), '')) AS result");
    cachedTokenhubKey = text(sqlResult(response)?.key, 200);
  } catch (error) {
    console.error('读取 TokenHub 配置失败：', error.message);
    cachedTokenhubKey = '';
  }
  cachedTokenhubKeyAt = Date.now();
  return cachedTokenhubKey;
}

/** TokenHub 向量接口（官方文档核实）：OpenAI 兼容，维度由模型固定。 */
const TOKENHUB_EMBEDDING_URL = 'https://tokenhub.tencentmaas.com/v1/embeddings';
const TOKENHUB_EMBEDDING_MODEL = process.env.TOKENHUB_EMBEDDING_MODEL || 'kinfra-text-embedding-0.6b';

/**
 * 批量把文本转成向量。
 * 失败直接抛错，由知识层转成 `{ok:false}` 交给模型——向量服务故障不该让整轮对话崩掉。
 */
async function embedTexts(texts) {
  if (!Array.isArray(texts) || !texts.length) return [];
  const apiKey = await resolveTokenhubKey();
  if (!apiKey) throw new Error('尚未配置 TokenHub Key，无法做语义检索。');
  const response = await fetch(TOKENHUB_EMBEDDING_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: TOKENHUB_EMBEDDING_MODEL, input: texts, encoding_format: 'float' })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`向量化服务返回 ${response.status}${detail ? `：${text(detail, 120)}` : ''}`);
  }
  const data = await response.json();
  const vectors = (data?.data || []).map(item => item.embedding);
  if (vectors.length !== texts.length) {
    throw new Error(`向量化返回数量不符（期望 ${texts.length}，实际 ${vectors.length}）。`);
  }
  return vectors;
}

/**
 * 逐个工具跑一遍冒烟测试。
 *
 * 为什么需要：工具里的 SQL 是手写的，写错列名（本项目真发生过——
 * 把 pet_updates 的 body 写成了 content）只会在真正调用到那个工具时才暴露，
 * 而且报错会以"AI 答不出来"的形式出现，很难定位。
 * 这里一次性把每个工具都跑一遍，谁坏了立刻看得见。
 *
 * 只返回成功与否和错误信息，不含任何密钥或申请人数据；
 * 默认不跑 search_knowledge（它会触发索引重建、消耗额度），需要时加 ?deep=1。
 */
async function runToolSmokeTests({ deep = false } = {}) {
  const report = {};
  async function run(name, args) {
    const started = Date.now();
    try {
      const result = await toolkit.execute(name, JSON.stringify(args));
      const ok = result?.ok !== false;
      report[name] = { ok, ms: Date.now() - started, ...(ok ? {} : { message: text(result?.message, 160) }) };
      return result;
    } catch (error) {
      report[name] = { ok: false, ms: Date.now() - started, message: text(error.message, 160) };
      return null;
    }
  }

  const pets = await run('search_pets', {});
  await run('get_adoption_policy', {});
  await run('check_requirement_gaps', { conditions: '我租房，房东同意，家里人也都支持' });
  // 档案类工具需要一个真实存在的名字，从检索结果里取一个
  const sample = pets?.pets?.[0]?.name;
  if (sample) {
    await run('get_pet_profile', { name: sample });
    await run('get_follow_up_history', { name: sample });
  } else {
    report.get_pet_profile = { ok: false, message: '没有已发布宠物，无法取样本测试' };
    report.get_follow_up_history = { ok: false, message: '没有已发布宠物，无法取样本测试' };
  }
  if (deep) await run('search_knowledge', { query: sample ? `${sample}的性格` : '领养要求' });

  return report;
}

/**
 * 把一张图片转成 2048 维向量（以图搜宠用）。
 *
 * 图片用 data URL 直接传，**不落盘、不上传到任何存储**——
 * 访客上传的是私人照片，没有理由为了比对把它存下来。
 * 前端会先把图压到 768px 以内，否则 base64 之后请求体放不下。
 *
 * 维度做硬校验：写错模型名时这里的报错比"检索结果莫名其妙"好排查得多。
 */
async function embedImage(input) {
  const apiKey = await resolveTokenhubKey();
  if (!apiKey) throw new Error('尚未配置 TokenHub Key，无法按图片检索。');
  const url = text(input?.dataUrl, 1200000) || text(input?.url, 2000);
  if (!url) throw new Error('缺少图片内容。');

  const response = await fetch(TOKENHUB_MULTIMODAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: VL_MODEL,
      input: [{ type: 'image_url', image_url: { url } }],
      encoding_format: 'float'
    })
  });
  const raw = await response.text().catch(() => '');
  if (!response.ok) {
    // 上游原文直接带出来：模型名写错、图片格式不支持这类问题，看到原文才知道怎么改
    throw new Error(`图片向量服务返回 ${response.status}：${text(raw, 300)}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`图片向量服务返回无法解析的内容：${text(raw, 200)}`);
  }
  const vector = data?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || !vector.length) throw new Error('图片向量服务没有返回向量。');
  if (vector.length !== VL_DIMENSION) {
    throw new Error(`图片向量维度是 ${vector.length}，与预期的 ${VL_DIMENSION} 不符，请检查模型配置（${VL_MODEL}）。`);
  }
  return vector;
}

async function handleChat(req, res) {
  const base = { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' };
  res.writeHead(200, base);

  try {
    const body = await readBody(req);
    const messages = normalizeMessages(body?.messages);
    const ip = clientIp(req);

    const rate = await checkRateLimit(ip).catch(error => {
      // 限频自身故障不应阻断正常访客，但要记录
      console.error('限频检查失败：', error.message);
      return { allowed: true, degraded: true };
    });
    if (!rate.allowed) {
      writeSse(res, { type: 'error', message: '提问太频繁了，请十分钟后再试。' });
      res.end();
      return;
    }

    const resolved = await resolveApiKey();
    const apiKey = resolved.key;
    writeSse(res, { type: 'meta', mock: !apiKey, keySource: resolved.source, tools: toolkit.definitions.length });

    if (!apiKey) {
      // 演示模式仍需要一份档案来生成示例回复
      const pets = await toolkit.loadPetCatalog();
      writeSse(res, { type: 'meta', petCount: pets.length });
      await streamMock(res, pets, messages);
      return;
    }
    await runAgentWithFallback(res, messages, apiKey);
    // 必须显式关闭：否则连接会一直挂着，直到云函数 60 秒超时才断开，
    // 前端会一直转圈、测试也会超时。降级路径内部已自行 end()，故先判断。
    if (!res.writableEnded) {
      writeSse(res, { type: 'done', mock: false });
      res.end();
    }
  } catch (error) {
    console.error('AI 对话失败：', error.message);
    writeSse(res, { type: 'error', message: text(error.message, 200) || 'AI 服务暂时不可用。' });
    res.end();
  }
}

const server = http.createServer(async (req, res) => {
  const url = String(req.url || '/');

  // 预检交给平台自动附加 CORS 头，这里只需一个空 204，避免落到业务逻辑
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.includes('/chat') && req.method === 'POST') {
    await handleChat(req, res);
    return;
  }

  // 以图搜宠：上传一张照片，找出画面特征最接近的站内宠物
  if (url.includes('/match-photo') && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    try {
      const body = await readBody(req, MAX_PHOTO_BODY_BYTES);
      const result = await vision.search({
        imageDataUrl: body?.image,
        photos: Array.isArray(body?.photos) ? body.photos : [],
        topK: body?.topK
      });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error('以图搜宠失败：', error.message);
      res.end(JSON.stringify({ ok: false, message: text(error.message, 300) || '以图搜宠暂时不可用。' }));
    }
    return;
  }

  // 工具自检：逐个跑一遍，写错列名这类问题立刻现形
  if (url.includes('/health/tools')) {
    const deep = url.includes('deep=1');
    const tools = await runToolSmokeTests({ deep });
    const failures = Object.entries(tools)
      .filter(([, item]) => !item.ok)
      .map(([name]) => name);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: failures.length === 0, failures, tools, deep, time: new Date().toISOString() }));
    return;
  }

  const resolved = await resolveApiKey();
  const apiKey = resolved.key;
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(
    JSON.stringify({
      ok: true,
      service: 'ai-stream',
      purpose: 'AI 领养匹配助手（SSE 流式）',
      // 只暴露「有没有配 Key」与来源，绝不回显 Key 本身
      model: apiKey ? DEEPSEEK_MODEL : 'mock',
      mockMode: !apiKey,
      keySource: resolved.source,
      // 诊断用布尔值（不含任何密钥内容），便于定位「凭据缺失」这类问题
      diagnostics: {
        hasSecretId: Boolean(process.env.TENCENTCLOUD_SECRETID),
        hasSecretKey: Boolean(process.env.TENCENTCLOUD_SECRETKEY),
        hasSessionToken: Boolean(process.env.TENCENTCLOUD_SESSIONTOKEN),
        hasEnvId: Boolean(process.env.TCB_ENV || process.env.SCF_NAMESPACE)
      },
      endpoints: {
        'POST /chat': 'SSE 流式对话，body: {messages:[{role,content}]}',
        'POST /match-photo': '以图搜宠，body: {image: dataURL, photos: [{path,url,petId,petName}]}'
      },
      vision: { model: VL_MODEL, dimension: VL_DIMENSION },
      // 工具清单只报数量与名字：调用方据此判断 Function Calling 是否已启用
      tools: { count: toolkit.definitions.length, names: toolkit.definitions.map(item => item.function.name) },
      time: new Date().toISOString()
    })
  );
});

server.listen(PORT, () => {
  console.log(`[ai-stream] 已启动，监听 ${PORT}`);
});
