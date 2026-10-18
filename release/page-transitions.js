/* 独立页面按主导航顺序推移；保留浏览器的普通链接、历史记录和滚动恢复。 */
(() => {
  const siteBase = new URL('.', document.currentScript.src);
  const pagePaths = ['index.html', 'pets.html', 'match.html', 'adoption.html', 'stories.html', 'about.html', 'admin.html'].map(file => new URL(file, siteBase).pathname);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handoffKey = 'yard:page-transition';
  let clearEntries = () => {};

  function enterContent(transition) {
    // 只编排首屏可见的独立内容，不延迟导航、不等图片，也不反复播放滚动揭示。
    const entries = [...document.querySelectorAll('[data-page-entry], .pet-grid > .pet-card')]
      .filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
      })
      .slice(0, 6);
    const previous = entries.map(element => element.style.viewTransitionName);
    entries.forEach((element, index) => {
      element.style.viewTransitionName = `site-entry-${index}`;
      element.classList.add('page-entry-active');
      // 首页原有首次打开动画不能在快照结束、清理命名时重新播放。
      if (element.classList.contains('reveal')) element.classList.add('page-entry-settled');
    });
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      entries.forEach((element, index) => {
        element.style.viewTransitionName = previous[index];
        element.classList.remove('page-entry-active');
      });
      if (clearEntries === cleanup) clearEntries = () => {};
    };
    clearEntries = cleanup;
    // 完成、被跳过或中途再次导航均恢复 DOM，避免污染历史缓存。
    transition.finished.then(cleanup, cleanup);
    transition.ready.catch(() => {});
  }

  function pageIndex(value) {
    if (!value) return -1;
    try {
      const url = new URL(value, siteBase);
      if (url.origin !== siteBase.origin || !['http:', 'https:'].includes(url.protocol)) return -1;
      return url.pathname === siteBase.pathname ? 0 : pagePaths.indexOf(url.pathname);
    } catch {
      return -1;
    }
  }

  function setDirection(transition, from, to, navigationType) {
    if (!transition) return;
    // 同页参数、刷新、站外跳转及不支持方向信息的浏览器都保留直接导航。
    if (reducedMotion.matches || navigationType === 'reload' || from < 0 || to < 0 || from === to || !transition.types?.add) {
      transition.skipTransition();
      return;
    }
    // 历史返回也比较真实起终点，不把“返回”一律当作向右。
    transition.types.add(to > from ? 'site-forward' : 'site-backward');
    enterContent(transition);
  }

  window.addEventListener('pageswap', event => {
    clearEntries();
    const from = pageIndex(window.location.href);
    const activation = event.activation;
    // no-referrer 等策略可能隐藏历史条目的 URL。只交接页序与条目键，
    // 不保存完整地址、查询参数、表单内容，也不改动原生历史记录。
    try {
      window.sessionStorage.removeItem(handoffKey);
      if (event.viewTransition && from >= 0 && activation?.from?.key) {
        window.sessionStorage.setItem(handoffKey, JSON.stringify({ from, fromKey: activation.from.key }));
      }
    } catch {
      /* 存储不可用时，仍可使用浏览器提供的导航地址或直接跳转。 */
    }
    if (event.viewTransition && reducedMotion.matches) event.viewTransition.skipTransition();
  });
  window.addEventListener('pagereveal', event => {
    const activation = window.navigation?.activation;
    let from = pageIndex(activation?.from?.url);
    try {
      const stored = window.sessionStorage.getItem(handoffKey);
      window.sessionStorage.removeItem(handoffKey);
      const handoff = JSON.parse(stored || 'null');
      // 新页面提交时目标条目键可能被浏览器重新生成；只核对实际来源键。
      if (from < 0 && handoff?.fromKey === activation?.from?.key && Number.isInteger(handoff?.from) && handoff.from >= 0 && handoff.from < pagePaths.length) {
        from = handoff.from;
      }
    } catch {
      /* 不依赖存储可用性，导航始终由浏览器完成。 */
    }
    setDirection(event.viewTransition, from, pageIndex(window.location.href), activation?.navigationType);
  });
})();
