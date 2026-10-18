/**
 * Offline static asset references: root HTML, CSS url(), JS asset literals.
 * Does not fetch remote/cloud images or execute browser scripts.
 * Run: node tools/check-assets.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');

function localTarget(reference, source, base = root) {
  const value = reference.trim().replace(/&amp;/g, '&');
  if (!value || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(value)) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(value.split(/[?#]/)[0]);
  } catch {
    return { error: 'invalid URL encoding' };
  }
  if (!pathname) return null;
  const target = path.resolve(pathname.startsWith('/') ? base : path.dirname(path.join(base, source)), pathname.replace(/^\/+/, ''));
  const relative = path.relative(base, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return { error: 'outside site root' };
  // Match actual directory entries, including case on Windows, for Linux hosting.
  let current = base;
  for (const segment of relative.split(path.sep)) {
    if (!fs.existsSync(current) || !fs.statSync(current).isDirectory() || !fs.readdirSync(current).includes(segment)) return { target, exists: false };
    current = path.join(current, segment);
  }
  return { target, exists: fs.statSync(target).isFile() };
}

function references(text, extension) {
  const found = [];
  if (extension === '.html') {
    const html = text.replace(/<!--[\s\S]*?-->/g, '');
    for (const match of html.matchAll(/\b(?:src|poster|href)\s*=\s*["']([^"']+)["']/gi)) {
      if (/\.(?:png|jpe?g|webp|svg|gif|ico|avif|woff2?)(?:[?#]|$)/i.test(match[1])) found.push(match[1]);
    }
    for (const match of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
      // Data URLs are embedded, not local files; leave them out of this static check.
      if (!match[1].includes('data:')) for (const item of match[1].split(',')) found.push(item.trim().split(/\s+/)[0]);
    }
  }
  if (extension === '.css') {
    const css = text.replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of css.matchAll(/url\(\s*(?:["']([^"']+)["']|([^\s)]+))\s*\)/gi)) found.push(match[1] || match[2]);
  }
  if (extension === '.js') {
    // Only fixed assets/ string literals. Runtime cloud URLs are not local assets.
    for (const match of text.matchAll(/["'`]((?:\.\/)?assets\/[^"'`\s<>]+)["'`]/g)) {
      if (!match[1].includes('${')) found.push(match[1]);
    }
  }
  return [...new Set(found)];
}

function allFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? allFiles(full) : [full];
  });
}

function main() {
  let passed = 0;
  const failures = [];
  const check = (label, condition) => {
    if (condition) passed += 1;
    else failures.push(label);
  };
  // Regression coverage for the checker itself, without changing files.
  const cases = [
    ['missing asset is rejected', !localTarget('assets/__missing_asset__.png', 'index.html').exists],
    ['query and fragment resolve', localTarget('assets/dogs-group-original.jpg?v=2#photo', 'index.html').exists],
    ['encoded local path resolves', localTarget('assets/%64ogs-group-original.jpg', 'index.html').exists],
    ['external URL is ignored', localTarget('https://example.com/photo.png', 'index.html') === null],
    ['embedded image is ignored', localTarget('data:image/png;base64,AA==', 'index.html') === null],
    ['outside root is rejected', Boolean(localTarget('../private.png', 'index.html').error)],
    ['malformed URL encoding is rejected', Boolean(localTarget('assets/%ZZ.png', 'index.html').error)],
    ['CSS URL collection', references('a {background:url("assets/missing.webp")}', '.css')[0] === 'assets/missing.webp'],
    ['JS literal collection', references("const photo = 'assets/missing.webp';", '.js')[0] === 'assets/missing.webp'],
    ['HTML srcset collection', references('<img srcset="assets/a.webp 1x, assets/b.webp 2x">', '.html').length === 2]
  ];
  for (const [label, value] of cases) check(label, value);
  const sources = fs.readdirSync(root).filter(file => /\.(?:html|css|js)$/.test(file));
  for (const file of sources) {
    const refs = references(fs.readFileSync(path.join(root, file), 'utf8'), path.extname(file));
    for (const reference of refs) {
      const target = localTarget(reference, file);
      if (target) check(`${file}: missing or unsafe asset ${reference}`, !target.error && target.exists);
    }
  }
  const bytes = allFiles(path.join(root, 'assets')).reduce((sum, file) => sum + fs.statSync(file).size, 0);
  check(`assets must be below 3,000,000 bytes (actual ${bytes})`, bytes < 3000000);
  assert(passed > cases.length, 'no actual references were checked');
  console.log(`Asset references: ${passed} passed, ${failures.length} failed; assets ${bytes} bytes.`);
  for (const failure of failures) console.error(`FAIL: ${failure}`);
  if (failures.length) process.exitCode = 1;
}

if (require.main === module) main();
module.exports = { localTarget, references };
