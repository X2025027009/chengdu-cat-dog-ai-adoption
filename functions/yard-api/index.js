const crypto = require('node:crypto');
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.rdb({ database: 'public' });
const allowedStatuses = new Set(['未处理', '沟通中', '已通过', '已登记', '等待宠物开放', '已通知', '已转为正式领养申请', '暂不考虑']);
const allowedPetStatuses = new Set(['待领养', '已领养', '暂不适合领养']);
const allowedPetTypes = new Set(['猫咪', '狗狗']);
const allowedGenders = new Set(['公', '母']);
const allowedApplicantGenders = new Set(['女', '男', '不方便说明']);
const allowedExperience = new Set(['有', '没有', '正在了解']);
const allowedFamilyAgreement = new Set(['全部同意', '部分同意', '尚未沟通']);
const allowedOtherPets = new Set(['没有', '有猫', '有狗', '有其他宠物']);
// 群提醒里附带的网站地址，便于管理员一键打开后台；可用环境变量 SITE_URL 覆盖。
// ⚠️ 换环境时这里必须同步更新，否则群提醒里的「打开管理员后台」会指向旧站。
const SITE_URL = text(process.env.SITE_URL, 300) || 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.tcloudbaseapp.com/';

function id(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}
function text(value, max = 1000) {
  return String(value ?? '')
    .trim()
    .slice(0, max);
}
function normalizeContact(value) {
  return text(value, 120).replace(/[\s-]/g, '').toLowerCase();
}
function hash(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}
function rows(result, operation = '数据库操作') {
  if (result?.error) {
    const message = result.error.message || result.error.error || String(result.error);
    throw new Error(`${operation}失败：${message}`);
  }
  return Array.isArray(result?.data) ? result.data : result?.data ? [result.data] : [];
}
function contextInfo(context) {
  const info = cloudbase.getCloudbaseContext(context);
  return {
    uid: info.TCB_UUID || info.uid || '',
    ip: info.WX_CLIENTIP || info.TCB_SOURCE_IP || '',
    source: info.TCB_SOURCE || ''
  };
}
/**
 * 构造限频键。
 *
 * 注意 includeIp 的用途：IP 不参与「10 分钟快速限频」，只参与「24 小时每日上限」。
 * 原因是同一出口 IP（办公室、校园网、运营商 NAT）后面可能是完全不同的访客，
 * 用 IP 做 10 分钟硬限频会误伤正常申请人；而每日上限保留 IP 仍然拦得住刷屏。
 */
function applicationRateKeys({ ip, browserToken, contactNormalized }, includeIp = true) {
  const keys = [];
  if (includeIp && ip) keys.push(`ip:${hash(ip)}`);
  if (browserToken) keys.push(`browser:${hash(browserToken)}`);
  if (contactNormalized) keys.push(`contact:${hash(contactNormalized)}`);
  return [...new Set(keys)];
}
function configuredAdmins() {
  return new Set(
    text(process.env.ADMIN_UIDS, 1000)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  );
}
async function requireAdmin(context) {
  const { uid } = contextInfo(context);
  if (!uid) throw new Error('请先使用管理员账号登录。');
  const configured = configuredAdmins();
  if (configured.size && !configured.has(uid)) throw new Error('当前账号没有管理员权限。');
  if (!configured.size) {
    // ⚠️ 必须走 ExecutePGSql 特权通道，不能用 db.from(...)：
    // 云函数里的 app.rdb() **以匿名身份运行**，而 yard_administrators
    // 只授权给 authenticated，用它会直接报
    // 「permission denied for table yard_administrators」，
    // 导致后台所有管理操作全部失败。
    const response = await executePgSql(
      `SELECT jsonb_build_object('n', (SELECT count(*) FROM public.yard_administrators WHERE auth_uid = ${sqlLiteral(uid)} AND active = TRUE)) AS result`,
      await resolveSecret()
    );
    if (!(Number(sqlResult(response)?.n) > 0)) throw new Error('当前账号没有管理员权限。');
  }
  return uid;
}
/**
 * 解析企业微信机器人地址。
 *
 * 优先级：云函数环境变量 WECOM_WEBHOOK > 数据库 yard_settings 的 wecom_webhook。
 * 环境变量适合临时覆盖；长期配置建议在管理员后台填写——
 * 这样换机器人时不必重新部署，地址也不会落到任何代码或配置文件里。
 */
async function resolveWeComWebhook(secret) {
  const fromEnv = text(process.env.WECOM_WEBHOOK, 500);
  if (fromEnv) return fromEnv;
  try {
    const response = await executePgSql("SELECT jsonb_build_object('url', COALESCE((SELECT value->>'url' FROM public.yard_settings WHERE key='wecom_webhook' LIMIT 1), '')) AS result", secret);
    return text(sqlResult(response)?.url, 500);
  } catch (error) {
    console.error('读取企业微信机器人地址失败：', error.message);
    return '';
  }
}
/** 把时间转成北京时间，方便群里直接读。 */
function beijingTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return text(value, 40);
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
}
/** 统计同一只宠物已收到多少份申请；失败不影响提醒发送。 */
async function countPetApplications(petId, secret) {
  if (!petId) return 0;
  try {
    const response = await executePgSql(`SELECT jsonb_build_object('n', (SELECT count(*) FROM public.applications WHERE pet_id=${sqlLiteral(petId)})) AS result`, secret);
    return Number(sqlResult(response)?.n) || 0;
  } catch (error) {
    console.error('统计同宠物申请数失败：', error.message);
    return 0;
  }
}
/**
 * 生成一行「字段：值」。
 *
 * 消息使用**纯文本**（msgtype: text）而不是 markdown：实测微信插件
 * （在普通微信里接收企业微信消息）**不渲染 markdown**，只会显示
 * 一行「暂不支持此消息类型」；换成纯文本后两个客户端都能正常看到内容。
 * 换行会压成空格，避免长备注撑散排版。
 */
function wecomLine(label, value, empty = '（未填写）') {
  const flat = text(value, 200).replace(/\s*\n+\s*/g, ' ');
  return `${label}：${flat || empty}`;
}
/** 按 UTF-8 字节数截断，避免超出企业微信纯文本 2048 字节的上限。 */
function truncateUtf8(value, maxBytes) {
  const buffer = Buffer.from(String(value), 'utf8');
  if (buffer.length <= maxBytes) return String(value);
  const cut = buffer
    .subarray(0, maxBytes)
    .toString('utf8')
    .replace(/\uFFFD+$/, '');
  return `${cut}\n…（内容过长已截断，完整资料请打开管理员后台查看）`;
}
/**
 * 组装群提醒内容。
 *
 * 注意：这里按网站负责人的**明确要求**发送完整申请资料（含姓名与联系方式），
 * 与 BUG.md 第 5 节原本的「最小信息」要求不同，是负责人知情后自行承担的选择。
 * 仍然刻意不发送：管理员内部备注、来源 IP 哈希、浏览器指纹哈希、修改令牌。
 */
function buildWeComContent(application, petApplicationCount) {
  const lines = [
    '成都猫狗小院 · 有新申请',
    `宠物：${text(application.pet_name, 40) || '未知'}`,
    `类型：${text(application.application_type, 20)}`,
    `时间：${beijingTime(application.submitted_at)}`,
    `申请编号：${text(application.id, 80)}`,
    '',
    '—— 申请人资料 ——',
    wecomLine('姓名', application.applicant_name),
    wecomLine('年龄 / 性别', `${Number(application.applicant_age) || '?'} 岁 / ${text(application.applicant_gender, 20) || '未填写'}`),
    wecomLine('联系方式', application.contact),
    wecomLine('成都及周边有住所', application.has_chengdu_home ? '是' : '否'),
    wecomLine('养宠经验', application.experience),
    wecomLine('家庭成员意见', application.family_agreement),
    wecomLine('现有宠物', application.other_pets),
    wecomLine('补充说明', application.note, '（申请人未填写）')
  ];
  if (petApplicationCount > 1) lines.push('', `（这已经是该宠物收到的第 ${petApplicationCount} 份申请）`);
  lines.push('', `打开管理员后台：${SITE_URL}`);
  return truncateUtf8(lines.join('\n'), 1800);
}
async function notifyWeCom(application, secret) {
  const webhook = await resolveWeComWebhook(secret);
  if (!webhook) return { sent: false, skipped: true, reason: '企业微信机器人地址尚未配置' };
  const petApplicationCount = await countPetApplications(application.pet_id, secret);
  const payload = { msgtype: 'text', text: { content: buildWeComContent(application, petApplicationCount) } };
  const response = await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  // 注意：企业微信即使发送失败也会返回 HTTP 200，真正的结果在响应体的 errcode 里。
  let body = null;
  try {
    body = await response.json();
  } catch {
    /* 非 JSON 响应，按下面的状态码判断 */
  }
  if (body && typeof body.errcode === 'number' && body.errcode !== 0) {
    throw new Error(`企业微信提醒发送失败：${text(body.errmsg, 120) || body.errcode}`);
  }
  if (!response.ok) throw new Error('企业微信提醒发送失败。');
  return { sent: true };
}
/**
 * 把最近一次提醒的结果记进 yard_settings，供管理员后台直接查看。
 *
 * 为什么需要它：云端函数日志服务当前没有开启，如果机器人地址填错，
 * 管理员在群里只会「什么也收不到」，却没有任何地方能看到原因。
 */
async function recordWeComOutcome(secret, sent, reason) {
  const patch = JSON.stringify({
    lastOk: sent === true,
    lastReason: text(reason || '', 200),
    lastAt: new Date().toISOString()
  });
  try {
    await executePgSql(
      `INSERT INTO public.yard_settings (key, value, updated_at) VALUES ('wecom_webhook', ${sqlLiteral(patch)}::jsonb, NOW()) ON CONFLICT (key) DO UPDATE SET value = public.yard_settings.value || EXCLUDED.value, updated_at = NOW()`,
      secret
    );
  } catch (error) {
    console.error('记录企业微信提醒结果失败：', error.message);
  }
}
async function publicBootstrap() {
  const [petResult, mediaResult, updateResult, settingsResult] = await Promise.all([
    db.from('pets').select('*').eq('is_published', true).order('updated_at', { ascending: false }).limit(200),
    db.from('pet_media').select('*').eq('is_public', true).order('sort_order', { ascending: true }).limit(1000),
    db.from('pet_updates').select('*').order('update_date', { ascending: false }).limit(1000),
    db.from('yard_settings').select('key,value').in('key', ['public_contact', 'application_policy']).limit(20)
  ]);
  const pets = rows(petResult, '读取宠物资料');
  const media = rows(mediaResult, '读取宠物影像');
  const updates = rows(updateResult, '读取回访档案');
  const settings = rows(settingsResult, '读取网站设置');
  return {
    pets: pets.map(pet => ({
      ...pet,
      media: media
        .filter(item => item.pet_id === pet.id)
        .map(item => ({
          id: item.id,
          type: item.media_type,
          storagePath: item.storage_path,
          externalUrl: item.external_url,
          caption: item.caption,
          altText: item.alt_text,
          isCover: item.is_cover,
          sortOrder: item.sort_order
        })),
      updates: updates.filter(item => item.pet_id === pet.id)
    })),
    settings: Object.fromEntries(settings.map(item => [item.key, item.value]))
  };
}
function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}
function sqlTextArray(values) {
  return `ARRAY[${values.map(sqlLiteral).join(',')}]::TEXT[]`;
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
 * 解析可用于腾讯云 OpenAPI（ExecutePGSql）TC3 签名的临时凭证。
 * 优先使用云函数运行时上下文里的临时密钥，其次尝试云厂商元数据服务。
 */
async function resolveSecret() {
  const info = cloudbase.getCloudbaseContext();
  if (info.TENCENTCLOUD_SECRETID && info.TENCENTCLOUD_SECRETKEY) {
    return {
      source: 'context',
      secretId: info.TENCENTCLOUD_SECRETID,
      secretKey: info.TENCENTCLOUD_SECRETKEY,
      sessionToken: info.TENCENTCLOUD_SESSIONTOKEN || ''
    };
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
    /* 元数据不可用时交给调用方统一报错 */
  }
  return null;
}
/**
 * 通过腾讯云 OpenAPI ExecutePGSql 执行一段 SQL。
 *
 * 签名方式与 CloudBase CLI 内部调用 tcb.tencentcloudapi.com 的实现保持一致，
 * 这是能正常工作的参考实现。两个关键点：
 *   1. 只把 content-type 和 host 纳入签名；
 *   2. 临时凭证的 Token 必须放在 X-TC-Token 请求头里。
 * 之前的实现把 Token 追加到 Authorization 上、并签了多个额外请求头，
 * 服务端因此无法解析临时 SecretId，报 “The SecretId is not found”，
 * 导致所有申请提交都失败。
 */
async function executePgSql(sql, secret) {
  const credentials = secret || (await resolveSecret());
  const { secretId, secretKey, sessionToken } = credentials || {};
  const envId = process.env.TCB_ENV || process.env.SCF_NAMESPACE;
  if (!secretId || !secretKey || !envId) throw new Error('申请服务暂不可用，请稍后再试。');
  const service = 'tcb';
  const host = 'tcb.tencentcloudapi.com';
  const path = '/';
  const method = 'POST';
  const region = process.env.TENCENTCLOUD_REGION || process.env.TCB_REGION || 'ap-shanghai';
  const body = JSON.stringify({ EnvId: envId, Sql: sql });
  const timestamp = Math.floor(Date.now() / 1000);
  const date = tc3Date(timestamp);
  const canonicalHeaders = `content-type:application/json\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = `${method}\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256Hex(body)}`;
  const stringToSign = `TC3-HMAC-SHA256\n${timestamp}\n${date}/${service}/tc3_request\n${sha256Hex(canonicalRequest)}`;
  const kDate = hmacSha256(`TC3${secretKey}`, date);
  const kService = hmacSha256(kDate, service);
  const kSigning = hmacSha256(kService, 'tc3_request');
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
  const response = await fetch(`https://${host}${path}`, { method, headers, body });
  const result = await response.json();
  if (!response.ok || result?.Response?.Error) throw new Error(result?.Response?.Error?.Message || '申请服务暂不可用，请稍后再试。');
  return result.Response;
}
function sqlResult(response) {
  if (!Array.isArray(response?.Rows) || !response.Rows.length) throw new Error('申请服务暂不可用，请稍后再试。');
  const row = JSON.parse(response.Rows[0]);
  const value = Array.isArray(row) ? row[0] : row;
  return typeof value === 'string' ? JSON.parse(value) : value;
}
async function submitApplicationRecord(payload, secret) {
  const rateKeys = sqlTextArray(payload.rateKeys);
  const recentRateKeys = sqlTextArray(payload.recentRateKeys);
  const rateValues = payload.rateEventIds.map((eventId, index) => `(${sqlLiteral(eventId)},${sqlLiteral(payload.rateKeys[index])})`).join(',');
  const sql = `WITH locked AS (SELECT pg_advisory_xact_lock(hashtext('yard-api-submit:' || key_hash)) FROM unnest(${rateKeys}) AS key_hash), ready AS (SELECT count(*) FROM locked), pet AS (SELECT id,name,adoption_status FROM public.pets WHERE id=${sqlLiteral(payload.petId)} AND is_published=TRUE), decision AS (SELECT CASE WHEN EXISTS (SELECT 1 FROM public.applications WHERE pet_id=${sqlLiteral(payload.petId)} AND contact_normalized=${sqlLiteral(payload.contactNormalized)} AND submitted_at>=NOW()-INTERVAL '7 days') THEN '你近期已为这只宠物提交过申请，请等待管理员联系。' WHEN EXISTS (SELECT 1 FROM public.rate_limit_events WHERE event_kind='application_submit' AND key_hash=ANY(${recentRateKeys}) AND created_at>=NOW()-INTERVAL '10 minutes') THEN '提交过于频繁，请十分钟后再试。' WHEN EXISTS (SELECT 1 FROM public.rate_limit_events WHERE event_kind='application_submit' AND key_hash=ANY(${rateKeys}) AND created_at>=NOW()-INTERVAL '24 hours' GROUP BY key_hash HAVING count(*)>=3) THEN '今天的提交次数已达到上限，请明天再试。' WHEN pet.id IS NULL THEN '找不到这只宠物，请刷新页面后重试。' WHEN ${sqlLiteral(payload.applicationType)}='正式领养申请' AND pet.adoption_status<>'待领养' THEN '这只宠物目前不开放正式领养。' WHEN ${sqlLiteral(payload.applicationType)}='预约申请' AND pet.adoption_status<>'暂不适合领养' THEN '这只宠物目前无需预约。' ELSE NULL END AS message,pet.name FROM ready LEFT JOIN pet ON TRUE), new_application AS (INSERT INTO public.applications (id,pet_id,application_type,applicant_name,applicant_age,applicant_gender,contact,contact_normalized,has_chengdu_home,experience,family_agreement,other_pets,note,internal_status,source_ip_hash,browser_token_hash,submitted_at,edit_token_hash,edit_token_expires_at) SELECT ${sqlLiteral(payload.applicationId)},${sqlLiteral(payload.petId)},${sqlLiteral(payload.applicationType)},${sqlLiteral(payload.applicantName)},${Number(payload.applicantAge)},${sqlLiteral(payload.applicantGender)},${sqlLiteral(payload.contact)},${sqlLiteral(payload.contactNormalized)},${payload.hasChengduHome ? 'TRUE' : 'FALSE'},${sqlLiteral(payload.experience)},${sqlLiteral(payload.familyAgreement)},${sqlLiteral(payload.otherPets)},NULLIF(${sqlLiteral(payload.note)},''),CASE WHEN ${sqlLiteral(payload.applicationType)}='预约申请' THEN '已登记' ELSE '未处理' END,NULLIF(${sqlLiteral(payload.sourceIpHash)},''),NULLIF(${sqlLiteral(payload.browserTokenHash)},''),to_timestamp(${Number(payload.submittedAtMs)}/1000.0),NULLIF(${sqlLiteral(payload.editTokenHash)},''),to_timestamp(${Number(payload.editTokenExpiresAtMs)}/1000.0) FROM decision WHERE message IS NULL RETURNING id), new_rates AS (INSERT INTO public.rate_limit_events (id,event_kind,key_hash) SELECT event_id,'application_submit',key_hash FROM (VALUES ${rateValues}) AS item(event_id,key_hash) CROSS JOIN new_application), new_event AS (INSERT INTO public.application_events (id,application_id,event_type,actor_uid,detail) SELECT ${sqlLiteral(payload.eventId)},${sqlLiteral(payload.applicationId)},'submitted',NULLIF(${sqlLiteral(payload.actorUid)},''),jsonb_build_object('applicationType',${sqlLiteral(payload.applicationType)}) FROM new_application) SELECT CASE WHEN message IS NULL THEN jsonb_build_object('ok',true,'applicationId',${sqlLiteral(payload.applicationId)},'petName',name) ELSE jsonb_build_object('ok',false,'message',message) END AS result FROM decision`;
  return sqlResult(await executePgSql(sql, secret));
}
async function submitApplication(event, context) {
  if (text(event.website, 50)) throw new Error('提交未通过验证。');
  const startedAt = Number(event.formStartedAt || 0);
  const elapsed = Date.now() - startedAt;
  if (!Number.isFinite(startedAt) || startedAt <= 0 || elapsed < 2500 || elapsed > 24 * 60 * 60 * 1000) throw new Error('请重新填写后再提交。');
  const kind = text(event.applicationType, 30);
  if (!['正式领养申请', '预约申请'].includes(kind)) throw new Error('申请类型无效。');
  const { applicantName, age, gender, contact, contactNormalized, experience, familyAgreement, otherPets } = applicantFields(event);
  const { uid, ip } = contextInfo(context);
  const browserToken = text(event.browserToken, 180);
  const ipHash = ip ? hash(ip) : '';
  const browserHash = browserToken ? hash(browserToken) : '';
  const rateKeys = applicationRateKeys({ ip, browserToken, contactNormalized });
  const recentRateKeys = applicationRateKeys({ browserToken, contactNormalized }, false);
  if (!rateKeys.length) throw new Error('无法验证提交来源，请刷新页面后重试。');
  const petId = text(event.petId, 100);
  const submittedAtMs = Date.now();
  const applicationId = id('application');
  const eventId = id('event');
  const rateEventIds = rateKeys.map(() => id('rate'));
  // 修改令牌：明文只在这次响应里返回给提交申请的浏览器，数据库只保存哈希，24 小时有效。
  const editToken = crypto.randomBytes(32).toString('base64url');
  const editTokenHash = hash(editToken);
  const editTokenExpiresAtMs = submittedAtMs + 24 * 60 * 60 * 1000;
  const secret = await resolveSecret();
  const result = await submitApplicationRecord(
    {
      applicationId,
      eventId,
      rateEventIds,
      rateKeys,
      recentRateKeys,
      petId,
      applicationType: kind,
      applicantName,
      applicantAge: age,
      applicantGender: gender,
      contact,
      contactNormalized,
      hasChengduHome: event.hasChengduHome,
      experience,
      familyAgreement,
      otherPets,
      note: text(event.note, 1000),
      sourceIpHash: ipHash,
      browserTokenHash: browserHash,
      actorUid: uid || '',
      submittedAtMs,
      editTokenHash,
      editTokenExpiresAtMs
    },
    secret
  );
  if (!result?.ok) throw new Error(result?.message || '申请提交失败，请稍后再试。');
  const application = {
    id: result.applicationId,
    pet_id: petId,
    pet_name: result.petName || '',
    application_type: kind,
    submitted_at: new Date(submittedAtMs).toISOString(),
    applicant_name: applicantName,
    applicant_age: age,
    applicant_gender: gender,
    contact,
    has_chengdu_home: event.hasChengduHome,
    experience,
    family_agreement: familyAgreement,
    other_pets: otherPets,
    note: text(event.note, 1000)
  };
  // 两个分支（try 成功 / catch 兜底）都会给这两个变量赋值，
  // 因此不设初值 —— 设了也永远不会被读到，反而容易让人误以为有「默认已发送」的语义。
  let notification;
  let notifyReason;
  try {
    notification = await notifyWeCom(application, secret);
    notifyReason = notification.reason || '已发送';
  } catch (error) {
    // 详细原因只记录给管理员看；返回给访客的提示保持通用，不暴露内部细节。
    console.error(error);
    notifyReason = error.message;
    notification = { sent: false, reason: '提醒未送达，但申请已保存。' };
  }
  if (!notification.skipped) await recordWeComOutcome(secret, notification.sent, notifyReason);
  return { ok: true, applicationId: application.id, editToken, editTokenExpiresAt: new Date(editTokenExpiresAtMs).toISOString(), notification };
}
/**
 * 申请人可自行修改的字段（白名单）。
 * 明确不包含：意向宠物 pet_id、申请类型 application_type、内部状态 internal_status、
 * 管理员备注 internal_note、以及任何令牌字段。
 */
const EDITABLE_COLUMNS = ['applicant_name', 'applicant_age', 'applicant_gender', 'contact', 'contact_normalized', 'has_chengdu_home', 'experience', 'family_agreement', 'other_pets', 'note'];

/** 校验并归一化申请资料字段；提交与修改共用，保证两边规则一致。 */
function applicantFields(event) {
  const applicantName = text(event.name, 40);
  const age = Number(event.age);
  const gender = text(event.gender, 20);
  const contact = text(event.contact, 120);
  const contactNormalized = normalizeContact(contact);
  const experience = text(event.experience, 100);
  const familyAgreement = text(event.familyAgreement, 100);
  const otherPets = text(event.otherPets, 100);
  if (
    !applicantName ||
    !contactNormalized ||
    !Number.isInteger(age) ||
    age < 18 ||
    age > 100 ||
    !allowedApplicantGenders.has(gender) ||
    typeof event.hasChengduHome !== 'boolean' ||
    !allowedExperience.has(experience) ||
    !allowedFamilyAgreement.has(familyAgreement) ||
    !allowedOtherPets.has(otherPets)
  )
    throw new Error('请完整填写申请资料。');
  return { applicantName, age, gender, contact, contactNormalized, experience, familyAgreement, otherPets, hasChengduHome: event.hasChengduHome, note: text(event.note, 1000) };
}
function editTokenHashOf(event) {
  const token = text(event.token, 200);
  if (!token) throw new Error('请填写修改令牌。');
  return hash(token);
}
/** 用修改令牌取回自己的申请资料，供修改表单预填。令牌本身就是凭证，无需其它身份。 */
async function lookupApplication(event, secret) {
  const tokenHash = editTokenHashOf(event);
  const sql = `SELECT COALESCE((SELECT jsonb_build_object('ok', TRUE, 'applicationId', id, 'petId', pet_id, 'applicationType', application_type, 'name', applicant_name, 'age', applicant_age, 'gender', applicant_gender, 'contact', contact, 'hasChengduHome', has_chengdu_home, 'experience', experience, 'familyAgreement', family_agreement, 'otherPets', other_pets, 'note', COALESCE(note, ''), 'expiresAt', edit_token_expires_at) FROM public.applications WHERE edit_token_hash = ${sqlLiteral(tokenHash)} AND edit_token_expires_at > NOW() LIMIT 1), jsonb_build_object('ok', FALSE, 'message', '修改令牌无效或已过期，请联系管理员。')) AS result`;
  return sqlResult(await executePgSql(sql, secret));
}
/**
 * 按令牌就地修改原申请，不新增第二条记录。
 * 事件日志只记录「改了哪些字段」，不记录任何字段值，避免隐私进入事件表。
 */
async function editApplication(event, secret) {
  const tokenHash = editTokenHashOf(event);
  const fields = applicantFields(event);
  const sql = `WITH target AS (SELECT id FROM public.applications WHERE edit_token_hash = ${sqlLiteral(tokenHash)} AND edit_token_expires_at > NOW() LIMIT 1), decision AS (SELECT CASE WHEN EXISTS (SELECT 1 FROM target) THEN NULL ELSE '修改令牌无效或已过期，请联系管理员。' END AS message), updated AS (UPDATE public.applications SET applicant_name=${sqlLiteral(fields.applicantName)},applicant_age=${Number(fields.age)},applicant_gender=${sqlLiteral(fields.gender)},contact=${sqlLiteral(fields.contact)},contact_normalized=${sqlLiteral(fields.contactNormalized)},has_chengdu_home=${fields.hasChengduHome ? 'TRUE' : 'FALSE'},experience=${sqlLiteral(fields.experience)},family_agreement=${sqlLiteral(fields.familyAgreement)},other_pets=${sqlLiteral(fields.otherPets)},note=NULLIF(${sqlLiteral(fields.note)},''),updated_at=NOW() WHERE id IN (SELECT id FROM target) AND (SELECT message FROM decision) IS NULL RETURNING id), ev AS (INSERT INTO public.application_events (id, application_id, event_type, actor_uid, detail) SELECT ${sqlLiteral(id('event'))}, id, 'applicant_updated', NULL, jsonb_build_object('fields', ${sqlLiteral(JSON.stringify(EDITABLE_COLUMNS))}::jsonb) FROM updated) SELECT CASE WHEN (SELECT message FROM decision) IS NULL THEN jsonb_build_object('ok', TRUE, 'applicationId', (SELECT id FROM updated)) ELSE jsonb_build_object('ok', FALSE, 'message', (SELECT message FROM decision)) END AS result`;
  return sqlResult(await executePgSql(sql, secret));
}
/**
 * 申请收件箱。
 *
 * 同样走特权通道：app.rdb() 是匿名身份，读不了 applications / yard_administrators。
 */
async function adminInbox(context) {
  await requireAdmin(context);
  const response = await executePgSql(
    `SELECT jsonb_build_object('rows', COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.submitted_at DESC), '[]'::jsonb)) AS result
       FROM (
         SELECT a.*, COALESCE(p.name, '') AS pet_name
           FROM public.applications a
           LEFT JOIN public.pets p ON p.id = a.pet_id
          ORDER BY a.submitted_at DESC
          LIMIT 200
       ) t`,
    await resolveSecret()
  );
  const payload = sqlResult(response);
  return Array.isArray(payload?.rows) ? payload.rows : [];
}
async function updateApplication(event, context) {
  const uid = await requireAdmin(context);
  const status = text(event.status, 50);
  if (!allowedStatuses.has(status)) throw new Error('无效的申请状态。');
  const applicationId = text(event.applicationId, 120);
  const resolved = ['已通过', '暂不考虑'].includes(status);
  const sql = `WITH updated AS (
      UPDATE public.applications
         SET internal_status = ${sqlLiteral(status)},
             internal_note = ${sqlLiteral(text(event.note, 2000))},
             updated_at = NOW()${resolved ? ', resolved_at = NOW()' : ''}
       WHERE id = ${sqlLiteral(applicationId)}
       RETURNING id
    ), ev AS (
      INSERT INTO public.application_events (id, application_id, event_type, actor_uid, detail)
      SELECT ${sqlLiteral(id('event'))}, id, 'status_updated', ${sqlLiteral(uid)},
             jsonb_build_object('status', ${sqlLiteral(status)})
        FROM updated
    )
    SELECT jsonb_build_object('updated', (SELECT count(*) FROM updated)) AS result`;
  const payload = sqlResult(await executePgSql(sql, await resolveSecret()));
  if (!(Number(payload?.updated) > 0)) throw new Error('没有找到这条申请，可能已经被删除，请刷新后台后重试。');
  return { ok: true };
}
async function adminSavePet(event, context) {
  await requireAdmin(context);
  const pet = event.pet || {};
  const petId = text(pet.id, 100) || id('pet');
  const petType = text(pet.petType, 10);
  const adoptionStatus = text(pet.adoptionStatus, 30);
  const gender = text(pet.gender, 4);
  if (!text(pet.name, 60) || !allowedPetTypes.has(petType) || !allowedPetStatuses.has(adoptionStatus) || !allowedGenders.has(gender)) throw new Error('请完整填写宠物名称、种类、性别和状态。');
  const tags = Array.isArray(pet.tags)
    ? pet.tags
        .map(item => text(item, 40))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const sql = `WITH saved AS (
      INSERT INTO public.pets (id, name, pet_type, adoption_status, gender, age_text, tags,
                               description, health, requirements, pause_reason, is_published, updated_at)
      VALUES (${sqlLiteral(petId)}, ${sqlLiteral(text(pet.name, 60))}, ${sqlLiteral(petType)},
              ${sqlLiteral(adoptionStatus)}, ${sqlLiteral(gender)}, ${sqlLiteral(text(pet.ageText, 60))},
              ${sqlTextArray(tags)}, ${sqlLiteral(text(pet.description, 2000))},
              ${sqlLiteral(text(pet.health, 2000))}, ${sqlLiteral(text(pet.requirements, 2000))},
              ${pet.pauseReason ? sqlLiteral(text(pet.pauseReason, 2000)) : 'NULL'},
              ${pet.isPublished !== false ? 'TRUE' : 'FALSE'}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, pet_type = EXCLUDED.pet_type, adoption_status = EXCLUDED.adoption_status,
        gender = EXCLUDED.gender, age_text = EXCLUDED.age_text, tags = EXCLUDED.tags,
        description = EXCLUDED.description, health = EXCLUDED.health, requirements = EXCLUDED.requirements,
        pause_reason = EXCLUDED.pause_reason, is_published = EXCLUDED.is_published, updated_at = NOW()
      RETURNING id
    )
    SELECT jsonb_build_object('id', (SELECT id FROM saved)) AS result`;
  const payload = sqlResult(await executePgSql(sql, await resolveSecret()));
  return { ok: true, petId: payload?.id || petId };
}
async function adminSaveSettings(event, context) {
  await requireAdmin(context);
  const key = text(event.key, 80);
  if (!['public_contact', 'application_policy'].includes(key)) throw new Error('不允许修改该设置。');
  const sql = `WITH saved AS (
      INSERT INTO public.yard_settings (key, value, updated_at)
      VALUES (${sqlLiteral(key)}, ${sqlLiteral(JSON.stringify(event.value || {}))}::jsonb, NOW())
      ON CONFLICT (key) DO UPDATE
        SET value = public.yard_settings.value || EXCLUDED.value, updated_at = NOW()
      RETURNING key
    )
    SELECT jsonb_build_object('key', (SELECT key FROM saved)) AS result`;
  sqlResult(await executePgSql(sql, await resolveSecret()));
  return { ok: true };
}

/**
 * 读取大模型 API Key。优先级与 ai-stream 保持一致：环境变量 > 数据库。
 * 结果在实例内缓存 60 秒，避免每次摘要都多一次数据库查询。
 */
let cachedAiKey = null;
let cachedAiKeyAt = 0;
async function resolveAiKey() {
  const fromEnv = text(process.env.DEEPSEEK_API_KEY, 200);
  if (fromEnv) return fromEnv;
  if (cachedAiKey !== null && Date.now() - cachedAiKeyAt < 60000) return cachedAiKey;
  try {
    const response = await executePgSql(
      "SELECT jsonb_build_object('key', COALESCE((SELECT value->>'apiKey' FROM public.yard_settings WHERE key='ai_config' LIMIT 1), '')) AS result",
      await resolveSecret()
    );
    cachedAiKey = text(sqlResult(response)?.key, 200);
  } catch {
    cachedAiKey = '';
  }
  cachedAiKeyAt = Date.now();
  return cachedAiKey;
}

/**
 * TokenHub 向量接口（官方文档核实过的规格）。
 *   文本     POST https://tokenhub.tencentmaas.com/v1/embeddings
 *   多模态   POST https://tokenhub.tencentmaas.com/v1/embeddings/multimodal
 *   鉴权     Authorization: Bearer <API_KEY>（OpenAI 兼容）
 *
 * 维度固定、不可自定义：0.6b=1024、4b=2560、vl-2b=2048、vl-8b=4096。
 * 文本选 0.6b 的理由：pgvector 的 ANN 索引只支持 2000 维以内，
 * 1024 维能建 HNSW 索引，2560 维只能全表精确扫描——规模一大反而更慢。
 */
const TOKENHUB_BASE = 'https://tokenhub.tencentmaas.com/v1';
const EMBEDDING_MODEL = process.env.TOKENHUB_EMBEDDING_MODEL || 'kinfra-text-embedding-0.6b';

/** 余弦相似度。用于自检时判断"语义方向对不对"，不做任何业务决策。 */
function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator ? dot / denominator : 0;
}

/**
 * AI 配置自检（管理员）。
 *
 * 目的：管理员换完 Key 之后能立刻知道"到底通没通"，而不用等访客提问才发现。
 *
 * 安全：**只返回结论，绝不回显任何密钥内容**；测试用的是固定字符串，
 * 不涉及任何申请人数据。因此这个动作即使被反复调用也不会泄露信息。
 */
async function diagnoseAiConfig(context) {
  await requireAdmin(context);
  const payload = sqlResult(
    await executePgSql(
      `SELECT jsonb_build_object(
       'deepseek', COALESCE((SELECT value->>'apiKey' FROM public.yard_settings WHERE key='ai_config' LIMIT 1), ''),
       'tokenhub', COALESCE((SELECT value->>'tokenhubApiKey' FROM public.yard_settings WHERE key='ai_config' LIMIT 1), ''),
       'petCount', (SELECT count(*) FROM public.pets WHERE is_published = TRUE),
       'photoCount', (SELECT count(*) FROM public.pet_media WHERE is_public = TRUE)
     ) AS result`,
      await resolveSecret()
    )
  );
  const config = payload || {};
  const report = {
    ok: true,
    deepseek: { configured: Boolean(config.deepseek) },
    tokenhub: { configured: Boolean(config.tokenhub) },
    corpus: { publishedPets: Number(config.petCount) || 0, publicPhotos: Number(config.photoCount) || 0 },
    embedding: null
  };
  if (!config.tokenhub) {
    report.embedding = { ok: false, message: '尚未配置 TokenHub Key，宠物检索暂时只能按关键词匹配。' };
    return report;
  }

  // 语义方向的冒烟测试：前两句都是领养场景，第三句无关。
  // 正确的模型应当让"相关 vs 相关"的相似度明显高于"相关 vs 无关"。
  const samples = ['我住在成都，租的房子，房东同意养猫', '家里有封窗，白天基本有人在家', '今天股市大跌，我很担心'];
  const startedAt = Date.now();
  try {
    const response = await fetch(`${TOKENHUB_BASE}/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.tokenhub}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: samples, encoding_format: 'float' })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      report.embedding = { ok: false, status: response.status, message: text(data?.error?.message || data?.message || `接口返回 ${response.status}`, 200) };
      return report;
    }
    const vectors = (data?.data || []).map(item => item.embedding).filter(item => Array.isArray(item) && item.length);
    if (vectors.length < samples.length) {
      report.embedding = { ok: false, message: `接口只返回了 ${vectors.length} 条向量，期望 ${samples.length} 条。` };
      return report;
    }
    const related = cosineSimilarity(vectors[0], vectors[1]);
    const unrelated = cosineSimilarity(vectors[0], vectors[2]);
    report.embedding = {
      ok: true,
      model: EMBEDDING_MODEL,
      dimension: vectors[0].length,
      totalTokens: Number(data?.usage?.total_tokens) || null,
      elapsedMs: Date.now() - startedAt,
      relatedScore: Number(related.toFixed(4)),
      unrelatedScore: Number(unrelated.toFixed(4)),
      semanticDirectionCorrect: related > unrelated
    };
  } catch (error) {
    report.embedding = { ok: false, message: text(error.message, 200) };
  }
  return report;
}

/**
 * 条件比对兜底：没有模型（或模型失败）时用规则给出初步结果，
 * 保证管理员的功能不会整体失效——只是精度下降，并如实标注来源。
 */
function ruleBasedFit(application, pet) {
  const requirements = text(pet?.requirements, 1000);
  const haystack = `${text(application.note, 1000)} ${text(application.family, 50)}`;
  const checks = [
    ['家庭成员意见', application.family === '全部同意' ? '满足' : application.family === '尚未沟通' ? '缺失' : '需确认', `申请填写：${text(application.family, 20) || '未填写'}`],
    ['成都及周边住所', application.home === true ? '满足' : '缺失', '关系到能否就近回访'],
    ['养宠经验', application.experience && application.experience !== '没有' ? '满足' : '需确认', `申请填写：${text(application.experience, 20) || '未填写'}`],
    ['现有宠物相处', text(application.otherPets, 20) && application.otherPets !== '没有' ? '需确认' : '满足', `申请填写：${text(application.otherPets, 20) || '未填写'}`],
    ['封窗／防护', /封窗|防护|纱窗/.test(haystack) ? '满足' : /封窗|防护/.test(requirements) ? '缺失' : '未提及', '养猫尤其需要确认']
  ];
  return checks.map(([label, status, note]) => ({ label, status, note }));
}

/**
 * AI 申请摘要与条件比对（管理员侧）。
 *
 * 定位：**只做信息整理与提示，不做录取决定**，决定权始终在管理员。
 * 只把「这条申请 + 这只宠物的领养要求」发给模型，不含其它申请人数据。
 */
/**
 * 管理员侧审核工具集。
 *
 * ── 为什么需要 ────────────────────────────────────────────────
 * 改造前是一次性摘要：把申请和宠物要求拼进提示词，让模型直接输出结论。
 * 问题在于模型"看到什么就只能答什么"——它没法去查
 * 「这个人有没有在别处也投过」「这只宠物以前被谁养过、后来怎么样」。
 *
 * ── 隐私边界（重要）───────────────────────────────────────────
 * 这些工具会碰到其他申请人的数据。**只把「当前这位申请人」的
 * 姓名与联系方式作为查询条件，不把其他人的姓名和联系方式写进模型上下文**——
 * 查同一人是否重复投递时，返回的是宠物名、时间、状态，不含联系方式。
 * 管理员本来就知道自己在审谁，多喂一份他人隐私没有必要。
 */
const REVIEW_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_pet_profile',
      description: '读取意向宠物的完整档案：年龄、健康情况、性格描述、领养要求、当前领养状态。核对待领养要求时使用。',
      parameters: { type: 'object', properties: { petId: { type: 'string', description: '宠物编号' } }, required: ['petId'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'find_related_applications',
      description: '查同一位申请人（按联系方式匹配）在小院投递过的其它申请，用于识别「广撒网」或此前已申请过的情况。返回宠物名、提交时间与处理状态，**不含任何联系方式**。',
      parameters: {
        type: 'object',
        properties: { contactNormalized: { type: 'string', description: '当前申请人的联系方式（已归一化）' } },
        required: ['contactNormalized']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pet_follow_ups',
      description: '读取意向宠物的历史回访与近况记录。判断这只宠物此前是否被领养过、结果如何时使用。',
      parameters: { type: 'object', properties: { petId: { type: 'string', description: '宠物编号' } }, required: ['petId'] }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_pet_application_stats',
      description: '查这只宠物收到的申请总数与各状态分布。用于判断竞争程度、以及管理员是否已处理过其它申请。',
      parameters: { type: 'object', properties: { petId: { type: 'string', description: '宠物编号' } }, required: ['petId'] }
    }
  }
];

/** Agent 最多进行几轮工具调用。最后一轮不再给工具，强制收口。 */
const MAX_REVIEW_ROUNDS = 3;
const MAX_REVIEW_TOOL_CHARS = 6000;

/** 执行一个审核工具。永不抛错：异常转成可读结果交给模型继续。 */
async function runReviewTool(name, rawArguments, secret) {
  // 不设初值：参数解析失败会直接 return，初值永远读不到
  let args;
  try {
    args = typeof rawArguments === 'string' ? JSON.parse(rawArguments || '{}') : rawArguments || {};
  } catch {
    return { ok: false, message: '工具参数不是合法 JSON。' };
  }
  const petId = text(args.petId, 80);
  try {
    if (name === 'get_pet_profile') {
      if (!petId) return { ok: false, message: '缺少宠物编号。' };
      const payload = sqlResult(
        await executePgSql(
          `SELECT COALESCE((
          SELECT jsonb_build_object('name', name, 'type', pet_type, 'status', adoption_status,
            'gender', gender, 'age', age_text, 'tags', tags,
            'description', description, 'health', health, 'requirements', requirements,
            'pauseReason', pause_reason)
          FROM public.pets WHERE id = ${sqlLiteral(petId)} LIMIT 1
        ), 'null'::jsonb) AS result`,
          secret
        )
      );
      return payload && payload.name ? { ok: true, pet: payload } : { ok: false, message: '没有找到这只宠物。' };
    }

    if (name === 'find_related_applications') {
      const contact = text(args.contactNormalized, 120);
      if (!contact) return { ok: false, message: '缺少联系方式。' };
      // 刻意只取宠物名、时间、状态，不取联系方式与他人姓名
      const payload = sqlResult(
        await executePgSql(
          `SELECT jsonb_build_object(
          'total', count(*),
          'items', COALESCE(jsonb_agg(jsonb_build_object(
            'petName', COALESCE(p.name, ''), 'submittedAt', a.submitted_at::text,
            'status', a.internal_status, 'applicationType', a.application_type
          ) ORDER BY a.submitted_at DESC), '[]'::jsonb)
        ) AS result
        FROM public.applications a LEFT JOIN public.pets p ON p.id = a.pet_id
        WHERE a.contact_normalized = ${sqlLiteral(contact)}`,
          secret
        )
      );
      return { ok: true, total: Number(payload?.total) || 0, items: payload?.items || [] };
    }

    if (name === 'get_pet_follow_ups') {
      if (!petId) return { ok: false, message: '缺少宠物编号。' };
      const payload = sqlResult(
        await executePgSql(
          `SELECT jsonb_build_object('updates', COALESCE(jsonb_agg(jsonb_build_object(
            'date', update_date::text, 'title', title, 'body', body
          ) ORDER BY update_date DESC), '[]'::jsonb)) AS result
          FROM (SELECT update_date, title, body FROM public.pet_updates WHERE pet_id = ${sqlLiteral(petId)} ORDER BY update_date DESC LIMIT 10) t`,
          secret
        )
      );
      return { ok: true, total: (payload?.updates || []).length, updates: payload?.updates || [] };
    }

    if (name === 'get_pet_application_stats') {
      if (!petId) return { ok: false, message: '缺少宠物编号。' };
      const payload = sqlResult(
        await executePgSql(
          `SELECT jsonb_build_object(
          'total', count(*),
          'byStatus', COALESCE(jsonb_object_agg(internal_status, n), '{}'::jsonb)
        ) AS result FROM (
          SELECT internal_status, count(*) AS n FROM public.applications
          WHERE pet_id = ${sqlLiteral(petId)} GROUP BY internal_status
        ) s CROSS JOIN LATERAL (SELECT 1) _`,
          secret
        )
      );
      // jsonb_object_agg 在零行时会是 NULL，这里补一下总数
      const total = Number(payload?.total) || 0;
      return { ok: true, total, byStatus: payload?.byStatus || {} };
    }

    return { ok: false, message: `没有名为 ${name} 的工具。` };
  } catch (error) {
    return { ok: false, message: `工具执行失败：${text(error.message, 150)}` };
  }
}

/** 工具名 → 给管理员看的一行说明，让他知道 AI 都查了什么。 */
const REVIEW_TOOL_LABELS = {
  get_pet_profile: '读取意向宠物档案',
  find_related_applications: '查该申请人是否重复投递',
  get_pet_follow_ups: '查该宠物的回访记录',
  get_pet_application_stats: '统计该宠物的申请情况'
};

/**
 * 非流式调用模型（管理员侧不需要流式：结果是一次性 JSON，不是逐字阅读）。
 * 返回正文与工具调用。
 */
async function callReviewModel(convo, tools, apiKey) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      stream: false,
      temperature: 0.2,
      max_tokens: 1200,
      messages: convo,
      ...(tools ? { tools, tool_choice: 'auto' } : {})
    })
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`模型返回 ${response.status}${detail ? `：${text(detail, 120)}` : ''}`);
  }
  const data = await response.json();
  const message = data?.choices?.[0]?.message || {};
  return { content: text(message.content, 4000), toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [] };
}

/**
 * 审核 Agent：模型自己决定查什么、查几次，最后输出结构化结论。
 * 返回 { content, steps }，steps 用于在页面上展示"AI 查了哪些东西"。
 */
async function runReviewAgent(detail, apiKey, secret) {
  const systemPrompt = `你是流浪动物救助站的管理员助手。管理员要逐条核对领养申请与宠物的领养要求。
你可以调用工具查询小院的真实数据。**凡涉及该申请人的历史投递、该宠物的回访记录或申请竞争情况，先查再答**，不要凭印象。
只依据查到的信息整理，**不要编造申请人没有提供的内容**；信息缺失就明确写「未提及」。
最后只输出 JSON 对象，不要任何额外文字，格式：
{"headline":"一句话概括这位申请人（40字内）","fit":[{"label":"核对项","status":"满足|缺失|未提及|需确认","note":"依据"}],"questions":["电话沟通建议问的问题，1-3条"],"caution":"最需要注意的一个风险点，一句话"}`;

  const convo = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `【待审核的申请】${JSON.stringify(detail.applicant)}\n【意向宠物】${JSON.stringify(detail.pet)}\n（宠物编号：${text(detail.petId, 80) || '未知'}）`
    }
  ];
  const steps = [];

  for (let round = 1; round <= MAX_REVIEW_ROUNDS; round += 1) {
    const withTools = round < MAX_REVIEW_ROUNDS;
    const reply = await callReviewModel(convo, withTools ? REVIEW_TOOLS : null, apiKey);
    if (!reply.toolCalls.length) return { content: reply.content, steps };

    convo.push({ role: 'assistant', content: reply.content || null, tool_calls: reply.toolCalls });
    for (const call of reply.toolCalls) {
      const name = text(call.function?.name, 40);
      const result = await runReviewTool(name, call.function?.arguments, secret);
      steps.push({
        tool: name,
        label: REVIEW_TOOL_LABELS[name] || name,
        ok: result?.ok !== false,
        summary: result?.ok === false ? text(result.message, 80) : ''
      });
      convo.push({
        role: 'tool',
        tool_call_id: text(call.id, 80) || `call_${round}`,
        content: JSON.stringify(result).slice(0, MAX_REVIEW_TOOL_CHARS)
      });
    }
  }
  // 轮次用尽仍未收口：再要一次结论，这次不给工具
  const finalReply = await callReviewModel(convo, null, apiKey);
  return { content: finalReply.content, steps };
}

/**
 * 把 AI 摘要写回申请记录。
 *
 * 顺带记下生成时这条申请的 updated_at，作为"新鲜度"的判据：
 * 资料改过之后旧摘要的依据就变了，界面据此提示重新生成。
 *
 * 保存失败不影响本次返回——摘要已经算出来了，没理由因为写库失败就不给管理员看。
 * 返回生成时间；写库失败时返回 null，前端会照常显示但不会标记为"已保存"。
 */
async function saveApplicationSummary(applicationId, result, secret) {
  try {
    const response = await executePgSql(
      `WITH updated AS (
         UPDATE public.applications SET
           ai_summary = ${sqlLiteral(JSON.stringify(result))}::jsonb,
           ai_summary_at = NOW(),
           ai_summary_source_updated_at = updated_at
         WHERE id = ${sqlLiteral(applicationId)}
         RETURNING ai_summary_at::text AS saved_at
       ) SELECT jsonb_build_object('savedAt', (SELECT saved_at FROM updated)) AS result`,
      secret
    );
    return sqlResult(response)?.savedAt || null;
  } catch (error) {
    console.error('保存 AI 摘要失败：', error.message);
    return null;
  }
}

async function summarizeApplication(event, context) {
  await requireAdmin(context);
  const applicationId = text(event.applicationId, 120);
  if (!applicationId) throw new Error('缺少申请编号。');

  const payload = sqlResult(
    await executePgSql(
      `SELECT COALESCE((
       SELECT jsonb_build_object(
         'applicant', jsonb_build_object(
           'name', a.applicant_name, 'age', a.applicant_age, 'gender', a.applicant_gender,
           'type', a.application_type, 'home', a.has_chengdu_home, 'experience', a.experience,
           'family', a.family_agreement, 'otherPets', a.other_pets, 'note', a.note),
         'pet', jsonb_build_object(
           'name', p.name, 'type', p.pet_type, 'status', p.adoption_status,
           'age', p.age_text, 'health', p.health, 'requirements', p.requirements),
         'petId', a.pet_id,
         'contactNormalized', a.contact_normalized,
         'cached', a.ai_summary,
         'cachedAt', a.ai_summary_at::text,
         'cachedFor', a.ai_summary_source_updated_at::text,
         'currentUpdatedAt', a.updated_at::text
       )
       FROM public.applications a
       LEFT JOIN public.pets p ON p.id = a.pet_id
       WHERE a.id = ${sqlLiteral(applicationId)}
       LIMIT 1
     ), 'null'::jsonb) AS result`,
      await resolveSecret()
    )
  );
  const detail = payload?.applicant ? payload : null;
  if (!detail) throw new Error('没有找到这条申请，可能已经被删除，请刷新后台后重试。');
  const fallbackHeadline = `${text(detail.applicant.name, 20) || '申请人'} · 意向「${text(detail.pet?.name, 20) || '未知'}」`;

  /**
   * 摘要是要重复看的东西，不能算完就丢。
   *
   * 这里先看有没有**仍然新鲜**的旧摘要：申请资料没被改过（updated_at 未变）
   * 就直接复用，既省下一次模型调用，管理员也不用再等十几秒。
   * 资料改过之后旧摘要的依据已经变了，必须重新生成，界面也会提示。
   * 管理员想强制重算时传 force。
   */
  const cacheFresh = Boolean(detail.cached) && String(detail.cachedFor || '') === String(detail.currentUpdatedAt || '');
  if (cacheFresh && event.force !== true) {
    return { ok: true, cached: true, cachedAt: detail.cachedAt, ...detail.cached };
  }

  const apiKey = await resolveAiKey();
  if (!apiKey) {
    return {
      ok: true,
      mock: true,
      mode: '演示模式（未配置模型 Key，以下为规则比对结果）',
      summary: {
        headline: fallbackHeadline,
        fit: ruleBasedFit(detail.applicant, detail.pet),
        questions: ['居住地是否允许养宠（租房请确认房东态度）', '白天家中是否有人陪伴', '家庭成员是否全部同意'],
        caution: '尚未接入模型，以上为规则比对结果，仅供初步筛选。'
      }
    };
  }

  const secret = await resolveSecret();
  try {
    // 交给审核 Agent：它会自己决定要不要查该申请人的历史投递、该宠物的回访与竞争情况
    const review = await runReviewAgent(detail, apiKey, secret);
    const parsed = JSON.parse(text(review.content, 4000));
    if (!parsed?.headline) throw new Error('模型返回内容缺少必要字段');
    const result = {
      mock: false,
      mode: '由 AI 生成',
      steps: review.steps,
      summary: {
        headline: text(parsed.headline, 120),
        fit: Array.isArray(parsed.fit)
          ? parsed.fit.slice(0, 8).map(item => ({
              label: text(item?.label, 40),
              status: text(item?.status, 20),
              note: text(item?.note, 200)
            }))
          : [],
        questions: Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3).map(item => text(item, 200)) : [],
        caution: text(parsed.caution, 200)
      }
    };
    // 存下来供下次直接复用。只存真实模型结果——规则兜底的结果本来就便宜，
    // 存起来反而会让人误以为那是模型结论。
    const savedAt = await saveApplicationSummary(applicationId, result, secret);
    return { ok: true, cached: false, cachedAt: savedAt, ...result };
  } catch (error) {
    // 模型失败不能挡住管理员干活：退回规则摘要，并如实说明原因
    return {
      ok: true,
      mock: true,
      mode: `模型调用失败（${text(error.message, 80)}），以下为规则比对结果`,
      steps: [],
      summary: {
        headline: fallbackHeadline,
        fit: ruleBasedFit(detail.applicant, detail.pet),
        questions: ['居住地是否允许养宠', '白天家中是否有人陪伴'],
        caution: '模型暂不可用，以上为规则比对结果。'
      }
    };
  }
}

/**
 * 读取 TokenHub Key（向量化与视觉理解用）。
 * 与 ai-stream 相同的优先级与缓存策略：环境变量 > 数据库，实例内缓存 60 秒。
 */
let cachedTokenhubKey = null;
let cachedTokenhubKeyAt = 0;
async function resolveTokenhubKey() {
  const fromEnv = text(process.env.TOKENHUB_API_KEY, 200);
  if (fromEnv) return fromEnv;
  if (cachedTokenhubKey !== null && Date.now() - cachedTokenhubKeyAt < 60000) return cachedTokenhubKey;
  try {
    const response = await executePgSql(
      "SELECT jsonb_build_object('key', COALESCE((SELECT value->>'tokenhubApiKey' FROM public.yard_settings WHERE key='ai_config' LIMIT 1), '')) AS result",
      await resolveSecret()
    );
    cachedTokenhubKey = text(sqlResult(response)?.key, 200);
  } catch {
    cachedTokenhubKey = '';
  }
  cachedTokenhubKeyAt = Date.now();
  return cachedTokenhubKey;
}

const TOKENHUB_CHAT_URL = 'https://tokenhub.tencentmaas.com/v1/chat/completions';
const TOKENHUB_VISION_MODEL = process.env.TOKENHUB_VISION_MODEL || 'hy-vision-2.0-instruct';

/**
 * 用视觉模型读宠物照片，生成档案描述初稿。
 *
 * 定位：**给管理员一个起点，不是替他写档案**。
 * 返回的文字会填进描述框，管理员可以随意修改——
 * 照片里看不出来的东西（性格、病史、是否亲人）AI 编不出来，也不该编。
 */
async function describePetPhoto(event, context) {
  await requireAdmin(context);
  const image = text(event.image, 1200000);
  if (!image.startsWith('data:image/')) throw new Error('请提供图片数据。');
  const apiKey = await resolveTokenhubKey();
  if (!apiKey) throw new Error('尚未配置 TokenHub Key，无法识别照片。');

  const species = text(event.species, 10);
  const prompt = [
    '你在帮流浪动物救助站的管理员整理宠物档案。',
    '请根据这张照片，写一段 60 字以内的中文描述，供管理员填进「简短介绍」。',
    species ? `这只动物是${species}。` : '',
    '**只描述照片里看得见的东西**：毛色与花纹、体型、耳朵与尾巴的特征、大致年龄感、精神状态、看起来是否亲人。',
    '**不要臆测性格、病史、是否绝育、是否打过疫苗**——这些照片看不出来。',
    '不要写"这只可爱的猫咪"这类套话，直接写具体特征。只输出描述本身，不要任何前后缀。'
  ]
    .filter(Boolean)
    .join('\n');

  const response = await fetch(TOKENHUB_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: TOKENHUB_VISION_MODEL,
      stream: false,
      temperature: 0.3,
      max_tokens: 300,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: image } }
          ]
        }
      ]
    })
  });
  // 上游原始信息一律带回：模型名写错、图片格式不支持这类问题，
  // 只有看到原文才知道该怎么改
  const raw = await response.text().catch(() => '');
  if (!response.ok) {
    return { ok: false, message: `视觉服务返回 ${response.status}：${text(raw, 300)}` };
  }
  // 不设初值：解析失败会直接 return，初值永远读不到
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, message: `视觉服务返回无法解析的内容：${text(raw, 200)}` };
  }
  const description = text(data?.choices?.[0]?.message?.content, 400)
    .replace(/^["「『]|["」』]$/g, '')
    .trim();
  if (!description) return { ok: false, message: '视觉服务没有返回描述内容。' };
  return { ok: true, description, model: TOKENHUB_VISION_MODEL, usage: data?.usage || null };
}

/**
 * 删除一条申请记录。
 *
 * 走云函数的特权通道（ExecutePGSql），而不是让前端直接删数据库。
 * 理由有两条：
 *   1. 与后台其它写入（改状态、存宠物、存设置）保持一致，只有删除曾走客户端；
 *   2. 删除是不可逆操作，摆在服务端能明确鉴权、能校验"确实删掉了"，
 *      也不会因为客户端的行级策略差异而静默失败。
 *
 * 注意：application_events 对 applications 是 ON DELETE CASCADE，会一并清掉。
 */
async function adminDeleteApplication(event, context) {
  await requireAdmin(context);
  const applicationId = text(event.applicationId, 120);
  if (!applicationId) throw new Error('缺少要删除的申请编号。');
  const response = await executePgSql(
    `WITH removed AS (
       DELETE FROM public.applications WHERE id = ${sqlLiteral(applicationId)} RETURNING id
     )
     SELECT jsonb_build_object('deleted', (SELECT count(*) FROM removed)) AS result`,
    await resolveSecret()
  );
  const deleted = Number(sqlResult(response)?.deleted) || 0;
  if (!deleted) throw new Error('没有找到这条申请，可能已经被删除，请刷新后台后重试。');
  return { ok: true, deleted };
}

/**
 * 统一的「可读错误」包装。
 *
 * 云函数里直接 throw，返回值会被运行时包成一句
 * `Function code exception caught (...)`，管理员在后台只会看到这串无意义的编号，
 * 真实原因（比如「没有找到这条申请」）全被盖住，排查时只能靠猜。
 *
 * 因此管理类动作统一改成返回 { ok:false, message }，
 * 把可读原因送达前端；同时不影响成功路径的返回值。
 */
async function asReadableResult(run, fallback) {
  try {
    return await run();
  } catch (error) {
    return { ok: false, message: text(error?.message || fallback, 200) };
  }
}

exports.main = async (event = {}, context = {}) => {
  const action = text(event.action, 80);
  if (action === 'health') return { ok: true, service: 'yard-api', database: 'postgresql-rdb', time: new Date().toISOString() };
  if (action === 'debug.simple') return rows(await db.from('pets').select('id,name').limit(1), '数据库连通性检查');
  if (action === 'public.bootstrap') return publicBootstrap();
  if (action === 'application.submit') {
    try {
      return await submitApplication(event, context);
    } catch (error) {
      return { ok: false, message: text(error.message || '申请提交失败，请稍后重试。', 200) };
    }
  }
  if (action === 'application.lookup') {
    try {
      return await lookupApplication(event, await resolveSecret());
    } catch (error) {
      return { ok: false, message: text(error.message || '修改令牌校验失败，请稍后再试。', 200) };
    }
  }
  if (action === 'application.edit') {
    try {
      return await editApplication(event, await resolveSecret());
    } catch (error) {
      return { ok: false, message: text(error.message || '申请修改失败，请稍后再试。', 200) };
    }
  }
  // 管理类动作统一走可读错误包装：抛异常会被运行时包成无意义编号，管理员看不到原因。
  if (action === 'admin.inbox') return asReadableResult(() => adminInbox(context), '读取申请收件箱失败。');
  if (action === 'admin.application.update') return asReadableResult(() => updateApplication(event, context), '更新申请失败。');
  if (action === 'admin.application.delete') return asReadableResult(() => adminDeleteApplication(event, context), '删除申请失败。');
  if (action === 'admin.application.summarize') return asReadableResult(() => summarizeApplication(event, context), '生成申请摘要失败。');
  if (action === 'admin.ai.diagnose') return asReadableResult(() => diagnoseAiConfig(context), 'AI 配置自检失败。');
  if (action === 'admin.pet.describePhoto') return asReadableResult(() => describePetPhoto(event, context), '识别照片失败。');
  if (action === 'admin.pet.save') return asReadableResult(() => adminSavePet(event, context), '保存宠物档案失败。');
  if (action === 'admin.settings.save') return asReadableResult(() => adminSaveSettings(event, context), '保存网站设置失败。');
  throw new Error('未知操作。');
};
