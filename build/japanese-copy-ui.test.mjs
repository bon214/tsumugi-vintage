import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const read = file => readFile(new URL('../' + file, import.meta.url), 'utf8');
const window = {};
for (const part of ['public', 'admin', 'orders', 'content']) {
  vm.runInNewContext(await read(`tsumugi-i18n-${part}.js`), { window });
}
const parts = window.TSUMUGI_I18N_PARTS;

test('Japanese proofreading preserves English copy and all UI lookup keys', () => {
  const expected = {
    PUB: '94270b9e36bf9d48d5a9c88fedd4f97156b38e40026fdb2a1c7feae7587b3e55',
    ADM: '5ab53dc0a2321d0294f92eb68318da1090dd0b801045b3101f6e8e9198c17ebf',
    ORD: 'cbcf9cf072fbbebc2ade6440fa88c16b3ad22ad2246bac67e6d3c20c5180cd87',
    ADM2: '74a817570abfb7d27af1d0990a1a0098d536d6a700fe7a0a762c3a0ec4895984'
  };
  for (const [name, hash] of Object.entries(expected)) {
    const english = Object.entries(parts[name]).map(([key, pair]) => [key, pair[0]]);
    assert.equal(createHash('sha256').update(JSON.stringify(english)).digest('hex'), hash, name);
  }
});

test('polished admin labels retain readable actions and guest sorting permission', async () => {
  assert.equal(parts.ADM.fcAdd[1], 'コンテンツを追加');
  assert.equal(parts.ADM.fcSource[1], '参照先');
  assert.equal(parts.ADM.rememberMe[1], 'ログイン状態を保持');
  assert.equal(parts.PUB.sort[1], '並べ替え ▾');
  const shell = await read('TSUMUGI Admin.dc.html');
  const pattern = shell.match(/const READ_ONLY_OK = (\/.+\/i);/)[1];
  const allowed = vm.runInNewContext(pattern);
  assert.ok(allowed.test('並べ替え'));
  assert.ok(!allowed.test('コンテンツを追加'));
  assert.ok(!allowed.test('削除'));
});

test('polished demo explanations still explicitly deny real email, orders and security', () => {
  assert.match(parts.PUB.thanksMsg[1], /ご入力内容は送信されておらず、誰にも届きません/);
  assert.match(parts.ORD.demoCheckout[1], /このブラウザの外では注文も決済も行われません/);
  assert.match(parts.ORD.roleDemoNote[1], /実際のセキュリティ機能ではありません/);
  assert.match(parts.PUB.accResetSent[1], /アカウントが存在する場合/);
  assert.match(parts.ADM.authResetSent[1], /管理者アカウントに登録されている場合/);
  assert.equal(parts.ADM.fcAtMax[1], 'Heroは最大{n}件までです。');
  assert.equal(parts.ADM.sfCandidateFull[1], '候補商品は最大{n}点までです。');
});

test('CMS article images stay inside the existing text column without distortion', async () => {
  const source = await read('TSUMUGI.dc.html');
  assert.match(source, /\[data-article-body\] img \{ display: block; max-width: 100%; height: auto; \}/);
  assert.match(source, /\[data-article-body\] \{ overflow-wrap: anywhere; \}/);
});
