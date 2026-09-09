import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'parse5';
const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root), 'utf8');
function descendants(node) { return [node, ...(node.childNodes || []).flatMap(descendants)]; }
function attr(node, name) { return node.attrs?.find(a => a.name === name)?.value; }
function text(node) { return descendants(node).filter(n => n.nodeName === '#text').map(n => n.value).join(''); }
test('case study follows the five reference headings and stays standalone', async () => {
  const html = await read('case-study.html');
  const nodes = descendants(parse(html));
  assert.deepEqual(nodes.filter(n => n.tagName === 'h2').map(text), [
    '想定した課題と、制作の目的', 'デザインに込めた意図', '共感から購入の検討への体験設計',
    '制作工程と実装範囲', '制作において確認したこと、今後検証すること'
  ]);
  assert.equal(nodes.filter(n => n.tagName === 'h1').length, 1);
  assert.equal(nodes.filter(n => n.tagName === 'main').length, 1);
  assert.ok(nodes.some(n => n.tagName === 'a' && attr(n, 'href') === './#/about'));
  for (const img of nodes.filter(n => n.tagName === 'img')) {
    assert.ok(attr(img, 'alt')); await read(attr(img, 'src'));
  }
  assert.ok(html.includes('runtime/site-update.js'));
  assert.ok(!html.includes('runtime/main-public'));
  assert.ok(html.includes('実在する店舗からの受託案件ではありません'));
});
test('About CTA is its last section, before the shared footer', async () => {
  const nodes = descendants(parse(await read('PublicAbout.dc.html')));
  const sections = nodes.filter(n => n.tagName === 'section');
  const cta = sections.at(-1);
  assert.equal(attr(cta, 'aria-labelledby'), 'about-case-study-title');
  assert.ok(descendants(cta).some(n => n.tagName === 'a' && attr(n, 'href') === '{{ vm.caseStudyHref }}'));
  const shell = await read('TSUMUGI.dc.html');
  assert.ok(shell.indexOf('name="PublicAbout"') < shell.indexOf('<footer'));
  assert.ok(shell.includes('window.TSUMUGI_IMAGES.asset("case-study.html")'));
  assert.ok((await read('build/prerender.mjs')).includes('"../case-study.html"'));
});
