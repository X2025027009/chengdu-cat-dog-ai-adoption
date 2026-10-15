/**
 * 工具健康检查（命令行入口）。
 *
 * 调用云函数的 /health/tools，逐个跑一遍工具。
 * 写错列名这类问题会在这里立刻现形，而不是等 AI 对话时以"答不出来"
 * 的形式出现——那样的报错很难定位到具体是哪条 SQL。
 *
 * 用法：
 *   node tools/check-ai-tools-health.cjs           仅基础检查（不消耗额度）
 *   node tools/check-ai-tools-health.cjs --deep    含语义检索（会触发索引重建）
 */
const BASE = 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.ap-shanghai.app.tcloudbase.com/ai-stream';

let passed = 0;
let failed = 0;
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${label}`);
  } else {
    failed += 1;
    console.log(`  ❌ ${label}${detail ? ` —— ${detail}` : ''}`);
  }
}

(async () => {
  const deep = process.argv.includes('--deep');
  console.log(`工具健康检查${deep ? '（深度：含语义检索）' : ''}\n`);

  let payload;
  try {
    const response = await fetch(`${BASE}/health/tools${deep ? '?deep=1' : ''}&t=${Date.now()}`);
    payload = await response.json();
  } catch (error) {
    check('服务可达', false, error.message);
    console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
    process.exit(1);
  }

  check('服务可达', typeof payload === 'object');
  const tools = payload.tools || {};
  const names = Object.keys(tools);
  check('返回了工具清单', names.length >= 5, `实际 ${names.length} 个`);

  for (const [name, result] of Object.entries(tools)) {
    check(`${name} 正常`, result.ok === true, result.message || `耗时 ${result.ms}ms`);
  }

  if (deep) {
    check('包含语义检索工具的检查结果', Object.prototype.hasOwnProperty.call(tools, 'search_knowledge'), 'deep 模式下应当检查 search_knowledge');
  } else {
    check('默认不触发索引重建', !Object.prototype.hasOwnProperty.call(tools, 'search_knowledge'), '非 deep 模式不应跑 search_knowledge，以免消耗额度');
  }

  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  // 用 exitCode 而不是 process.exit()：后者会在 fetch 的连接还没关闭时强行退出，
  // Node 会抛 "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)" 噪音。
  process.exitCode = failed ? 1 : 0;
})();
