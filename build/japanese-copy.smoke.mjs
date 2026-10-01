// Read-only layout check against the public CMS and local admin demo.
// No production mutations, authentication emails, or analytics requests are allowed.
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve('dist');
const output = path.resolve(process.env.COPY_QA_OUTPUT || '../reports/current_site_copy_browser');
await mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const relative = decodeURIComponent(url.pathname).replace(/^\/tsumugi-vintage/, '');
  const file = path.resolve(root, '.' + (relative.endsWith('/') ? relative + 'index.html' : relative));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  try {
    res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'})[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const local = `http://127.0.0.1:${server.address().port}/tsumugi-vintage/`;
const base = process.env.COPY_QA_BASE || local;
const results = [], errors = [], blockedWrites = [], analytics = [];
let browser;
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => localStorage.setItem('tsumugi.analytics.excluded', '1'));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (/google-analytics|googletagmanager|analytics\.google/.test(url.hostname)) {
      analytics.push(request.url()); return route.abort();
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      blockedWrites.push(request.method() + ' ' + url.pathname); return route.abort();
    }
    if (![new URL(base).hostname, 'reuchjojoyivxfmjrcrh.supabase.co', 'bon214.github.io', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.abort();
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '#/home');
  await page.waitForFunction(() => window.TSUMUGI_STORE?.cmsStatus() === 'ready');
  await page.evaluate(() => window.TSUMUGI_STORE.setLang('ja'));
  const data = await page.evaluate(() => {
    const S = window.TSUMUGI_STORE;
    return { products: S.publicProducts().map(p => p.id), articles: S.publicNews().map(n => n.slug), specials: S.all().specialFeatures.map(s => s.slug) };
  });
  const routes = ['home','about','shop','journal','contact','cart','checkout','account','account/recover','analytics',
    ...data.products.map(id => 'product/' + id), ...data.articles.map(slug => 'journal/' + slug), ...data.specials.map(slug => 'feature/' + slug)];
  async function inspect(name, width) {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(80);
    await page.evaluate(() => Promise.all(document.getAnimations().filter(animation => {
      const timing = animation.effect?.getTiming(); return timing && timing.iterations !== Infinity && timing.duration <= 1500;
    }).map(animation => animation.finished.catch(() => {}))));
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      text: document.body.innerText,
      clippedButtons: [...document.querySelectorAll('button')].filter(el => {
        // Symbol-only controls (e.g. tag-removal ×) have font line boxes larger
        // than their visible glyph. This check is for copy labels, not icons.
        const box=el.getBoundingClientRect(); if (!box.width || !box.height || !/[ぁ-んァ-ヶ一-龠A-Za-z0-9]/.test(el.innerText)) return false;
        const range=document.createRange(); range.selectNodeContents(el); const rect=range.getBoundingClientRect();
        return rect.width > box.width + 2 || rect.height > box.height + 2;
      }).map(el => el.innerText)
    }));
    if (layout.overflow || layout.clippedButtons.length) {
      await page.screenshot({path:path.join(output,'layout-failure.png'),fullPage:true});
      console.log(JSON.stringify(await page.evaluate(() => [...document.querySelectorAll('body *')].filter(el => {
        const r=el.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && r.left >= 0;
      }).slice(-20).map(el=>({tag:el.tagName,text:el.innerText?.slice(0,160),width:el.getBoundingClientRect().width,style:el.getAttribute('style')}))),null,2));
    }
    assert.equal(layout.overflow, false, name + ' horizontal overflow at ' + width);
    assert.deepEqual(layout.clippedButtons, [], name + ' clipped button at ' + width);
    assert.ok(!/済みみ|並び替え|Featureを追加|誤差が発生するを/.test(layout.text), name + ' old/invalid copy');
    results.push({ route:name, width, horizontalOverflow:false, clippedButtons:0 });
  }
  for (const width of [390,768,1440]) {
    await page.setViewportSize({width, height:900});
    for (const route of routes) {
      await page.evaluate(route => { location.hash = '#/' + route; }, route);
      await inspect(route, width);
      if (['about','contact','analytics', 'journal/' + data.articles[1]].includes(route) && width !== 768) {
        await page.screenshot({path:path.join(output, `${route.replaceAll('/','-')}-${width}.png`), fullPage:true});
      }
    }
    await page.goto(base + 'case-study.html');
    await inspect('case-study.html', width);
    await page.screenshot({path:path.join(output, `case-study-${width}.png`), fullPage:true});
    await page.goto(base + '#/home');
    await page.waitForFunction(() => window.TSUMUGI_STORE?.cmsStatus() === 'ready');
    await page.evaluate(() => window.TSUMUGI_STORE.setLang('ja'));
  }
  // Public guest entry stores only a read-only browser session, not an Auth user.
  await page.goto(base + 'admin.html');
  await page.waitForFunction(() => window.TSUMUGI_AUTH?.status() === 'signed_out');
  await page.evaluate(async () => {
    await window.TSUMUGI_AUTH.signInAsGuest(); window.TSUMUGI_STORE.setLang('ja');
  });
  await page.waitForFunction(() => window.TSUMUGI_STORE?.cmsStatus() === 'ready');
  const adminRoutes=['admin','admin/products','admin/products/new','admin/products/'+data.products[0],
    'admin/news','admin/news/new','admin/news/2','admin/orders','admin/customers','admin/featured','admin/specials','admin/settings'];
  for (const width of [390,768,1440]) {
    await page.setViewportSize({width,height:900});
    for (const route of adminRoutes) {
      await page.evaluate(route => { location.hash = '#/' + route; }, route);
      await inspect(route,width);
      if (['admin/featured','admin/news/2'].includes(route) && width !== 768) await page.screenshot({path:path.join(output,`${route.replaceAll('/','-')}-${width}.png`),fullPage:true});
    }
  }
  assert.deepEqual(errors, [], 'browser runtime exceptions');
  assert.deepEqual(blockedWrites, [], 'unexpected write attempted');
  assert.deepEqual(analytics, [], 'analytics must not even initialize');
  console.log(JSON.stringify({passed:results.length,products:data.products.length,articles:data.articles.length,errors,blockedWrites,analytics}));
  await writeFile(path.join(output,'results.json'),JSON.stringify({base,results,errors,blockedWrites,analytics},null,2));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
