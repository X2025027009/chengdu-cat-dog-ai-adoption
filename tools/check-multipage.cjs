/**
 * Offline acceptance checks for the independent static pages.
 *
 * Run: node tools/check-multipage.cjs
 * This script reads local files only: it never requests the cloud, starts a
 * browser, writes release assets, or submits adoption/admin data.
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pages = [
  { file: 'index.html', page: 'home', ids: ['stats'], hero: true },
  { file: 'pets.html', page: 'pets', ids: ['petGrid'] },
  { file: 'match.html', page: 'match', ids: ['matchForm'] },
  { file: 'adoption.html', page: 'adoption', ids: ['how'] },
  { file: 'stories.html', page: 'stories', ids: ['storiesGrid'] },
  { file: 'about.html', page: 'about', ids: ['contactList'] },
  { file: 'admin.html', page: 'admin', ids: ['adminContent'] }
];
const featureIds = pages.flatMap(page => page.ids);
const titles = new Map();
let passed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) passed += 1;
  else failures.push(`${label}${detail ? `: ${detail}` : ''}`);
}

function attributes(source) {
  const result = {};
  const expression = /([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(expression)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}

function tags(html) {
  return [...html.matchAll(/<([a-z][a-z\d:-]*)\b([^>]*?)>/gi)].map(match => ({
    name: match[1].toLowerCase(),
    attrs: attributes(match[2])
  }));
}

function hasClass(tag, className) {
  return (tag.attrs.class || '').split(/\s+/).includes(className);
}

function localReference(value, currentFile) {
  const decoded = value.replace(/&amp;/g, '&').trim();
  if (!decoded || /^[a-z][a-z\d+.-]*:/i.test(decoded) || decoded.startsWith('//') || /^[#?]/.test(decoded)) return null;
  let pathname;
  try {
    pathname = decodeURIComponent(decoded.split(/[?#]/, 1)[0]);
  } catch {
    return { error: 'invalid URL encoding' };
  }
  const base = pathname.startsWith('/') ? root : path.dirname(path.join(root, currentFile));
  const target = path.resolve(base, pathname.replace(/^[/\\]+/, '').replace(/[/\\]/g, path.sep));
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return { error: 'target is outside the website' };
  return { target, file: relative.replace(/\\/g, '/') };
}

function validatePage(page) {
  const beforePassed = passed;
  const beforeFailed = failures.length;
  const filename = path.join(root, page.file);
  check(`${page.file} exists`, fs.existsSync(filename));
  if (!fs.existsSync(filename)) return;
  const html = fs.readFileSync(filename, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const elements = tags(html);
  const htmlTag = elements.find(tag => tag.name === 'html');
  const body = elements.find(tag => tag.name === 'body');
  const ids = elements.filter(tag => tag.attrs.id).map(tag => tag.attrs.id);
  const idSet = new Set(ids);
  const titleMatches = [...html.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/gi)];
  const title = titleMatches[0]?.[1].trim();

  check(`${page.file} language is zh-CN`, htmlTag?.attrs.lang === 'zh-CN');
  check(`${page.file} has its own page identity`, body?.attrs['data-page'] === page.page);
  check(`${page.file} has one non-empty title`, titleMatches.length === 1 && Boolean(title));
  check(`${page.file} has a distinct title`, !title || !titles.has(title), title ? `also used by ${titles.get(title)}` : '');
  if (title) titles.set(title, page.file);
  check(`${page.file} has exactly one h1`, elements.filter(tag => tag.name === 'h1').length === 1);
  check(`${page.file} has unique IDs`, ids.length === idSet.size, [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].join(', '));

  for (const id of page.ids) check(`${page.file} contains #${id}`, idSet.has(id));
  for (const id of featureIds.filter(id => !page.ids.includes(id))) {
    check(`${page.file} does not embed another page's #${id}`, !idSet.has(id));
  }
  check(`${page.file} contains the hero only on home`, elements.some(tag => hasClass(tag, 'hero')) === Boolean(page.hero));
  for (const id of ['modalBackdrop', 'modal', 'toast']) check(`${page.file} includes shared #${id}`, idSet.has(id));
  check(`${page.file} keeps administration on its own page`, idSet.has('adminBackdrop') === (page.page === 'admin'));

  const navMatch = html.match(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi)?.find(source => {
    const opener = source.match(/^<nav\b([^>]*)>/i);
    return opener && (attributes(opener[1]).class || '').split(/\s+/).includes('site-nav');
  });
  check(`${page.file} has the shared site navigation`, Boolean(navMatch));
  const navLinks = navMatch ? tags(navMatch).filter(tag => tag.name === 'a') : [];
  check(
    `${page.file} navigation order agrees with horizontal transition order`,
    JSON.stringify(navLinks.map(link => localReference(link.attrs.href || '', page.file)?.file)) === JSON.stringify(pages.map(item => item.file))
  );
  check(
    `${page.file} navigation uses real page links`,
    navLinks.length > 0 &&
      navLinks.every(link => {
        const reference = localReference(link.attrs.href || '', page.file);
        return reference && !reference.error && reference.file.endsWith('.html') && fs.existsSync(reference.target);
      })
  );
  const activeLinks = navLinks.filter(link => link.attrs['aria-current'] === 'page');
  check(`${page.file} has one active navigation link`, activeLinks.length === 1);
  check(`${page.file} active navigation points to itself`, activeLinks.length === 1 && localReference(activeLinks[0].attrs.href || '', page.file)?.file === page.file);

  const scripts = elements.filter(tag => tag.name === 'script' && tag.attrs.src).map(tag => localReference(tag.attrs.src, page.file)?.file);
  for (const script of ['site-config.js', 'app.js', 'page-transitions.js']) check(`${page.file} loads shared ${script}`, scripts.includes(script));
  const transitionScript = tags(html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] || '').find(tag => tag.name === 'script' && tag.attrs.src === 'page-transitions.js');
  check(`${page.file} registers transitions before the first render`, Boolean(transitionScript) && !['defer', 'async', 'type'].some(attribute => Object.hasOwn(transitionScript.attrs, attribute)));
  for (const tag of elements) {
    for (const attribute of ['href', 'src', 'poster']) {
      if (!tag.attrs[attribute]) continue;
      const reference = localReference(tag.attrs[attribute], page.file);
      if (!reference) continue;
      check(`${page.file} ${attribute}="${tag.attrs[attribute]}" resolves locally`, !reference.error && fs.existsSync(reference.target), reference.error || 'missing target');
    }
  }

  const pageFailures = failures.length - beforeFailed;
  console.log(`${pageFailures ? 'FAIL' : 'PASS'} ${page.file}: ${passed - beforePassed} checks passed${pageFailures ? `, ${pageFailures} failed` : ''}`);
}

console.log('Independent-page checks (local files only)');
for (const page of pages) validatePage(page);
console.log(`\n${passed} checks passed; ${failures.length} failed.`);
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
}
