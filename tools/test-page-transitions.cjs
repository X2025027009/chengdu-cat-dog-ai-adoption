/**
 * 完全离线：在 VM 中验证独立页面的左右方向、历史往返和降级。
 * 不启动浏览器、服务器或网络请求，不写入任何云端数据。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'page-transitions.js'), 'utf8');
const files = ['index.html', 'pets.html', 'match.html', 'adoption.html', 'stories.html', 'about.html', 'admin.html'];
let passed = 0;

function fixture(base = 'https://example.test/yard/') {
  const listeners = new Map();
  const storage = new Map();
  const preference = { matches: false };
  const entries = [];
  const transitions = [];
  const window = {
    innerHeight: 900,
    location: { href: base },
    sessionStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    navigation: {},
    matchMedia: () => preference,
    addEventListener: (type, handler) => listeners.set(type, handler)
  };
  const context = vm.createContext({ URL, window, document: { currentScript: { src: `${base}page-transitions.js` }, querySelectorAll: () => entries } });
  vm.runInContext(source, context, { filename: 'page-transitions.js', timeout: 1000 });

  function emit(type, from, to, navigationType = 'push', options = {}) {
    let skipped = 0;
    const transition = options.noTransition
      ? null
      : {
          types: options.noTypes ? undefined : new Set(),
          skipTransition: () => skipped++,
          finished: { then: (done, failed) => Object.assign(transition, { done, failed }) },
          ready: { catch: failed => Object.assign(transition, { rejectedReady: failed }) }
        };
    transitions.push(transition);
    window.location.href = type === 'pageswap' ? from || base : to || base;
    const activation = options.noActivation
      ? undefined
      : {
          from: from ? { url: options.censored ? null : from, key: options.fromKey || `entry:${from}` } : null,
          entry: to ? { url: options.censored ? null : to, key: options.toKey || `entry:${to}` } : null,
          navigationType
        };
    if (window.navigation) window.navigation.activation = activation;
    listeners.get(type)({ viewTransition: transition, activation });
    return { types: [...(transition?.types || [])], skipped };
  }
  return { emit, preference, window, listeners, storage, entries, transitions, url: file => new URL(file, base).href };
}

function entry(rect = {}) {
  return {
    style: { viewTransitionName: '' },
    classList: {
      values: new Set(),
      add(value) {
        this.values.add(value);
      },
      remove(value) {
        this.values.delete(value);
      },
      contains(value) {
        return this.values.has(value);
      }
    },
    getBoundingClientRect: () => ({ width: 200, height: 120, top: 100, bottom: 220, ...rect })
  };
}

function test(label, run) {
  run();
  passed++;
  console.log(`PASS ${label}`);
}

test('七页任意跨页跳转的出场与入场方向一致（84 组）', () => {
  const site = fixture();
  for (const [from, fromFile] of files.entries()) {
    for (const [to, toFile] of files.entries()) {
      if (from === to) continue;
      assert.deepEqual(site.emit('pageswap', site.url(fromFile), site.url(toFile)), { types: [], skipped: 0 });
      assert.deepEqual(site.emit('pagereveal', site.url(fromFile), site.url(toFile)), { types: [to > from ? 'site-forward' : 'site-backward'], skipped: 0 });
      assert.equal(site.storage.size, 0);
    }
  }
});

test('跨级向左跳转后，历史返回向左推入右侧页面；连续后退与前进也保持真实方向', () => {
  const site = fixture();
  const steps = [
    ['index.html', 'about.html', 'push', 'site-forward'],
    ['about.html', 'pets.html', 'push', 'site-backward'],
    ['pets.html', 'about.html', 'traverse', 'site-forward'],
    ['about.html', 'index.html', 'traverse', 'site-backward'],
    ['index.html', 'about.html', 'traverse', 'site-forward'],
    ['about.html', 'pets.html', 'traverse', 'site-backward']
  ];
  for (const [from, to, navigationType, direction] of steps) {
    site.emit('pageswap', site.url(from), site.url(to), navigationType, { censored: true });
    assert.deepEqual(site.emit('pagereveal', site.url(from), site.url(to), navigationType, { censored: true }), { types: [direction], skipped: 0 });
  }
});

test('网站目录别名与 index.html 属于同一首页，支持部署在子目录', () => {
  for (const base of ['https://example.test/', 'https://example.test/yard/']) {
    const site = fixture(base);
    assert.deepEqual(site.emit('pagereveal', base, site.url('pets.html')), { types: ['site-forward'], skipped: 0 });
    assert.deepEqual(site.emit('pagereveal', site.url('index.html'), base), { types: [], skipped: 1 });
    assert.deepEqual(site.emit('pagereveal', site.url('pets.html'), base), { types: ['site-backward'], skipped: 0 });
  }
});

test('同页筛选、后台标签与锚点不触发横向转场，跨页携带参数仍判断方向', () => {
  const site = fixture();
  for (const [from, to] of [
    ['pets.html?type=cat', 'pets.html?type=dog'],
    ['admin.html?tab=overview', 'admin.html?tab=settings'],
    ['adoption.html', 'adoption.html#how']
  ]) {
    assert.deepEqual(site.emit('pagereveal', site.url(from), site.url(to)), { types: [], skipped: 1 });
  }
  assert.deepEqual(site.emit('pagereveal', site.url('about.html#contact'), site.url('pets.html?pet=xiaomai')), { types: ['site-backward'], skipped: 0 });
});

test('刷新、首次加载、没有转场对象时安全退出', () => {
  const site = fixture();
  assert.deepEqual(site.emit('pagereveal', site.url('pets.html'), site.url('about.html'), 'reload'), { types: [], skipped: 1 });
  assert.deepEqual(site.emit('pagereveal', null, site.url('pets.html')), { types: [], skipped: 1 });
  for (const type of ['pageswap', 'pagereveal']) assert.deepEqual(site.emit(type, site.url('pets.html'), site.url('about.html'), 'push', { noTransition: true }), { types: [], skipped: 0 });
});

test('未知页面、站外、同名站外页面、其他目录与 file URL 不产生误导方向', () => {
  const site = fixture();
  for (const target of ['unknown.html', 'https://other.test/yard/about.html', 'https://example.test/other/about.html', 'file:///D:/yard/about.html', 'http://[invalid']) {
    const to = target.startsWith('http') || target.startsWith('file:') ? target : site.url(target);
    assert.deepEqual(site.emit('pagereveal', site.url('pets.html'), to), { types: [], skipped: 1 });
  }
});

test('减少动态效果即时生效，偏好恢复后可以继续转场', () => {
  const site = fixture();
  site.preference.matches = true;
  for (const type of ['pageswap', 'pagereveal']) {
    assert.deepEqual(site.emit(type, site.url('pets.html'), site.url('about.html')), { types: [], skipped: 1 });
  }
  site.preference.matches = false;
  assert.deepEqual(site.emit('pagereveal', site.url('pets.html'), site.url('about.html')), { types: ['site-forward'], skipped: 0 });
});

test('隐私策略隐藏地址时，单次交接只保存页序与条目键且用后清除', () => {
  const site = fixture();
  site.emit('pageswap', site.url('pets.html?private=value'), site.url('about.html'), 'push', { censored: true, fromKey: 'a', toKey: 'b' });
  const handoff = JSON.parse(site.storage.get('yard:page-transition'));
  assert.deepEqual(handoff, { from: 1, fromKey: 'a' });
  assert.deepEqual(site.emit('pagereveal', site.url('pets.html?private=value'), site.url('about.html'), 'push', { censored: true, fromKey: 'a', toKey: 'new-key-on-commit' }), {
    types: ['site-forward'],
    skipped: 0
  });
  assert.equal(site.storage.size, 0);
  assert.deepEqual(site.emit('pagereveal', site.url('pets.html'), site.url('about.html'), 'push', { censored: true }), { types: [], skipped: 1 });
});

test('陈旧或不匹配的交接不会影响新标签页、历史跳转或刷新', () => {
  const site = fixture();
  site.emit('pageswap', site.url('pets.html'), site.url('about.html'), 'push', { censored: true });
  assert.deepEqual(site.emit('pagereveal', site.url('pets.html'), site.url('admin.html'), 'push', { censored: true, fromKey: 'other-source' }), { types: [], skipped: 1 });
  assert.equal(site.storage.size, 0);
  site.storage.set('yard:page-transition', '{broken');
  assert.deepEqual(site.emit('pagereveal', site.url('pets.html'), site.url('about.html')), { types: ['site-forward'], skipped: 0 });
  assert.equal(site.storage.size, 0);
});

test('浏览器禁用存储时不抛错，有原生地址则继续推移，隐藏地址则直接导航', () => {
  const site = fixture();
  for (const method of ['getItem', 'setItem', 'removeItem'])
    site.window.sessionStorage[method] = () => {
      throw new Error('storage blocked');
    };
  site.emit('pageswap', site.url('pets.html'), site.url('about.html'));
  assert.deepEqual(site.emit('pagereveal', site.url('pets.html'), site.url('about.html')), { types: ['site-forward'], skipped: 0 });
  assert.deepEqual(site.emit('pagereveal', site.url('pets.html'), site.url('about.html'), 'push', { censored: true }), { types: [], skipped: 1 });
});

test('缺少 NavigationActivation、Navigation API 或转场类型 API 时保留普通导航', () => {
  const site = fixture();
  assert.deepEqual(site.emit('pagereveal', site.url('pets.html'), site.url('about.html'), 'push', { noActivation: true }), { types: [], skipped: 1 });
  assert.deepEqual(site.emit('pagereveal', site.url('pets.html'), site.url('about.html'), 'push', { noTypes: true }), { types: [], skipped: 1 });
  delete site.window.navigation;
  assert.deepEqual(site.emit('pagereveal', site.url('pets.html'), site.url('about.html')), { types: [], skipped: 1 });
  assert.deepEqual([...site.listeners.keys()], ['pageswap', 'pagereveal']);
});

test('仅首屏可见内容同步入场、唯一命名且最多六块，不读取图片加载状态', () => {
  const site = fixture();
  const hidden = [entry({ width: 0 }), entry({ height: 0 }), entry({ top: 1000, bottom: 1120 }), entry({ top: -300, bottom: -180 })];
  const visible = Array.from({ length: 9 }, () => entry());
  site.entries.push(...hidden, ...visible);
  site.emit('pagereveal', site.url('pets.html'), site.url('about.html'));
  hidden.forEach(element => assert.equal(element.style.viewTransitionName, ''));
  visible.forEach((element, index) => assert.equal(element.style.viewTransitionName, index < 6 ? `site-entry-${index}` : ''));
  assert.equal(typeof site.transitions.at(-1).rejectedReady, 'function');
});

test('完成、跳过、被新导航打断时恢复原命名与样式，旧回调不清除下一次入场', () => {
  const site = fixture();
  const element = entry();
  element.style.viewTransitionName = 'original-name';
  site.entries.push(element);
  site.emit('pagereveal', site.url('pets.html'), site.url('about.html'));
  const first = site.transitions.at(-1);
  site.emit('pageswap', site.url('about.html'), site.url('pets.html'));
  assert.equal(element.style.viewTransitionName, 'original-name');
  assert.equal(element.classList.values.size, 0);
  site.emit('pagereveal', site.url('about.html'), site.url('pets.html'));
  first.done();
  assert.equal(element.style.viewTransitionName, 'site-entry-0');
  site.transitions.at(-1).failed();
  assert.equal(element.style.viewTransitionName, 'original-name');
  assert.equal(element.classList.values.size, 0);
});

test('减弱动效与无原生转场时内容默认可见，不添加入场标记', () => {
  const site = fixture();
  const element = entry();
  site.entries.push(element);
  site.preference.matches = true;
  site.emit('pagereveal', site.url('pets.html'), site.url('about.html'));
  site.preference.matches = false;
  site.emit('pagereveal', site.url('pets.html'), site.url('about.html'), 'push', { noTransition: true });
  assert.equal(element.style.viewTransitionName, '');
  assert.equal(element.classList.values.size, 0);
});

test('首页转场完成后不重启原有首次打开动画，避免额外等待', () => {
  const site = fixture();
  const element = entry();
  element.classList.add('reveal');
  site.entries.push(element);
  site.emit('pagereveal', site.url('pets.html'), site.url('index.html'));
  site.transitions.at(-1).done();
  assert.equal(element.classList.contains('page-entry-active'), false);
  assert.equal(element.classList.contains('page-entry-settled'), true);
  assert.equal(element.style.viewTransitionName, '');
});

test('七页和动态生成的图片均为非阻塞加载，保留首屏内容编排入口', () => {
  for (const file of files) {
    const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
    assert.match(html, /data-page-entry/);
    for (const [image] of html.matchAll(/<img\b[^>]*>/g)) {
      assert.match(image, /loading="lazy"/);
      assert.match(image, /decoding="async"/);
    }
  }
  const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  for (const [image] of app.matchAll(/<img\b[^>]*>/g)) {
    assert.match(image, /loading="lazy"/);
    assert.match(image, /decoding="async"/);
  }
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  assert.match(css, /site-content-right 360ms/);
  assert.match(css, /site-content-left/);
});

test('内容独立浮出而非再次横移，前后退保留同一弹出节奏与相反水平方向', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  assert.match(css, /site-content-right 360ms[^;]+site-content-pop 420ms[^;]+100ms both/);
  assert.match(css, /animation-name: site-content-left, site-content-pop/);
  assert.match(css, /@keyframes site-content-right \{ from \{ translate: 100vw 0;/);
  assert.match(css, /@keyframes site-content-left \{ from \{ translate: -100vw 0;/);
  assert.match(css, /@keyframes site-content-pop \{ from \{ opacity: 0; transform: translateY\(64px\) scale\(\.94\);/);
  assert.doesNotMatch(css, /calc\(100vw \+ 32px\)/);
});

console.log(`\n${passed} groups passed; no network requests.`);
