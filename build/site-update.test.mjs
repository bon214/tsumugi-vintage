import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { finalizeRelease } from './finalize-release.mjs';
const source = await readFile(new URL('../runtime/site-update.js', import.meta.url), 'utf8');
const A = 'a'.repeat(64), B = 'b'.repeat(64), C = 'c'.repeat(64);
const flush = async () => { for (let n = 0; n < 12; n++) await new Promise(resolve => setImmediate(resolve)); };
function browser(options = {}) {
  const listeners = {}, elements = [], calls = [], navigation = [], intervals = [];
  const storage = options.storage || new Map();
  const listen = (type, fn) => (listeners[type] ||= []).push(fn);
  const emit = (type, target) => { for (const fn of listeners[type] || []) fn({ target }); };
  const create = tag => ({ tagName: tag.toUpperCase(), style: {}, children: [], setAttribute() {},
    append(...nodes) { this.children.push(...nodes); }, addEventListener(type, fn) { this[type] = fn; } });
  const doc = { currentScript: { src: 'https://example.com/tsumugi/runtime/site-update.js?v=old', dataset: { release: A } },
    documentElement: { lang: 'ja' }, visibilityState: options.hidden ? 'hidden' : 'visible', readyState: 'complete',
    activeElement: null, addEventListener: listen, createElement: create,
    body: { append(node) { elements.push(node); } } };
  const location = new URL(options.url || 'https://example.com/tsumugi/?lang=en#/home');
  location.replace = url => navigation.push(url);
  const navigator = { onLine: options.online !== false };
  const context = { document: doc, location, navigator, URL, AbortController, Date, JSON, console,
    history: { state: { preserved: true }, replaceState(state, _, url) { context.history.replaced = { state, url }; location.href = url; } },
    sessionStorage: { getItem: key => { if (options.noStorage) throw Error(); return storage.get(key); },
      setItem: (key, value) => { if (options.noStorage) throw Error(); storage.set(key, value); } },
    setInterval: fn => intervals.push(fn), setTimeout, clearTimeout, addEventListener: listen,
    confirm: () => options.confirm !== false,
    fetch: async (url, init) => {
      calls.push({ url: String(url), init });
      if (options.fetch) return options.fetch(url, init, calls.length);
      if (options.error) throw new Error('offline');
      return { ok: options.ok !== false, text: async () => String(url).includes('version.json')
        ? JSON.stringify({ version: options.version || B })
        : `<meta name="tsumugi-release" content="${options.htmlVersion || options.version || B}">` };
    } };
  context.window = context;
  vm.runInNewContext(source, context);
  return { emit, doc, context, navigation, calls, elements, intervals, storage };
}
test('new release reloads same route/query using fresh manifest and HTML', async () => {
  const b = browser(); await flush();
  assert.equal(b.navigation.length, 1);
  const url = new URL(b.navigation[0]);
  assert.equal(url.hash, '#/home'); assert.equal(url.searchParams.get('lang'), 'en');
  assert.equal(url.searchParams.get('__tsumugi_update'), B);
  assert.equal(new URL(b.calls[0].url).pathname, '/tsumugi/version.json');
  assert.ok(b.calls.every(c => c.init.cache === 'no-store'));
});
test('same release does not reload; timer and restored tab check again', async () => {
  const b = browser({ version: A }); await flush();
  b.intervals[0](); await flush(); b.emit('visibilitychange'); await flush();
  assert.equal(b.calls.length, 3); assert.equal(b.navigation.length, 0);
});
test('hidden/offline tabs wait until visible/online', async () => {
  const b = browser({ hidden: true, online: false }); await flush(); assert.equal(b.calls.length, 0);
  b.doc.visibilityState = 'visible'; b.context.navigator.onLine = true; b.emit('online'); await flush();
  assert.equal(b.navigation.length, 1);
});
test('input during fetch prevents reload; submit does not drop protection', async () => {
  const b = browser(); b.emit('input', { matches: () => true }); b.emit('submit'); await flush();
  assert.equal(b.navigation.length, 0); assert.equal(b.elements.length, 1);
});
test('admin and checkout always require explicit update', async () => {
  for (const url of ['https://example.com/tsumugi/admin.html', 'https://example.com/tsumugi/#/checkout', 'https://example.com/tsumugi/checkout/']) {
    const b = browser({ url }); await flush(); assert.equal(b.navigation.length, 0); assert.equal(b.elements.length, 1);
    b.elements[0].children[1].click(); await flush(); assert.equal(b.navigation.length, 1);
  }
});
test('cancel preserves edited content', async () => {
  const b = browser({ confirm: false }); b.emit('input', { matches: () => true }); await flush();
  b.elements[0].children[1].click(); await flush(); assert.equal(b.navigation.length, 0);
});
test('bad network, HTTP error, malformed release and stale HTML never reload', async () => {
  for (const option of [{ error: true }, { ok: false }, { version: 'invalid' }, { htmlVersion: A }]) {
    const b = browser(option); await flush(); assert.equal(b.navigation.length, 0);
  }
});
test('storage guard and URL fallback stop automatic loops', async () => {
  const storage = new Map([['tsumugi:update:/tsumugi/', JSON.stringify({ target: B, time: Date.now() })]]);
  for (const option of [{ storage }, { noStorage: true, url: `https://example.com/tsumugi/?__tsumugi_update=${B}#/home` }]) {
    const b = browser(option); await flush(); b.intervals[0](); await flush(); assert.equal(b.navigation.length, 0);
  }
  const b = browser({ storage, version: C }); await flush(); assert.equal(b.navigation.length, 0);
});
test('successful update cleans its marker while preserving history state', async () => {
  const b = browser({ version: A, url: `https://example.com/tsumugi/?lang=en&__tsumugi_update=${A}#/shop` });
  await flush(); assert.equal(b.context.location.hash, '#/shop'); assert.equal(b.context.location.search, '?lang=en');
  assert.equal(b.context.history.replaced.state.preserved, true);
});
test('local script load failure retries once, unrelated images do not', async () => {
  const b = browser({ version: A }); await flush();
  b.emit('error', { tagName: 'IMG', src: 'https://example.com/image.png' }); await flush(); assert.equal(b.navigation.length, 0);
  b.emit('error', { tagName: 'SCRIPT', src: 'https://example.com/tsumugi/runtime/main-public.bundle.js' });
  await flush(); assert.equal(b.navigation.length, 1);
  const next = browser({ version: A, storage: b.storage }); await flush();
  next.emit('error', { tagName: 'SCRIPT', src: 'https://example.com/tsumugi/runtime/main-public.bundle.js' });
  await flush(); assert.equal(next.navigation.length, 0); assert.equal(next.elements.length, 1);
});
test('build release tracks HTML and image changes and matches all page markers', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tsumugi-release-test-'));
  const html = '<meta name="tsumugi-release" content="__TSUMUGI_RELEASE__"><script data-release="__TSUMUGI_RELEASE__" src="app.js?v=abcdef"></script>';
  try {
    const build = async (content, image) => {
      await writeFile(path.join(dir, 'index.html'), content); await writeFile(path.join(dir, 'photo.jpg'), image);
      return finalizeRelease(dir);
    };
    const first = await build(html, 'one');
    assert.equal(await build(html, 'one'), first);
    const second = await build(html + '<p>Changed</p>', 'one'); assert.notEqual(first, second);
    const third = await build(html, 'two'); assert.notEqual(first, third);
    assert.equal(JSON.parse(await readFile(path.join(dir, 'version.json'))).version, third);
    const output = await readFile(path.join(dir, 'index.html'), 'utf8');
    assert.ok(output.includes(`?v=${third}`)); assert.ok(!output.includes('__TSUMUGI_RELEASE__'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('storage-disabled successful adoption retains a guard against repeated boot failures', async () => {
  const b = browser({ noStorage: true, version: A, url: `https://example.com/tsumugi/?__tsumugi_update=${A}#/home` });
  await flush(); b.emit('error', { tagName: 'SCRIPT', src: 'https://example.com/tsumugi/runtime/main-public.bundle.js' });
  await flush(); assert.equal(b.navigation.length, 0); assert.equal(b.elements.length, 1);
});
