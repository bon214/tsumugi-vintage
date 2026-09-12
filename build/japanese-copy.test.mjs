import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("approved Japanese storefront proofreading remains applied", async () => {
  const source = await read("tsumugi-i18n-public.js");
  const expected = [
    "日本国内は送料無料です。",
    "人と服との時間が新しく繋がっていきますように。\\nそんな想いを込めた古着屋です。",
    "それら全てを知ったうえで「着たい」と思ってもらえること。",
    "そんな人と服との出会いをつくることが、私たちの仕事だと考えています。",
    "同じ服にもう一度出会える機会は、なかなかありません。",
    "だから私たちは一着ずつ丁寧に向き合って選びます。",
    "そのきっかけを、TSUMUGIからお届けします。",
    "どれも大切に着られ、時を重ねてきた一着です。",
    "検索条件に合う品はありません。",
    "こちらのリンクは一度のみ有効で、有効期限があります。",
    "このリンクは有効期限が切れているか、すでに使用されています。",
    "パスワードの再設定には認証サービスへの接続が必要です。",
    "該当するメールアドレスのアカウントが存在する場合、再設定用のリンクをお送りしました。",
    "ご注文を処理中です。",
    "ご注文完了の控えは、ご注文時の画面でのみ表示されます。",
    "希望があれば個人の方とも、\\n一着ずつ",
    "一着ごとの状態や背景を、できるだけ正直に記載します。",
    "皆様に今も着たいと思っていただけるかを判断材料にしています。",
  ];
  for (const text of expected) assert.ok(source.includes(text), text);

  const retired = [
    "日本国内は送料無料。\"],",
    "だから私達は一着ずつ",
    "その検索に合う品はありません。",
    "パスワード再設定には認証サービスの接続が必要です。",
    "一着ごとの状態や背景を、できるだけ正直に書き残し、記載します。",
    "皆様が今も着たいと思って貰えるか",
  ];
  for (const text of retired) assert.ok(!source.includes(text), text);
});

test("approved catalogue proofreading remains applied", async () => {
  const data = JSON.parse(await read("supabase/seed/production-content.json"));
  const productNotes = new Map(data.products.map((product) => [product.sku, product.condition_note]));
  assert.equal(productNotes.get("TSU-ARC-002"), "起毛は均一で、輪郭が崩れない程度に生地がなじんだ状態を想定しています。ボタンの欠損はない設定です。");
  assert.equal(productNotes.get("TSU-ARC-006"), "杢グレー全体に洗い込まれた柔らかさがあり、リブは形を保っている状態を想定しています。");
  assert.equal(productNotes.get("TSU-ARC-008"), "表面に軽いアタリと柔らかさがあり、縫製線が保たれた状態を想定しています。");
  assert.equal(productNotes.get("TSU-ARC-011"), "縫い代と襟にグレーのアタリがあり、デニムの張りはほどよく残っている状態を想定しています。");

  const articles = new Map(data.news.map((article) => [article.id, article]));
  assert.equal(articles.get(1).summary, "布・縫い目・シルエットから、その服がこれからも着続けられるかを確かめます。");
  assert.match(articles.get(1).body, /別の観点に目を向けることで見えてきます。/);
  assert.match(articles.get(1).body, /色ではなく、繊維と構造から状態を読みます。/);
  assert.match(articles.get(1).seo_description, /力の集まる箇所/);
  assert.match(articles.get(3).body, /表面の埃なら柔らかなブラシをかけ/);
  assert.match(articles.get(3).seo_description, /洗濯前に湿気を逃がす方法から/);
  assert.match(articles.get(5).body, /すべての商品において同じ生成りの壁/);
  assert.match(data.special_features.find((feature) => feature.id === "sf-light-outerwear").description_ja, /冬のコートにはまだ早い時期に。/);
});

test("approved case-study proofreading remains applied", async () => {
  const html = await read("case-study.html");
  const expected = [
    "店舗のコンセプトに沿うものを選定しました。",
    "撮り方を統一した写真",
    "Aboutではそれぞれの服を選ぶ基準を",
    "店主の姿勢を知ってから選べる導線も用意しました。",
    "画像・文章・コードの作成、レビューや検証を進めました。",
    "店舗イメージには、AI生成画像を使用しています。",
    "カート・購入手続き画面、About・Journalを制作しました。",
    "店舗空間をBlenderで制作。",
    "空間の制作は継続中です。",
    "共感を呼ぶことを狙い、記事ページなどを作成しました。",
  ];
  for (const text of expected) assert.ok(html.includes(text), text);
});
