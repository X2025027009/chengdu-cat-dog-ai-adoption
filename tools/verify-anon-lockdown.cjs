/**
 * 安全校验：确认「匿名访客直写数据库」的入口已关闭。
 *
 * 【test:live】会向线上写入数据，仅由委托方显式运行。
 * 请求预期被拒绝；若权限出现回归，三个写入探针可能实际落库。
 * 用 site-config.js 里的匿名 Publishable Key 请求 CloudBase 网关的 RDB 接口，
 * 也就是浏览器 SDK 走的同一条路。密钥从该文件读取、不打印。
 *
 * 期望结果：
 *   - 公开只读（pets）仍然可用
 *   - 往 applications / rate_limit_events 直接写入必须被拒绝
 *   - 读取 applications（含他人隐私）必须被拒绝
 *
 * 用法：node tools/verify-anon-lockdown.cjs
 */
const fs = require('node:fs');
const path = require('node:path');

const configSource = fs.readFileSync(path.join(__dirname, '..', 'site-config.js'), 'utf8');
const match = configSource.match(/window\.YARD_CLOUD_CONFIG\s*=\s*(\{[\s\S]*?\})\s*;/);
if (!match) {
  console.error('无法从 site-config.js 读取 YARD_CLOUD_CONFIG');
  process.exit(1);
}
const config = new Function(`return (${match[1]});`)();
const base = `https://${config.env}.api.tcloudbasegateway.com/v1/rdb/rest`;

const authHeaders = {
  Authorization: `Bearer ${config.accessKey}`,
  'Content-Type': 'application/json',
  'X-Db-Instance': 'default',
  'Accept-Profile': 'public',
  'Content-Profile': 'public'
};

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

async function request(method, table, { body, query = '' } = {}) {
  const response = await fetch(`${base}/${table}${query}`, {
    method,
    headers: authHeaders,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  return { status: response.status, text };
}

(async () => {
  console.log(`环境：${config.env}\n`);

  // 1) 公开只读必须仍然可用
  const pets = await request('GET', 'pets', { query: '?select=id,name&limit=1' });
  check('匿名仍可公开读取宠物列表', pets.status === 200, `HTTP ${pets.status} ${pets.text.slice(0, 200)}`);

  // 2) 匿名不能读取申请资料（隐私）
  const readApplications = await request('GET', 'applications', { query: '?select=id&limit=1' });
  const readBlocked = readApplications.status !== 200 || readApplications.text.trim() === '[]';
  check('匿名无法读取申请资料', readBlocked, `HTTP ${readApplications.status} ${readApplications.text.slice(0, 200)}`);

  // 3) 匿名不能直接写入 applications
  const probeRow = {
    id: '__anon_lockdown_probe__',
    pet_id: 'pet-1788762655536',
    application_type: '预约申请',
    applicant_name: '匿名越权探针',
    applicant_age: 30,
    applicant_gender: '女',
    contact: '__anon_lockdown_probe__',
    contact_normalized: '__anon_lockdown_probe__',
    has_chengdu_home: true,
    experience: '有',
    family_agreement: '全部同意',
    other_pets: '没有',
    internal_status: '已登记'
  };
  const insertApplication = await request('POST', 'applications', { body: probeRow });
  check('匿名无法直写 applications', insertApplication.status >= 400, `HTTP ${insertApplication.status} ${insertApplication.text.slice(0, 200)}`);

  // 4) 匿名不能直接写入 rate_limit_events
  const insertRate = await request('POST', 'rate_limit_events', {
    body: { id: '__anon_lockdown_probe__', event_kind: 'application_submit', key_hash: '__anon_lockdown_probe__' }
  });
  check('匿名无法直写 rate_limit_events', insertRate.status >= 400, `HTTP ${insertRate.status} ${insertRate.text.slice(0, 200)}`);

  // 5) 匿名不能写入 application_events
  const insertEvent = await request('POST', 'application_events', {
    body: { id: '__anon_lockdown_probe__', application_id: '__anon_lockdown_probe__', event_type: 'probe', detail: {} }
  });
  check('匿名无法直写 application_events', insertEvent.status >= 400, `HTTP ${insertEvent.status} ${insertEvent.text.slice(0, 200)}`);

  // 6) 公开设置仍可读取
  const settings = await request('GET', 'yard_settings', { query: '?select=key&key=eq.public_contact' });
  check('匿名仍可读取公开联系方式设置', settings.status === 200, `HTTP ${settings.status} ${settings.text.slice(0, 200)}`);

  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  process.exit(failed ? 1 : 0);
})();
