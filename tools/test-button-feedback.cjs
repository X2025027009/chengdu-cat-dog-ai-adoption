/** 完全离线：共享按钮的指针、键盘、取消、状态时序和无网络约束。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'button-feedback.js'), 'utf8');
let passed = 0;

function control({ tag = 'button', classes = [], admin = false, disabled = false } = {}) {
  const values = new Set(classes);
  const attrs = new Map();
  const element = {
    dataset: {},
    isConnected: true,
    disabled,
    textContent: '原按钮文字',
    classList: {
      add: value => values.add(value),
      remove: value => values.delete(value),
      contains: value => values.has(value)
    },
    getAttribute: key => attrs.get(key) ?? null,
    setAttribute: (key, value) => attrs.set(key, value),
    removeAttribute: key => attrs.delete(key),
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 100, bottom: 50 }),
    contains: child => child === element || child?.parent === element,
    matches(selector) {
      return selector.split(',').some(value => {
        const token = value.trim();
        if (token === ':disabled') return element.disabled;
        if (token.startsWith('.')) return values.has(token.slice(1));
        return tag === token;
      });
    },
    closest(selector) {
      if (selector.includes('[data-page="admin"]')) return admin ? element : null;
      return element;
    }
  };
  return element;
}

function fixture(reduced = false) {
  const listeners = { document: new Map(), window: new Map(), preference: new Map() };
  const timers = new Map();
  let timerId = 0;
  const subscribe = host => (type, handler) => {
    if (!listeners[host].has(type)) listeners[host].set(type, []);
    listeners[host].get(type).push(handler);
  };
  const preference = { matches: reduced, addEventListener: subscribe('preference') };
  const document = { addEventListener: subscribe('document'), hidden: false };
  const window = {
    addEventListener: subscribe('window'),
    matchMedia: () => preference,
    setTimeout: (run, delay) => {
      const id = ++timerId;
      timers.set(id, { run, delay });
      return id;
    },
    clearTimeout: id => timers.delete(id)
  };
  const context = vm.createContext({ window, document });
  vm.runInContext(source, context, { filename: 'button-feedback.js', timeout: 1000 });
  function emit(host, type, detail = {}) {
    const event = { button: 0, pointerId: 1, isPrimary: true, pointerType: 'mouse', clientX: 20, clientY: 20, detail: 1, ...detail };
    for (const handler of listeners[host].get(type) || []) handler(event);
  }
  function flush(delay) {
    for (const [id, item] of [...timers]) {
      if (item.delay > delay || !timers.has(id)) continue;
      timers.delete(id);
      item.run();
    }
  }
  return { emit, flush, timers, context, window, document, preference, state: window.YardButtonFeedback.setState };
}

function test(label, run) {
  run();
  passed++;
  console.log(`PASS ${label}`);
}

test('指针按下压缩，松开回弹并按时清理', () => {
  const f = fixture();
  const target = control();
  f.emit('document', 'pointerdown', { target });
  assert.equal(target.classList.contains('feedback-pressed'), true);
  assert.equal(target.dataset.feedbackTone, 'soft');
  f.emit('window', 'pointerup');
  assert.equal(target.classList.contains('feedback-pressed'), false);
  assert.equal(target.classList.contains('feedback-rebound'), true);
  f.flush(300);
  assert.equal(target.classList.contains('feedback-rebound'), false);
});

test('拖出后松开不回弹，返回按钮内仍可按正常鼠标语义释放', () => {
  const f = fixture();
  const target = control();
  f.emit('document', 'pointerdown', { target });
  f.emit('document', 'pointerout', { target, relatedTarget: null });
  assert.equal(target.classList.contains('feedback-pressed'), false);
  f.emit('document', 'pointerover', { target });
  assert.equal(target.classList.contains('feedback-pressed'), true);
  f.emit('window', 'pointerup', { clientX: 150 });
  assert.equal(target.classList.contains('feedback-rebound'), false);
});

test('按钮内部图标之间移动不取消按压', () => {
  const f = fixture();
  const target = control();
  f.emit('document', 'pointerdown', { target });
  f.emit('document', 'pointerout', { target, relatedTarget: { parent: target } });
  assert.equal(target.classList.contains('feedback-pressed'), true);
});

test('触摸滚动和 pointercancel 均清理，不锁滚动或触发额外点击', () => {
  const f = fixture();
  const target = control();
  f.emit('document', 'pointerdown', { target, pointerType: 'touch' });
  f.emit('document', 'pointermove', { clientY: 40 });
  f.emit('window', 'pointerup', { clientY: 40 });
  assert.equal(target.classList.contains('feedback-rebound'), false);
  f.emit('document', 'pointerdown', { target, pointerType: 'touch' });
  f.emit('window', 'pointercancel');
  assert.equal(target.classList.contains('feedback-pressed'), false);
});

test('非主指针、右键、禁用、aria-disabled 和移除按钮均不产生反馈', () => {
  const f = fixture();
  for (const extra of [{ button: 2 }, { isPrimary: false }]) {
    const target = control();
    f.emit('document', 'pointerdown', { target, ...extra });
    assert.equal(target.classList.contains('feedback-pressed'), false);
  }
  for (const mode of ['disabled', 'aria', 'detached']) {
    const target = control({ disabled: mode === 'disabled' });
    if (mode === 'aria') target.setAttribute('aria-disabled', 'true');
    if (mode === 'detached') target.isConnected = false;
    f.emit('document', 'pointerdown', { target });
    f.emit('document', 'click', { target, detail: 0 });
    assert.equal(target.dataset.feedbackTone, undefined);
  }
});

test('Enter / Space 按下与松开反馈，按键重复不累积', () => {
  for (const key of ['Enter', ' ']) {
    const f = fixture();
    const target = control();
    f.emit('document', 'keydown', { target, key });
    f.emit('document', 'keydown', { target, key, repeat: true });
    assert.equal(target.classList.contains('feedback-pressed'), true);
    f.emit('document', 'keyup', { target, key });
    assert.equal(target.classList.contains('feedback-rebound'), true);
    assert.equal(f.timers.size, 1);
  }
});

test('链接 Space 维持原生滚动语义，上传输入框不冒充标签按键', () => {
  const f = fixture();
  const target = control({ tag: 'a' });
  f.emit('document', 'keydown', { target, key: ' ' });
  assert.equal(target.classList.contains('feedback-pressed'), false);
  const label = control({ tag: 'label' });
  f.emit('document', 'keydown', { target: { closest: () => label }, key: 'Enter' });
  assert.equal(label.classList.contains('feedback-pressed'), false);
});

test('辅助技术的零 detail click 也有反馈，不主动调用 click 或取消事件', () => {
  const f = fixture();
  const target = control();
  f.emit('document', 'click', { target, detail: 0 });
  assert.equal(target.classList.contains('feedback-rebound'), true);
  assert.doesNotMatch(source, /preventDefault|stopPropagation|stopImmediatePropagation|\.click\(/);
});

test('失焦、滚动、页面隐藏和离开不残留按下状态', () => {
  for (const [host, event] of [
    ['window', 'blur'],
    ['window', 'scroll'],
    ['window', 'pagehide'],
    ['document', 'visibilitychange'],
    ['document', 'focusout']
  ]) {
    const f = fixture();
    const target = control();
    f.emit('document', 'pointerdown', { target });
    f.document.hidden = true;
    f.emit(host, event, { target });
    assert.equal(target.classList.contains('feedback-pressed'), false, event);
  }
});

test('动态创建的按钮无需逐个重新绑定，后台、关闭和筛选保持克制', () => {
  const f = fixture();
  for (const config of [{ admin: true }, { classes: ['modal-close'] }, { classes: ['filter-button'] }, { classes: ['admin-delete'] }]) {
    const target = control(config);
    f.emit('document', 'pointerdown', { target });
    assert.equal(target.dataset.feedbackTone, 'quiet');
    f.emit('window', 'pointerup');
  }
});

test('快速连按清理旧回弹，跨按钮不会同时残留按下状态', () => {
  const f = fixture();
  const first = control();
  const second = control();
  for (let i = 0; i < 8; i++) {
    f.emit('document', 'pointerdown', { target: first });
    assert.equal(first.classList.contains('feedback-rebound'), false);
    f.emit('window', 'pointerup');
  }
  f.emit('document', 'pointerdown', { target: first });
  f.emit('document', 'pointerdown', { target: second });
  assert.equal(first.classList.contains('feedback-pressed'), false);
  assert.equal(second.classList.contains('feedback-pressed'), true);
});

test('loading 不靠计时器变成功，状态层不修改文案或业务禁用标志', () => {
  const f = fixture();
  const target = control({ disabled: true });
  f.state(target, 'loading');
  assert.equal(target.getAttribute('aria-busy'), 'true');
  f.flush(Infinity);
  assert.equal(target.dataset.feedbackState, 'loading');
  assert.equal(target.disabled, true);
  assert.equal(target.textContent, '原按钮文字');
});

test('成功、失败和新请求的结果计时器相互隔离，不清掉后来的 loading', () => {
  const f = fixture();
  const target = control();
  f.state(target, 'success');
  assert.equal(target.getAttribute('aria-busy'), null);
  f.state(target, 'error');
  assert.equal(f.timers.size, 1);
  f.state(target, 'loading');
  f.flush(Infinity);
  assert.equal(target.dataset.feedbackState, 'loading');
  f.state(target, 'error');
  f.flush(1800);
  assert.equal(target.dataset.feedbackState, undefined);
});

test('爪印只由明确成功并请求 paw 的结果触发', () => {
  const f = fixture();
  const target = control();
  f.state(target, 'loading', { paw: true });
  assert.equal(target.classList.contains('feedback-match-complete'), false);
  f.state(target, 'success', { paw: true });
  assert.equal(target.classList.contains('feedback-match-complete'), true);
  f.state(target, 'error', { paw: true });
  assert.equal(target.classList.contains('feedback-match-complete'), false);
});

test('减少动态效果保留处理状态，但无回弹和爪印', () => {
  const f = fixture(true);
  const target = control();
  f.emit('document', 'pointerdown', { target });
  f.emit('window', 'pointerup');
  assert.equal(target.classList.contains('feedback-rebound'), false);
  f.state(target, 'success', { paw: true });
  assert.equal(target.dataset.feedbackState, 'success');
  assert.equal(target.classList.contains('feedback-match-complete'), false);
});

test('动态改变减少动画偏好与历史离开均清理短暂回弹', () => {
  const f = fixture();
  const target = control();
  f.emit('document', 'pointerdown', { target });
  f.emit('window', 'pointerup');
  f.preference.matches = true;
  f.emit('preference', 'change');
  assert.equal(target.classList.contains('feedback-rebound'), false);
  f.state(target, 'success');
  f.emit('window', 'pagehide');
  assert.equal(target.dataset.feedbackState, undefined);
  assert.equal(f.timers.size, 0);
});

test('重复装载共享脚本不重复注册监听器', () => {
  const f = fixture();
  const api = f.window.YardButtonFeedback;
  vm.runInContext(source, f.context);
  assert.equal(f.window.YardButtonFeedback, api);
  f.emit('document', 'click', { target: control(), detail: 0 });
  assert.equal(f.timers.size, 1);
  f.state(null, 'success');
});

test('七页通过相对路径先装载共享反馈再装载业务脚本', () => {
  for (const file of ['index', 'pets', 'match', 'adoption', 'stories', 'about', 'admin']) {
    const html = fs.readFileSync(path.join(root, file + '.html'), 'utf8');
    assert.equal((html.match(/src="button-feedback\.js" defer/g) || []).length, 1);
    assert.ok(html.indexOf('src="button-feedback.js"') < html.indexOf('src="app.js"'));
  }
  assert.match(fs.readFileSync(path.join(root, 'eslint.config.mjs'), 'utf8'), /'button-feedback\.js'/);
});

test('CSS 包含独立按压、筛选、箭头、状态和减少动态效果规则', () => {
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  for (const rule of [
    'button-soft-release 280ms',
    'button-quiet-release 140ms',
    '.filter-button.active::after',
    '.feedback-selected::before',
    'translate: 4px 0',
    '[data-feedback-state="loading"]::before',
    '[data-feedback-state="error"]::before'
  ]) {
    assert.ok(css.includes(rule), rule);
  }
  assert.match(css, /prefers-reduced-motion: reduce[\s\S]*feedback-pressed \{ scale: none; \}/);
  assert.match(css, /feedback-match-complete::after \{ display: none;/);
});

test('反馈模块不读取网络、云端、存储或申请资料，也不改变页面路由', () => {
  assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|location\.|history\.|cloudbase/);
});

// 执行 app.js 的真实流式匹配入口；fetch 由内存数据替身提供，从不建立连接。
async function testMatch(label, chunks, expected, { aborted = false, local = false } = {}) {
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  const askStart = app.indexOf('async function matchAsk(');
  const busyStart = app.indexOf('function matchSetBusy(');
  const ask = app.slice(askStart, app.indexOf('\nfunction resetMatchAssistant', askStart));
  const busy = app.slice(busyStart, app.indexOf('\n/**', busyStart));
  assert.ok(ask && busy);
  const submit = control();
  const input = { value: '离线匹配测试', focus() {} };
  const thread = { scrollTop: 0, scrollHeight: 100 };
  const feedback = [];
  let requests = 0;
  const context = vm.createContext({
    LOCAL_REVIEW: local,
    AI_MATCH_ENDPOINT: 'https://offline.invalid/not-requested',
    MATCH_MAX_TURNS: 8,
    MATCH_TOOL_LABELS: {},
    matchState: { streaming: false, messages: [], controller: null },
    matchElements: () => ({ thread, input, submit, reset: null }),
    matchAppend: () => control(),
    matchSetToolStatus() {},
    matchSetModeHint() {},
    matchAppendSources() {},
    matchAppendSpeak() {},
    buttonFeedback: (_button, state, options) => feedback.push({ state, paw: Boolean(options?.paw) }),
    $: () => submit,
    AbortController,
    TextDecoder,
    fetch: async () => {
      requests++;
      if (aborted) throw Object.assign(new Error('Cancelled'), { name: 'AbortError' });
      let sent = false;
      return {
        ok: true,
        body: {
          getReader: () => ({
            read: async () => {
              if (sent) return { done: true };
              sent = true;
              return { done: false, value: new TextEncoder().encode(chunks.map(item => `data: ${JSON.stringify(item)}\n\n`).join('')) };
            }
          })
        }
      };
    }
  });
  vm.runInContext(`${busy}\n${ask}`, context, { timeout: 1000 });
  await vm.runInContext('matchAsk()', context);
  assert.deepEqual(
    feedback.map(item => item.state),
    local ? [] : ['loading', expected]
  );
  assert.equal(
    feedback.some(item => item.paw),
    expected === 'success'
  );
  assert.equal(submit.disabled, false);
  assert.equal(requests, local ? 0 : 1, 'Only an in-memory stub is invoked');
  passed++;
  console.log(`PASS ${label}`);
}

(async () => {
  await testMatch('真实匹配入口在完整内存回复结束后才给成功爪印', [{ type: 'delta', text: '离线测试回答' }], 'success');
  await testMatch('空回复与仅错误响应不给成功反馈', [{ type: 'error', message: '离线模拟失败' }], 'error');
  await testMatch(
    '部分回复之后的流错误不误报成功',
    [
      { type: 'delta', text: '不完整回复' },
      { type: 'error', message: '离线模拟中断' }
    ],
    'error'
  );
  await testMatch('主动停止恢复普通按钮而不是成功或失败庆祝', [], 'idle', { aborted: true });
  await testMatch('本地审核模式不触发匹配请求或成功动效', [], 'idle', { local: true });
  console.log(`\n${passed} 组按钮反馈离线回归通过；无服务器、无网络请求。`);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
