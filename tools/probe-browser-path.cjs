/**
 * 复刻浏览器真实路径，并**逐步独立**报告每一步的通过情况。
 *
 * 为什么每步要独立：网关鉴权是分资源类型放行的（云函数 / 数据库 / 存储），
 * 某一步失败不代表其他步也失败。必须拿到完整边界，
 * 才知道该往 OPA 策略里补哪几条允许规则——而不是靠猜。
 *
 * 【test:live】会向线上写入数据，仅由委托方显式运行。
 * 会建立匿名身份并调用提交接口；测试宠物预期不存在，但不能保证零副作用。
 * 密钥从 site-config.js 读取，不写入本文件、也不打印。
 *
 * 用法：node tools/probe-browser-path.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: key => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: index => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    }
  };
}

const configSource = fs.readFileSync(path.join(__dirname, '..', 'site-config.js'), 'utf8');
const matched = configSource.match(/window\.YARD_CLOUD_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;/);
if (!matched) {
  console.error('无法从 site-config.js 读取 YARD_CLOUD_CONFIG');
  process.exit(1);
}
const config = new Function(`return (${matched[1]});`)();

const results = [];
/** 每一步都独立执行：失败只记录，不中断后续探测。 */
async function step(label, run, judge) {
  try {
    const value = await run();
    const ok = judge ? judge(value) : true;
    results.push({ label, ok, detail: summarize(value) });
    console.log(`${ok ? '✅' : '❌'} ${label}\n     ${summarize(value)}`);
  } catch (error) {
    results.push({ label, ok: false, detail: error?.message || String(error) });
    console.log(`❌ ${label}\n     ${error?.message || error}`);
  }
}
function summarize(value) {
  if (value === undefined) return '';
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 260 ? `${text.slice(0, 260)}…` : text;
}

(async () => {
  console.log(`环境：${config.env}\n`);

  const mod = require('@cloudbase/js-sdk');
  const sdk = mod.default || mod;
  const app = sdk.init(config);
  const auth = app.auth();

  // 1) 身份层：匿名登录
  await step('① 匿名登录（身份层）', async () => {
    const out = await auth.signInAnonymously();
    if (out?.error) throw new Error(out.error.message);
    return '已建立匿名会话';
  });

  // 2) 授权层：云函数（领养申请提交走这条）
  await step('② 调用云函数 yard-api（授权层 · functions）', async () => {
    const out = await app.callFunction({ name: 'yard-api', parse: true, data: { action: 'health' } });
    if (out?.error) throw new Error(out.error.message || JSON.stringify(out.error));
    if (!JSON.stringify(out).includes('"ok":true')) throw new Error(JSON.stringify(out).slice(0, 200));
    return out?.result || out;
  });

  // 3) 授权层：数据库读取（首页宠物列表走这条）
  await step('③ 读取公开宠物档案（授权层 · 数据库）', async () => {
    const out = await app.rdb().from('pets').select('id,name').eq('is_published', true).limit(3);
    if (out?.error) throw new Error(out.error.message || JSON.stringify(out.error));
    const rows = Array.isArray(out?.data) ? out.data : [];
    if (!rows.length) throw new Error('返回 0 行（可能是 RLS 或授权问题）');
    return rows.map(row => row.name);
  });

  // 4) 授权层：云存储读取（宠物照片走这条）
  await step('④ 读取云存储公开地址（授权层 · 存储）', async () => {
    const out = await app.storage.from('yard-media').getPublicUrl('settings/wechat-qr/1788766712376-wnfuad-1000022221.jpg');
    const url = out?.data?.publicUrl || out?.publicUrl;
    if (!url) throw new Error(JSON.stringify(out).slice(0, 200));
    const response = await fetch(url);
    if (!response.ok) throw new Error(`取到地址但访问返回 ${response.status}`);
    return `图片可访问（HTTP ${response.status}）`;
  });

  // 5) 提交链路（用不存在的宠物 → 业务级报错即说明「网关→云函数→数据库」整条链通，且不写入数据）
  await step('⑤ 领养申请提交链路（不写入数据）', async () => {
    const out = await app.callFunction({
      name: 'yard-api',
      parse: true,
      data: {
        action: 'application.submit',
        petId: '__probe_nonexistent_pet__',
        applicationType: '正式领养申请',
        name: '探针测试',
        age: 30,
        gender: '女',
        contact: `__probe_${Date.now()}__`,
        hasChengduHome: true,
        experience: '有',
        familyAgreement: '全部同意',
        otherPets: '没有',
        note: '',
        website: '',
        formStartedAt: Date.now() - 60000,
        browserToken: `probe-${Date.now()}`
      }
    });
    if (out?.error) throw new Error(out.error.message || JSON.stringify(out.error));
    const text = JSON.stringify(out);
    // 业务级提示都算通：找不到宠物 / 提交频繁 / 达到上限，都说明链路走通了
    if (text.includes('找不到这只宠物') || text.includes('提交过于频繁') || text.includes('提交次数已达到上限')) {
      return text.slice(0, 120);
    }
    throw new Error(text.slice(0, 200));
  });

  const passed = results.filter(item => item.ok).length;
  const failed = results.length - passed;
  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  console.log('\n边界小结（失败的即为需要补授权策略的资源类型）：');
  for (const item of results) console.log(`  ${item.ok ? '可用' : '受阻'}  ${item.label}`);
  process.exit(failed ? 1 : 0);
})().catch(error => {
  console.error('探针异常：', error?.message || error);
  process.exit(1);
});
