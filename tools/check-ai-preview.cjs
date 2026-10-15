/**
 * 【test:online】部署后的多页站点与 AI 健康信息检查，只发送 GET 请求。
 *
 * 原用例针对旧 /v3/ 单页预览，要求所有功能都在首页以及 #match 导航。
 * 网站改为真实独立页面后，这些断言已过时；现在逐页验证同一批功能，
 * 仍保留共享样式、SSE 解析、中断控制、原申请/后台逻辑和 AI 健康检查。
 * 本地待审核阶段不要运行本脚本，由委托方完成部署后显式验收。
 *
 * 用法：node tools/check-ai-preview.cjs
 * 可用 SITE_BASE 指定已部署的站点或子目录，AI_BASE 指定 AI 服务根地址。
 */
const base = (process.env.SITE_BASE || 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.tcloudbaseapp.com').replace(/\/+$/, '');
const aiHealth = `${(process.env.AI_BASE || 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.ap-shanghai.app.tcloudbase.com/ai-stream').replace(/\/+$/, '')}/`;
const pages = [
  { file: 'index.html', page: 'home', markers: ['class="hero"', 'id="stats"'] },
  { file: 'pets.html', page: 'pets', markers: ['id="petGrid"'] },
  { file: 'match.html', page: 'match', markers: ['id="match"', 'id="matchForm"'] },
  { file: 'adoption.html', page: 'adoption', markers: ['id="how"'] },
  { file: 'stories.html', page: 'stories', markers: ['id="storiesGrid"'] },
  { file: 'about.html', page: 'about', markers: ['id="contactList"', 'assets/team-photo.jpg'] },
  { file: 'admin.html', page: 'admin', markers: ['id="adminContent"', 'id="adminBackdrop"'] }
];

let passed = 0;
let failed = 0;
function check(label, ok, detail = '') {
  if (ok) {
    passed += 1;
    console.log(`✅ ${label}`);
  } else {
    failed += 1;
    console.log(`❌ ${label}${detail ? `\n     ${detail}` : ''}`);
  }
}

async function grab(url) {
  const target = new URL(url);
  target.searchParams.set('t', String(Date.now()));
  const response = await fetch(target, { method: 'GET', signal: AbortSignal.timeout(20000) });
  return { status: response.status, body: await response.text() };
}

(async () => {
  console.log(`--- 已部署多页站点（只读 GET）：${base}/ ---`);
  for (const page of pages) {
    const result = await grab(`${base}/${page.file}`);
    check(`${page.file} 返回 200`, result.status === 200, `实际 ${result.status}`);
    check(`${page.file} 是对应的独立页面`, result.body.includes(`data-page="${page.page}"`), '缺少独立页面身份');
    for (const marker of page.markers) check(`${page.file} 保留功能 ${marker}`, result.body.includes(marker), '缺少功能结构');
    check(`${page.file} 加载共享配置与脚本`, result.body.includes('src="site-config.js"') && result.body.includes('src="app.js"'), '共享资源引用丢失');
    check(`${page.file} 使用独立 AI 页面入口`, result.body.includes('href="match.html"'), '找不到 match.html 导航');
    const activeLinks = [...result.body.matchAll(/<a\b[^>]*\baria-current="page"[^>]*>/g)];
    check(`${page.file} 当前导航指向自身`, activeLinks.length === 1 && activeLinks[0][0].includes(`href="${page.file}"`), '当前页标记有误');
  }

  const css = await grab(`${base}/styles.css`);
  check('样式表可访问', css.status === 200, `HTTP ${css.status}`);
  check('含 AI 面板样式', css.body.includes('.match-panel'), '缺少 .match-panel');
  check('沿用了原版设计变量', css.body.includes('var(--warm-yellow)') && css.body.includes('var(--radius)'), '没有复用原版变量');
  check('原版样式仍在（未被覆盖）', css.body.includes('--cream:') && css.body.includes('.pet-card'), '原版样式丢失');

  const config = await grab(`${base}/site-config.js`);
  check('共享配置可访问', config.status === 200, `HTTP ${config.status}`);
  check('共享配置保留匿名云端配置与本地审核隔离', config.body.includes('YARD_CLOUD_CONFIG') && config.body.includes('YARD_LOCAL_REVIEW') && config.body.includes('YARD_CLOUD_READY'));

  const js = await grab(`${base}/app.js`);
  check('脚本可访问', js.status === 200, `HTTP ${js.status}`);
  check('含 AI 端点调用', js.body.includes('/ai-stream/chat'), '缺少端点');
  check('含流式解析', js.body.includes('getReader()'), '缺少 ReadableStream 解析');
  check('含中断控制', js.body.includes('AbortController'), '缺少中断控制');
  check('原版申请与后台逻辑仍在', js.body.includes('submitApplicationThroughFunction') && js.body.includes('loadCloudAdminData'), '原版逻辑丢失');

  console.log('\n--- AI 后端健康信息（只读 GET）---');
  const healthResult = await grab(aiHealth);
  check('AI 健康端点返回 200', healthResult.status === 200, `HTTP ${healthResult.status}`);
  const health = JSON.parse(healthResult.body);
  check('AI 服务在线', health?.ok === true, JSON.stringify(health));
  check('健康信息只报告模式、不暴露 API Key', typeof health?.mockMode === 'boolean' && !JSON.stringify(health).includes('sk-'));
  console.log(`     模式：${health?.mockMode ? 'mock（未配 Key，返回演示内容）' : `真实模型 ${health.model}`}`);

  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  if (failed === 0) console.log(`已验收站点：${base}/`);
  process.exitCode = failed ? 1 : 0;
})().catch(error => {
  console.error(`线上只读检查异常：${error?.message || error}`);
  process.exitCode = 1;
});
