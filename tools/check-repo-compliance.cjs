/**
 * 参赛仓库合规自检。
 *
 * 对照赛事的「代码仓库」要求逐项核对，可反复运行（提交前再跑一次即可）。
 *
 * 检查内容：
 *   · 敏感信息：当前跟踪文件、未忽略的新文件 + **全部历史提交**
 *   · README 必含小节：项目介绍、技术架构、安装运行指南、团队信息
 *   · 环境配置：环境变量模板、依赖清单
 *   · 代码规范：ESLint 与 Prettier 配置
 *   · Git 记录：提交粒度、时间跨度（赛事要求"体现真实开发过程"）
 *   · 仓库整洁：遗留目录、异常大文件、误提交的依赖
 *   · 内部文档未进入公开仓库
 *
 * 用法：node tools/check-repo-compliance.cjs           （本地源码合规）
 *       node tools/check-repo-compliance.cjs --release （另外检查发布源清单）
 * 默认不要求源码已同步到 release/；发布源由委托方另行处理。
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const includeRelease = process.argv.includes('--release');
let passed = 0;
let failed = 0;
let warned = 0;

function pass(label, detail = '') {
  passed += 1;
  console.log(`  ✅ ${label}${detail ? ` —— ${detail}` : ''}`);
}
function fail(label, detail = '') {
  failed += 1;
  console.log(`  ❌ ${label}${detail ? ` —— ${detail}` : ''}`);
}
function warn(label, detail = '') {
  warned += 1;
  console.log(`  ⚠️  ${label}${detail ? ` —— ${detail}` : ''}`);
}
function check(label, ok, detail = '') {
  ok ? pass(label, detail) : fail(label, detail);
}

function git(args, options = {}) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...options }).trim();
}

/**
 * 常见密钥形态。注意这些是"形态"，不是具体值。
 *
 * JWT 单独处理：前端使用的 CloudBase **可发布密钥**本身就是 JWT，
 * 但它设计上就该公开（权限仅匿名只读）。因此不能只按"像 JWT"报警，
 * 要解开 payload 看它到底是不是管理密钥——否则会稳定误报。
 */
const SECRET_PATTERNS = [
  { name: '企业微信机器人地址', re: /qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=[A-Za-z0-9-]{8,}/ },
  { name: 'DeepSeek 风格密钥', re: /sk-[A-Za-z0-9]{24,}/ },
  { name: '腾讯云 SecretId', re: /AKID[A-Za-z0-9]{20,}/ }
];

/** 判断一个 JWT 是否是"真正的密钥"（管理/服务端角色），而不是可发布密钥。 */
function inspectJwt(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    const dangerous = payload.is_system_admin === true || payload.role === 'service_role' || payload.scope === 'admin';
    return { dangerous, role: payload.role || '(无)', platform: payload.meta?.platform || '' };
  } catch {
    return { dangerous: true, role: '无法解析' };
  }
}

console.log('参赛仓库合规自检\n');
console.log(`仓库根目录：${ROOT}\n`);

// ── 1. 敏感信息 ────────────────────────────────────────────────
console.log('【1】敏感信息');

const tracked = git(['ls-files', '-z']).split('\0').filter(Boolean);
const candidates = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean))];
const workingTreeHits = [];
const jwtNotes = [];
for (const file of candidates) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) continue;
  if (/\.(png|jpe?g|webp|gif|ico|zip|exe|pptx|pdf|woff2?)$/i.test(file)) continue;
  const content = fs.readFileSync(full, 'utf8');
  for (const { name, re } of SECRET_PATTERNS) {
    const match = content.match(re);
    // 占位提示与测试夹具不算泄露：字面量里带 ... 或 EXAMPLE 的属于文档/假值
    if (match && !/\.\.\.|EXAMPLE|FAKE|FROM_ENV|FROM_DB|YOUR_/i.test(match[0])) {
      workingTreeHits.push(`${file}：疑似${name}`);
    }
  }
  // JWT 单独判断：可发布密钥放行，管理/服务端密钥报警
  for (const match of content.matchAll(/eyJhbGciOi[A-Za-z0-9_.-]{40,}/g)) {
    const info = inspectJwt(match[0]);
    if (info.dangerous) workingTreeHits.push(`${file}：JWT 疑似管理密钥（role=${info.role}）`);
    else jwtNotes.push(`${file} 的 JWT 是 ${info.role} 角色的可发布密钥（设计上即可公开）`);
  }
}
check('当前跟踪文件和未忽略的新文件中没有真实密钥', workingTreeHits.length === 0, workingTreeHits.slice(0, 3).join('；'));
for (const note of [...new Set(jwtNotes)]) pass('JWT 已核验为可发布密钥', note);

// 历史提交同样公开，必须一并扫
const commits = git(['rev-list', '--all']).split('\n').filter(Boolean);
const historyHits = [];
for (const commit of commits) {
  // 不设初值：读取失败会 continue，初值永远读不到
  let out;
  try {
    out = execFileSync('git', ['grep', '-n', '-E', 'qyapi\\.weixin\\.qq\\.com/cgi-bin/webhook/send\\?key=[A-Za-z0-9-]{8,}|sk-[A-Za-z0-9]{24,}|AKID[A-Za-z0-9]{20,}', commit], {
      cwd: ROOT,
      encoding: 'utf8'
    });
  } catch {
    continue; // 没有匹配时 git grep 返回非零
  }
  for (const line of out.split('\n').filter(Boolean)) {
    if (/\.\.\.|EXAMPLE|FAKE|FROM_ENV|FROM_DB/.test(line)) continue;
    historyHits.push(`${commit.slice(0, 7)} ${line.slice(0, 100)}`);
  }
}
check(`全部历史提交（${commits.length} 个）中没有真实密钥`, historyHits.length === 0, historyHits.slice(0, 2).join('；'));

const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
check('.gitignore 排除了真实 .env', /^\.env$/m.test(gitignore) || /\.env\b/.test(gitignore));
check('.env.example 已提交且不含真实值', fs.existsSync(path.join(ROOT, '.env.example')));

const internalDocs = ['BUG.md', 'TIMEOFF.md', 'THE END.md', 'DEPLOY-TEST.md', '申请功能修复报告.md', '参赛方案.md', 'AI技术方案.md', '赛事官方要求.md'];
const leakedDocs = internalDocs.filter(doc => tracked.includes(doc));
check('内部工作文档未进入公开仓库', leakedDocs.length === 0, leakedDocs.join('、'));

// ── 2. README ─────────────────────────────────────────────────
console.log('\n【2】README 必含内容');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
check('项目介绍', /## 这是什么|## 介绍/.test(readme));
check('技术架构', /## 技术架构/.test(readme));
check('安装运行指南', /## 本地运行/.test(readme));
check('部署说明', /## 部署/.test(readme));
const teamSection = readme.match(/## 团队[\s\S]{0,400}/);
if (!teamSection) fail('团队信息', '缺少「团队」一节');
else if (/<!--[\s\S]*?-->/.test(teamSection[0]) && /待补|尚未组建/.test(teamSection[0])) warn('团队信息', '已留占位，组队后需补上（赛事要求该项须包含）');
else pass('团队信息');

// ── 3. 环境配置 ────────────────────────────────────────────────
console.log('\n【3】环境配置');
check('环境变量模板', fs.existsSync(path.join(ROOT, '.env.example')));
check('根依赖清单', fs.existsSync(path.join(ROOT, 'package.json')));
check('业务云函数依赖清单', fs.existsSync(path.join(ROOT, 'functions', 'yard-api', 'package.json')));
check('AI 云函数依赖清单', fs.existsSync(path.join(ROOT, 'functions', 'ai-stream', 'package.json')));
check('数据库中表结构有唯一来源（迁移目录）', fs.existsSync(path.join(ROOT, 'cloudbase', 'migrations')));

// ── 4. 代码规范 ────────────────────────────────────────────────
console.log('\n【4】代码规范');
check('ESLint 配置', fs.existsSync(path.join(ROOT, 'eslint.config.mjs')));
check('Prettier 配置', fs.existsSync(path.join(ROOT, '.prettierrc.json')));
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
check('提供 lint / format 脚本', Boolean(pkg.scripts?.lint && pkg.scripts?.format));
check('提供测试脚本', Boolean(pkg.scripts?.test && pkg.scripts?.['test:unit']));

// ── 5. Git 记录 ────────────────────────────────────────────────
console.log('\n【5】Git 提交记录');
const log = git(['log', '--pretty=format:%H|%ad|%s', '--date=short']).split('\n').filter(Boolean);
check('有提交历史', log.length > 0, `${log.length} 次提交`);

/**
 * 赛事要求「保留完整的 Git 提交历史，体现真实的开发过程」。
 *
 * 真正的反模式是**一次性把整个项目提交上去**——历史里只有一个 commit，
 * 或者首个提交就包含了绝大部分文件。这才是要拦的。
 *
 * 单次提交文件数多并不等于违规：批量格式化、依赖升级这类改动本来就会
 * 一次动很多文件。所以这里只把最大提交作为信息报出来，不做判定。
 */
const firstCommitFiles = git(['show', '--pretty=format:', '--name-only', log[log.length - 1].split('|')[0]])
  .split('\n')
  .filter(Boolean).length;
const firstShare = tracked.length ? firstCommitFiles / tracked.length : 1;
check('不是"一次性提交全部代码"', firstShare <= 0.5, `首次提交含 ${firstCommitFiles} 个文件，占当前仓库 ${(firstShare * 100).toFixed(0)}%`);

const largest = git(['log', '--pretty=format:%H', '--name-only'])
  .split('\n')
  .reduce(
    (acc, line) => {
      if (/^[0-9a-f]{40}$/.test(line)) {
        acc.current = { hash: line, files: 0 };
        acc.list.push(acc.current);
      } else if (line && acc.current) acc.current.files += 1;
      return acc;
    },
    { current: null, list: [] }
  )
  .list.sort((a, b) => b.files - a.files)[0];
pass('最大一次提交', `${largest?.files || 0} 个文件（批量改动属正常，仅作参考）`);

const dates = log.map(line => line.split('|')[1]).sort();
const span = (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / 86400000;
pass('提交时间跨度', `${dates[0]} 至 ${dates[dates.length - 1]}，约 ${Math.round(span)} 天`);

const subjects = log.map(line => line.split('|')[2]);
check('提交信息有类型前缀（feat/fix/docs 等）', subjects.filter(s => /^(feat|fix|docs|chore|test|style|refactor)(\(.+\))?:/.test(s)).length >= subjects.length - 2);

// ── 6. 仓库整洁 ────────────────────────────────────────────────
console.log('\n【6】仓库整洁度');
const clutter = [
  ['.cloudfn-backup', '修复前的云端函数源码留存，对评审是"看不懂的历史包袱"'],
  ['web', '已放弃的 Vue 实验'],
  ['ppt', '不属于本站的产出物'],
  ['新建文件夹', '系统残留目录'],
  ['node_modules', '依赖目录不应入库']
];
for (const [dir, why] of clutter) {
  const hits = tracked.filter(f => f.startsWith(`${dir}/`));
  check(`未提交 ${dir}/`, hits.length === 0, hits.length ? `${why}（${hits.length} 个文件）` : '');
}

const big = tracked
  .map(file => {
    const full = path.join(ROOT, file);
    return fs.existsSync(full) ? { file, size: fs.statSync(full).size } : null;
  })
  .filter(Boolean)
  .filter(item => item.size > 12 * 1024 * 1024)
  .sort((a, b) => b.size - a.size);
check(
  '没有超过 12 MB 的文件（文档类交付物本身较大）',
  big.length === 0,
  big
    .slice(0, 3)
    .map(item => `${item.file} ${(item.size / 1048576).toFixed(1)}MB`)
    .join('；')
);

if (includeRelease) {
  // 保留发布检查，只有委托方的显式发布验收才要求源码与发布源清单同步。
  //
  // 站点清单改为自动扫描根目录，不再写死文件名。这里原先只列了
  // app.js / site-config.js / styles.css，站点新增 page-transitions.js
  // 与 button-feedback.js 之后就会漏判——而漏判比误判更危险，
  // 它会让人以为发布已经完整。
  const NON_SITE = new Set(['eslint.config.mjs']);
  const siteFiles = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter(entry => entry.isFile())
    .filter(entry => entry.name.endsWith('.html') || entry.name.endsWith('.css') || (entry.name.endsWith('.js') && !NON_SITE.has(entry.name)))
    .map(entry => entry.name)
    .sort();
  const releaseMissing = siteFiles.filter(file => !tracked.includes(`release/${file}`));
  check('release/ 页面与共享资源清单齐全', releaseMissing.length === 0, releaseMissing.join('、'));
  const releaseAssets = tracked.filter(file => file.startsWith('release/assets/'));
  const rootAssets = candidates.filter(file => file.startsWith('assets/'));
  const missingAssets = rootAssets.filter(file => !releaseAssets.includes(`release/${file}`));
  check(
    'assets/ 素材已同步到 release/',
    missingAssets.length === 0 && releaseAssets.length === rootAssets.length,
    `根目录 ${rootAssets.length} 个，release ${releaseAssets.length} 个${missingAssets.length ? `；缺少 ${missingAssets.join('、')}` : ''}`
  );
} else {
  console.log('\n发布源同步由委托方使用 --release 与 check-release-sync.cjs 单独验收。');
}

console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项，提醒 ${warned} 项 =====`);
if (failed) console.log('\n有失败项，提交前请先处理。');
if (warned) console.log('提醒项不阻塞提交，但赛事要求涉及的要补齐。');
process.exitCode = failed ? 1 : 0;
