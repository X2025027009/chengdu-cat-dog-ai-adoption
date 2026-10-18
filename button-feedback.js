/* 共享按钮反馈：只管理视觉状态，不拦截正常点击、不延迟导航、不发送请求。 */
(() => {
  if (window.YardButtonFeedback) return;
  const controls = 'button, a.button, a.text-link, a.footer-admin, a.nav-admin, label.button';
  const quiet = '.filter-button, .match-chip, .modal-close, .icon-button, .menu-toggle, .gallery-thumb, .footer-admin, .nav-admin, .admin-edit, .admin-delete, .media-delete-button';
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const releases = new Map();
  const outcomes = new Map();
  let pointer = null;
  let keyboard = null;

  function controlFor(target) {
    return target?.closest?.(controls) || null;
  }
  function blocked(control) {
    return !control?.isConnected || control.matches(':disabled') || control.getAttribute('aria-disabled') === 'true';
  }
  function decorate(control) {
    control.dataset.feedbackTone = control.matches(quiet) || control.closest('[data-page="admin"], .admin-shell, .crop-modal') ? 'quiet' : 'soft';
  }
  function clearRelease(control) {
    window.clearTimeout(releases.get(control));
    releases.delete(control);
    control.classList.remove('feedback-rebound');
  }
  function press(control) {
    if (blocked(control)) return;
    decorate(control);
    clearRelease(control);
    control.classList.add('feedback-pressed');
  }
  function release(control, rebound = false) {
    if (!control) return;
    const pressed = control.classList.contains('feedback-pressed');
    control.classList.remove('feedback-pressed');
    if (!pressed || !rebound || blocked(control) || preference.matches) return;
    control.classList.add('feedback-rebound');
    releases.set(
      control,
      window.setTimeout(() => clearRelease(control), 300)
    );
  }
  function resetPresses() {
    release(pointer?.control);
    release(keyboard);
    pointer = keyboard = null;
  }
  function clearState(control) {
    window.clearTimeout(outcomes.get(control));
    outcomes.delete(control);
    delete control.dataset.feedbackState;
    control.removeAttribute('aria-busy');
    control.classList.remove('feedback-match-complete');
  }
  function setState(control, state, options = {}) {
    if (!control) return;
    if (!['idle', 'loading', 'success', 'error'].includes(state)) return;
    clearState(control);
    if (state === 'idle') return;
    decorate(control);
    release(control);
    control.dataset.feedbackState = state;
    if (state === 'loading') control.setAttribute('aria-busy', 'true');
    if (state === 'success' && options.paw && !preference.matches) control.classList.add('feedback-match-complete');
    if (state !== 'loading')
      outcomes.set(
        control,
        window.setTimeout(() => clearState(control), 1800)
      );
  }

  document.addEventListener(
    'pointerdown',
    event => {
      if (event.button !== 0 || event.isPrimary === false) return;
      const control = controlFor(event.target);
      if (blocked(control)) return;
      resetPresses();
      pointer = { control, id: event.pointerId, x: event.clientX, y: event.clientY, type: event.pointerType, cancelled: false };
      press(control);
    },
    true
  );
  document.addEventListener(
    'pointermove',
    event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      if (pointer.type !== 'mouse' && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) {
        pointer.cancelled = true;
        release(pointer.control);
      }
    },
    { capture: true, passive: true }
  );
  document.addEventListener(
    'pointerout',
    event => {
      if (pointer?.id === event.pointerId && !pointer.control.contains(event.relatedTarget)) release(pointer.control);
    },
    true
  );
  document.addEventListener(
    'pointerover',
    event => {
      if (pointer?.id === event.pointerId && !pointer.cancelled && pointer.control.contains(event.target)) press(pointer.control);
    },
    true
  );
  window.addEventListener(
    'pointerup',
    event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const { control, cancelled } = pointer;
      pointer = null;
      const rect = control.getBoundingClientRect();
      const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      release(control, inside && !cancelled);
    },
    true
  );
  window.addEventListener(
    'pointercancel',
    event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      release(pointer.control);
      pointer = null;
    },
    true
  );
  document.addEventListener(
    'keydown',
    event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      const control = controlFor(event.target);
      // 嵌在上传标签内的原生文件输入仍由浏览器管理，不把按键当成标签点击。
      if (!control || event.target !== control || blocked(control) || event.repeat) return;
      if (event.key === ' ' && control.matches('a, label')) return;
      release(keyboard);
      keyboard = control;
      press(control);
    },
    true
  );
  document.addEventListener(
    'keyup',
    event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      release(keyboard, true);
      keyboard = null;
    },
    true
  );
  document.addEventListener(
    'focusout',
    event => {
      const control = controlFor(event.target);
      if (keyboard === control) {
        release(keyboard);
        keyboard = null;
      }
      if (pointer?.control === control) {
        release(control);
        pointer = null;
      }
    },
    true
  );
  document.addEventListener(
    'click',
    event => {
      const control = controlFor(event.target);
      if (blocked(control)) return;
      decorate(control);
      // 辅助技术触发的原生 click 没有 pointerdown，也能获得同一套即时反馈。
      if (event.detail === 0 && !control.classList.contains('feedback-pressed') && !control.classList.contains('feedback-rebound')) {
        press(control);
        release(control, true);
      }
    },
    true
  );
  window.addEventListener('blur', resetPresses);
  window.addEventListener('scroll', resetPresses, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetPresses();
  });
  window.addEventListener('pagehide', () => {
    resetPresses();
    for (const control of releases.keys()) clearRelease(control);
    // 往返缓存保留真实异步结果；这里只清理短暂装饰，不伪造或结束正在处理的操作。
    for (const control of outcomes.keys()) clearState(control);
  });
  preference.addEventListener?.('change', () => {
    resetPresses();
    for (const control of releases.keys()) clearRelease(control);
  });
  window.YardButtonFeedback = Object.freeze({ setState });
})();
