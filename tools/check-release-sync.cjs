/**
 * 发布同步检查。
 *
 * 本站的发布源是 release/ 目录，根目录是它们的"源码"。
 * 站点文件清单自动扫描根目录的 .html 与站点脚本，新增页面不必改这里。
 * 这里有两个容易漏的环节，本项目都真实发生过：
 *   ① 改了根目录文件，忘了同步到 release/ —— 部署上去的还是旧版本；
 *   ② 同步了 release/，忘了执行部署 —— 线上仍是旧的。
 * 两个环节都不会报错，只会表现为"我明明改了，线上怎么没变"。
 *
 * 因此这个检查做两件事：
 *   1. 根目录与 release/ 逐字节比对；
 *   2. 抓线上文件与 release/ 比对哈希，确认部署真的生效了。
 *
 * 用法：node tools/check-release-sync.cjs
 *      node tools/check-release-sync.cjs --offline   （跳过线上比对）
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://chuanzhibei-d3gvmowp1e63d7f33-1470251683.tcloudbaseapp.com';
const offline = process.argv.includes('--offline');

/**
 * 站点文件清单：根目录的 .html 加站点脚本与样式。
 *
 * 这里曾写死三个文件名，站点改多页后完全失效（新页面漏同步它不会报）。
 * 后来改成白名单，又漏了 page-transitions.js 与 button-feedback.js——
 * 白名单同样会过时。现在改为：根目录所有 .js 都纳入，
 * 只排除明确不属于站点的（云函数、验证脚本在子目录里，天然不会进来）。
 */
const NON_SITE_SCRIPTS = new Set(['eslint.config.mjs']);

function siteFiles() {
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile())
    .filter(entry => entry.name.endsWith('.html') || entry.name.endsWith('.css') || (entry.name.endsWith('.js') && !NON_SITE_SCRIPTS.has(entry.name)))
    .map(entry => entry.name)
    .sort();
}
const FILES = siteFiles();

/**
 * 站点素材（assets/ 下的图片等）也要一起比对，**递归**收集。
 *
 * 这个函数此前只枚举 assets/ 第一层，而素材后来分了 brand/、real/ 子目录，
 * 结果它会把目录当成文件去 readFileSync 从而报错——
 * 一个"检查工具"自己先崩了，比不检查更糟。
 * 嵌套素材漏传同样会导致线上显示旧图或占位图，所以必须递归。
 */
function walkAssets(dir, prefix = 'assets') {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const rel = `${prefix}/${entry.name}`;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkAssets(full, rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

function assetFiles() {
  return walkAssets(path.join(ROOT, 'assets')).sort();
}
const ALL_FILES = [...FILES, ...assetFiles()];

const sha = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

/**
 * 线上资源校验：不仅要比哈希，还要确认状态码与类型。
 *
 * 静态托管在文件缺失时会返回首页或错误页，且可能是 HTTP 200。
 * 只比哈希偶尔能发现，但报错信息会误导（"内容不一致"而不是"文件不存在"）。
 * 因此这里先看状态码与 Content-Type，再比内容。
 */
const EXPECTED_TYPE = file =>
  file.endsWith('.html')
    ? 'text/html'
    : file.endsWith('.css')
      ? 'text/css'
      : file.endsWith('.js')
        ? 'javascript'
        : file.endsWith('.svg')
          ? 'svg'
          : file.endsWith('.png')
            ? 'image/png'
            : file.endsWith('.jpg') || file.endsWith('.jpeg')
              ? 'image/jpeg'
              : file.endsWith('.webp')
                ? 'image/webp'
                : '';

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
  console.log('发布同步检查\n');

  console.log('【1】根目录 → release/');
  for (const file of ALL_FILES) {
    const rootPath = path.join(ROOT, file);
    const releasePath = path.join(ROOT, 'release', file);
    // 分别报告是缺在哪一侧——原先两种情况共用一句「两个位置都存在」，
    // 既没说清缺哪边，读起来也像是"都存在却判失败"
    if (!fs.existsSync(rootPath)) {
      check(`${file} 存在于根目录`, false, '根目录缺少该文件，检查文件名单是否有误');
      continue;
    }
    if (!fs.existsSync(releasePath)) {
      check(`${file} 已同步到 release/`, false, 'release/ 里没有这个文件，部署上去不会有它');
      continue;
    }
    const same = sha(fs.readFileSync(rootPath)) === sha(fs.readFileSync(releasePath));
    check(`${file} 已同步到 release/`, same, '根目录改了但没复制到 release/，部署上去的还是旧版本');
  }

  if (offline) {
    console.log('\n（--offline：跳过线上比对）');
  } else {
    console.log('\n【2】release/ → 线上');
    for (const file of ALL_FILES) {
      const releasePath = path.join(ROOT, 'release', file);
      // 发布源里没有就无从比对，第【1】节已经报过，这里跳过而不是抛异常
      if (!fs.existsSync(releasePath)) {
        check(`${file} 可比对`, false, '发布源里没有该文件，先完成第【1】节的同步');
        continue;
      }
      const local = fs.readFileSync(releasePath);
      try {
        const response = await fetch(`${SITE}/${file}?t=${Date.now()}`);
        const type = response.headers.get('content-type') || '';
        const expected = EXPECTED_TYPE(file);

        // 先看状态码与类型：文件缺失时静态托管可能返回首页并以 200 响应，
        // 那时只比哈希会报"内容不一致"，把问题指向错误的方向
        if (response.status !== 200) {
          check(`${file} 线上可访问`, false, `HTTP ${response.status}`);
          continue;
        }
        if (expected && !type.includes(expected)) {
          check(`${file} 线上类型正确`, false, `期望 ${expected}，实际 ${type || '(无)'}——多半是被回退页替代了`);
          continue;
        }

        const remote = Buffer.from(await response.arrayBuffer());
        check(`${file} 线上与发布源一致`, sha(local) === sha(remote), 'release/ 改了但没执行部署，线上仍是旧版本');
      } catch (error) {
        check(`${file} 可访问`, false, error.message);
      }
    }
  }

  console.log(`\n===== 通过 ${passed} 项，失败 ${failed} 项 =====`);
  // 不在 fetch 连接关闭前强行退出，否则会有 Node 的 UV_HANDLE_CLOSING 断言噪音
  process.exitCode = failed ? 1 : 0;
})();
