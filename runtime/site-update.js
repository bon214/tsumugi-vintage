/* Loaded before the application so recovery also works when its scripts fail. */
(() => {
  'use strict';
  const script = document.currentScript;
  const current = script && script.dataset.release;
  if (!/^[a-f0-9]{64}$/.test(current || '')) return;
  const base = new URL('../', script.src);
  const key = 'tsumugi:update:' + base.pathname;
  const param = '__tsumugi_update';
  let dirty = false, busy = false, navigating = false, failed = false, pending = null;
  let banner, message, button;
  const protectedPage = () => dirty || /\/admin\.html$/.test(location.pathname)
    || /^#\/(checkout|auth|account)(\/|\?|$)/.test(location.hash)
    || /\/(checkout|auth|account)\//.test(location.pathname)
    || !!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
  const edited = (event) => {
    if (event.target?.matches('input,textarea,select,[contenteditable="true"]')
      || event.target?.isContentEditable) dirty = true;
  };
  document.addEventListener('input', edited, true);
  document.addEventListener('change', edited, true);
  // Do not reset on submit: network saves may still be pending or may fail.
  const text = () => document.documentElement.lang.startsWith('en') ? {
    update: 'An update is available. Save your work before updating.',
    retry: 'The page could not finish loading. Check your connection and try updating.',
    button: 'Update page', confirm: 'Reload this page? Unsaved entries may be lost.'
  } : {
    update: 'サイトが更新されました。入力中の内容を保存してから更新してください。',
    retry: 'ページを読み込めませんでした。通信状態を確認して、更新をお試しください。',
    button: '最新版に更新', confirm: 'ページを更新しますか？保存していない入力内容は失われる場合があります。'
  };
  function notice(recovery = false) {
    if (!document.body) return;
    if (!banner) {
      banner = document.createElement('aside');
      banner.id = 'tsumugi-site-update';
      banner.setAttribute('aria-label', 'TSUMUGI');
      Object.assign(banner.style, { position: 'fixed', bottom: '16px', left: '16px', right: '16px',
        zIndex: '2147483647', margin: '0 auto', maxWidth: '680px', boxSizing: 'border-box',
        padding: '16px', background: '#222222', color: '#ffffff', boxShadow: '0 4px 24px #0003',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', font: '14px/1.6 system-ui,sans-serif' });
      message = document.createElement('span');
      message.setAttribute('role', 'status');
      Object.assign(message.style, { flex: '1 1 240px' });
      button = document.createElement('button');
      button.type = 'button';
      Object.assign(button.style, { minHeight: '44px', padding: '10px 16px', border: '1px solid #ffffff',
        background: '#ffffff', color: '#222222', font: 'inherit', cursor: 'pointer' });
      button.addEventListener('click', () => {
        if (protectedPage() && !window.confirm(text().confirm)) return;
        void check(true, true);
      });
      banner.append(message, button);
      document.body.append(banner);
    }
    message.textContent = recovery ? text().retry : text().update;
    button.textContent = text().button;
  }
  function autoAllowed(target) {
    // The URL marker is also a guard when storage is disabled or unavailable.
    if (new URL(location.href).searchParams.has(param)) return false;
    try {
      const previous = JSON.parse(sessionStorage.getItem(key) || 'null');
      return !previous || (previous.target !== target && Date.now() - previous.time > 300000);
    } catch { return true; }
  }
  async function get(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
      if (!response.ok) throw new Error('Update unavailable');
      return await response.text();
    } finally { clearTimeout(timer); }
  }
  async function check(recovery = false, manual = false) {
    if (busy || navigating || navigator.onLine === false || document.visibilityState === 'hidden') return;
    busy = true;
    if (button) button.disabled = true;
    try {
      const versionUrl = new URL('version.json', base);
      versionUrl.searchParams.set('_', String(Date.now()));
      const release = JSON.parse(await get(versionUrl)).version;
      if (!/^[a-f0-9]{64}$/.test(release || '')) throw new Error('Invalid release');
      if (release === current && !recovery && !failed) return;
      pending = release;
      if (!manual && (protectedPage() || !autoAllowed(release))) { notice(release === current); return; }
      const destination = new URL(location.href);
      destination.searchParams.set(param, release);
      const probe = new URL(destination);
      probe.hash = '';
      probe.searchParams.set('_', String(Date.now()));
      const html = await get(probe);
      // Wait for HTML and manifest to agree; do not navigate into a partial/stale deployment.
      if (!html.includes('name="tsumugi-release" content="' + release + '"')) return;
      // A visitor may have started typing while the two requests were in flight.
      if (!manual && protectedPage()) { notice(); return; }
      if (navigator.onLine === false || document.visibilityState === 'hidden') return;
      try { sessionStorage.setItem(key, JSON.stringify({ target: release, time: Date.now() })); } catch { /* URL guard remains. */ }
      navigating = true;
      location.replace(destination.href);
    } catch {
      // A failed check never invalidates a working page or triggers a reload.
      if (recovery || failed || manual) notice(true);
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }
  function loadFailure(event) {
    const target = event.target;
    if (!target || !['SCRIPT', 'LINK'].includes(target.tagName)) return;
    const url = target.src || target.href;
    if (!url || new URL(url, location.href).origin !== location.origin) return;
    if (target.tagName === 'LINK' && target.rel !== 'stylesheet') return;
    failed = true;
    void check(true);
  }
  window.addEventListener('error', loadFailure, true);
  window.addEventListener('unhandledrejection', (event) => {
    if (/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed/i.test(String(event.reason?.message || event.reason))) {
      failed = true; void check(true);
    }
  });
  window.addEventListener('online', () => { void check(failed); });
  window.addEventListener('pageshow', () => { void check(failed); });
  document.addEventListener('visibilitychange', () => { void check(failed); });
  window.addEventListener('hashchange', () => { if (pending) void check(failed); });
  setInterval(() => { void check(failed); }, 60000);
  // Remove only our successfully adopted marker; preserve route, query and history state.
  const initial = new URL(location.href);
  if (initial.searchParams.get(param) === current) {
    try {
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, JSON.stringify({ target: current, time: Date.now() }));
      }
      if (sessionStorage.getItem(key)) {
        initial.searchParams.delete(param);
        history.replaceState(history.state, '', initial.href);
      }
    } catch { /* Keep the URL marker when storage cannot retain the loop guard. */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { void check(); }, { once: true });
  else void check();
})();
