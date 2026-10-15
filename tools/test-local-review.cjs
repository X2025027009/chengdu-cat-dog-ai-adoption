/**
 * Offline local-review regressions. No HTTP server is started; all browser
 * requests are trapped, and site-config/app.js run in isolated Node VMs.
 * Usage: node tools/test-local-review.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Writable } = require('node:stream');
const { finished } = require('node:stream/promises');
const vm = require('node:vm');
const { handlePreviewRequest, previewRelativePath, isLoopbackHost } = require('./serve-preview.cjs');

const ROOT = path.resolve(__dirname, '..');
const APP_SOURCE = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const CONFIG_SOURCE = fs.readFileSync(path.join(ROOT, 'site-config.js'), 'utf8');
const PAGES = ['home', 'pets', 'match', 'adoption', 'stories', 'about', 'admin'];
let passed = 0;
let failed = 0;

function element(initialClasses = []) {
  const classes = new Set(initialClasses);
  const attrs = new Map();
  const children = new Map();
  return {
    innerHTML: '',
    textContent: '',
    hidden: false,
    value: '',
    disabled: false,
    dataset: {},
    scrollTop: 0,
    scrollHeight: 0,
    classList: {
      add: (...values) => values.forEach(value => classes.add(value)),
      remove: (...values) => values.forEach(value => classes.delete(value)),
      contains: value => classes.has(value),
      toggle(value, force) {
        const next = force === undefined ? !classes.has(value) : force;
        if (next) classes.add(value);
        else classes.delete(value);
        return next;
      }
    },
    setAttribute: (name, value) => attrs.set(name, value),
    getAttribute: name => attrs.get(name),
    removeAttribute: name => attrs.delete(name),
    querySelector: selector => children.get(selector) || null,
    querySelectorAll: () => [],
    addEventListener() {},
    focus() {},
    scrollIntoView() {},
    remove() {},
    appendChild: child => child,
    children
  };
}

function fixture(page, href) {
  let currentUrl = new URL(href);
  const calls = { fetch: 0, sdk: 0, script: 0, rotation: 0, navigations: [] };
  const hosts = new Map();
  const localNotice = element();
  localNotice.hidden = true;
  hosts.set('#localReviewNotice', localNotice);
  hosts.set('#modalBackdrop', element(['hidden']));
  hosts.set('#modal', element());
  hosts.set('#toast', element(['hidden']));
  if (page === 'pets') {
    hosts.set('#petGrid', element());
    hosts.set('#emptyState', element(['hidden']));
  }
  if (page === 'stories') {
    hosts.set('#storiesGrid', element());
    hosts.set('#storiesEmpty', element(['hidden']));
  }
  if (page === 'match') {
    for (const id of ['matchThread', 'matchForm', 'matchInput', 'matchSubmit', 'matchReset', 'matchModeHint', 'matchPhotoResult']) {
      hosts.set(`#${id}`, element());
    }
  }
  if (page === 'admin') {
    hosts.set('#adminBackdrop', element());
    hosts.set('#adminContent', element());
    const notice = element();
    notice.children.set('strong', element());
    notice.children.set('span', element());
    hosts.set('.admin-notice', notice);
  }
  const location = {
    get href() {
      return currentUrl.href;
    },
    get protocol() {
      return currentUrl.protocol;
    },
    get hostname() {
      return currentUrl.hostname;
    },
    get hash() {
      return currentUrl.hash;
    },
    get search() {
      return currentUrl.search;
    },
    get pathname() {
      return currentUrl.pathname;
    },
    assign(value) {
      calls.navigations.push(value);
      currentUrl = new URL(value, currentUrl);
    },
    replace(value) {
      calls.navigations.push(value);
      currentUrl = new URL(value, currentUrl);
    }
  };
  const body = element();
  body.dataset.page = page;
  const document = {
    body,
    querySelector: selector => hosts.get(selector) || null,
    querySelectorAll: () => [],
    getElementById: id => hosts.get(`#${id}`) || null,
    addEventListener() {},
    createElement(tag) {
      if (tag === 'script') {
        calls.script += 1;
        throw new Error('Local review attempted to load an external script');
      }
      return element();
    },
    head: {
      append() {
        throw new Error('Local review attempted to append an external script');
      }
    }
  };
  const localValues = new Map();
  const window = {
    location,
    cloudbase: {
      init() {
        calls.sdk += 1;
        throw new Error('Local review initialized the cloud SDK');
      }
    },
    history: {
      pushState(_state, _title, value) {
        currentUrl = new URL(value, currentUrl);
      },
      replaceState(_state, _title, value) {
        currentUrl = new URL(value, currentUrl);
      }
    },
    addEventListener() {},
    setInterval() {
      calls.rotation += 1;
      return 1;
    },
    clearInterval() {}
  };
  const context = vm.createContext({
    document,
    window,
    location,
    console,
    URL,
    AbortController,
    localStorage: { getItem: key => localValues.get(key) || null, setItem: (key, value) => localValues.set(key, value) },
    fetch() {
      calls.fetch += 1;
      throw new Error('Unexpected network fetch');
    },
    setTimeout: callback => {
      callback();
      return 1;
    },
    clearTimeout() {}
  });
  return { context, calls, hosts, body, localNotice };
}

async function test(label, body) {
  try {
    await body();
    passed += 1;
    console.log(`✅ ${label}`);
  } catch (error) {
    failed += 1;
    console.error(`❌ ${label}：${error.message}`);
  }
}

async function initialize(fixtureValue) {
  const { context } = fixtureValue;
  vm.runInContext(CONFIG_SOURCE, context, { filename: 'site-config.js', timeout: 1000 });
  const captured = APP_SOURCE.replace(/initializeSite\(\);\s*$/, 'globalThis.__siteInitialization = initializeSite();');
  assert.notEqual(captured, APP_SOURCE, 'Could not capture initializeSite');
  vm.runInContext(captured, context, { filename: 'app.js', timeout: 1000 });
  await context.__siteInitialization;
}

function assertNoCloudCalls(value) {
  assert.equal(value.calls.fetch, 0, 'Unexpected fetch');
  assert.equal(value.calls.sdk, 0, 'Unexpected SDK initialization');
  assert.equal(value.calls.script, 0, 'Unexpected SDK script load');
}

async function offlineRequest(method, url, host = '127.0.0.1:4173') {
  const chunks = [];
  const response = new Writable({
    write(chunk, _encoding, done) {
      chunks.push(Buffer.from(chunk));
      done();
    }
  });
  response.writeHead = (status, headers) => {
    response.statusCode = status;
    response.headers = headers;
  };
  await handlePreviewRequest({ method, url, headers: { host } }, response);
  await finished(response);
  return { status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) };
}

(async () => {
  for (const href of ['http://localhost:4173/', 'http://127.0.0.1:4173/', 'http://[::1]:4173/', 'file:///D:/review/index.html']) {
    await test(`site-config 隔离 ${new URL(href).protocol === 'file:' ? 'file:' : new URL(href).hostname}`, async () => {
      const value = fixture('home', href);
      vm.runInContext(CONFIG_SOURCE, value.context, { filename: 'site-config.js', timeout: 1000 });
      await value.context.window.YARD_CLOUD_READY;
      assert.equal(value.context.window.YARD_LOCAL_REVIEW, true);
      assert.equal(value.localNotice.hidden, false);
      assertNoCloudCalls(value);
    });
  }

  for (const page of PAGES) {
    await test(`${page} 缺少其他页面宿主仍可启动且不联网`, async () => {
      const file = page === 'home' ? 'index' : page;
      const value = fixture(page, `http://127.0.0.1:4173/${file}.html`);
      await initialize(value);
      assertNoCloudCalls(value);
      assert.equal(value.calls.rotation, 0, 'Rotation started without featured-card hosts');
      assert.deepEqual(value.calls.navigations, []);
      if (page === 'pets') assert.match(value.hosts.get('#petGrid').innerHTML, /pet-card/);
      if (page === 'stories') assert.match(value.hosts.get('#storiesGrid').innerHTML, /元宝/);
      if (page === 'admin') {
        assert.match(value.hosts.get('#adminContent').innerHTML, /今天的小院/);
        assert.match(value.hosts.get('.admin-notice').children.get('span').textContent, /不会同步/);
        assert.equal(value.body.classList.contains('modal-open'), false);
      }
    });
  }

  await test('本地 AI、图搜和申请操作提前阻断', async () => {
    const value = fixture('match', 'http://127.0.0.1:4173/match.html');
    await initialize(value);
    await vm.runInContext('matchAsk("我有养猫经验")', value.context);
    await vm.runInContext('handlePhotoSearch({})', value.context);
    assert.match(value.hosts.get('#matchPhotoResult').innerHTML, /照片不会上传/);
    await assert.rejects(vm.runInContext('callYardApi({ action: "application.submit" })', value.context), /本地审核/);
    assertNoCloudCalls(value);
  });

  await test('首页旧入口保留 query 跳转到独立页面', async () => {
    const value = fixture('home', 'http://127.0.0.1:4173/index.html?pet=xiaomai#pets');
    await initialize(value);
    assert.deepEqual(value.calls.navigations, ['pets.html?pet=xiaomai']);
    assertNoCloudCalls(value);
  });

  await test('预览服务器只允许公开页面、脚本、样式和素材', () => {
    assert.equal(previewRelativePath('/'), 'index.html');
    for (const file of ['index.html', 'pets.html', 'match.html', 'adoption.html', 'stories.html', 'about.html', 'admin.html', 'app.js', 'styles.css', 'site-config.js', 'assets/team-photo.jpg']) {
      assert.equal(previewRelativePath(`/${file}?review=1`), file);
    }
    for (const target of [
      '/.env',
      '/.git/config',
      '/docs/交付报告.md',
      '/tools/serve-preview.cjs',
      '/functions/yard-api/index.js',
      '/release/index.html',
      '/assets/../app.js',
      '/assets/%2e%2e/app.js',
      '/assets/%2e%2e%2f.env',
      '/assets/%5c..%5c.env',
      '/assets/.git/config',
      '/assets/photo.jpg:secret',
      '/assets/photo.jpg.',
      '/assets/',
      '/%ZZ',
      '//example.com/app.js'
    ]) {
      assert.equal(previewRelativePath(target), null, `Unexpected allowed path: ${target}`);
    }
  });

  await test('预览服务器拒绝非本机 Host', () => {
    assert.equal(isLoopbackHost('127.0.0.1:4173'), true);
    assert.equal(isLoopbackHost('localhost:4173'), true);
    assert.equal(isLoopbackHost('example.com:4173'), false);
    assert.equal(isLoopbackHost(undefined), false);
  });

  await test('预览处理器 GET 和 HEAD 返回正确内容与 MIME', async () => {
    const get = await offlineRequest('GET', '/app.js');
    assert.equal(get.status, 200);
    assert.equal(get.headers['Content-Type'], 'text/javascript; charset=utf-8');
    assert.equal(get.body.toString('utf8'), APP_SOURCE);
    const head = await offlineRequest('HEAD', '/assets/team-photo.jpg');
    assert.equal(head.status, 200);
    assert.equal(head.headers['Content-Type'], 'image/jpeg');
    assert.equal(head.headers['Content-Length'], fs.statSync(path.join(ROOT, 'assets', 'team-photo.jpg')).size);
    assert.equal(head.body.length, 0);
  });

  await test('预览处理器拒绝私有路径、非 GET/HEAD 和外部 Host', async () => {
    const privateFile = await offlineRequest('HEAD', '/.git/config');
    assert.equal(privateFile.status, 404);
    assert.equal(privateFile.body.length, 0);
    const post = await offlineRequest('POST', '/app.js');
    assert.equal(post.status, 405);
    assert.equal(post.headers.Allow, 'GET, HEAD');
    const externalHost = await offlineRequest('GET', '/app.js', 'example.com:4173');
    assert.equal(externalHost.status, 403);
  });

  console.log(`\n通过 ${passed} 项，失败 ${failed} 项；未启动服务器或请求网络。`);
  process.exitCode = failed ? 1 : 0;
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
