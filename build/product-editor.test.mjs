import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import { readFile } from "node:fs/promises";

const read = name => readFile(new URL("../" + name, import.meta.url), "utf8");
async function fixture() {
  const storage = () => { const m = new Map(); return { getItem:k => m.get(k) || null, setItem:(k,v) => m.set(k,String(v)), removeItem:k => m.delete(k) }; };
  class DCLogic {
    constructor(props) { this.props = props; }
    setState(v, cb) { Object.assign(this.state, typeof v === "function" ? v(this.state) : v); cb?.(); }
    forceUpdate() {}
  }
  const context = { window:{ crypto:webcrypto, innerWidth:1440, addEventListener(){}, dispatchEvent(){} },
    document:{ documentElement:{ setAttribute(){} } }, localStorage:storage(),sessionStorage:storage(),
    location:{ href:"https://example.invalid/" },URL,console,DCLogic,
    setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){} };
  for (const f of ["tsumugi-data.js","tsumugi-i18n-public.js","tsumugi-i18n-admin.js","tsumugi-i18n-orders.js","tsumugi-i18n-content.js","tsumugi-i18n.js"]) {
    vm.runInNewContext(await read(f), context);
  }
  const S=context.window.TSUMUGI_STORE, I=context.window.TSUMUGI_I18N;
  S.all().products=[]; S.all().heroFeatures=[]; S.all().news=[];
  assert.equal(S.login(S.DEMO.email,S.DEMO.password,false).ok,true);
  S.setLang("ja");
  const source=await read("AdminProducts.dc.html");
  const logic=source.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  const C=vm.runInNewContext("(()=>{"+logic+";return Component;})()",context);
  const c=new C({view:"new"}); c._syncForm();
  return {S,I,c,context,source};
}

test("every category has Japanese labels and usable category-specific measurements", async()=>{
  const {S,I,c}=await fixture();
  const expected={Outerwear:"shoulder",Trousers:"waist",Bottoms:"waist",Knitwear:"chest",Shirting:"chest",Sweatshirts:"sleeve",Skirts:"hip",Dresses:"waist",Footwear:"outsole",Accessories:"depth"};
  for (const [category,key] of Object.entries(expected)) {
    c.renderVals().onCategory({target:{value:category}});
    const vals=c.renderVals();
    assert.notEqual(I.tx(category,"ja"),category);
    assert.ok(vals.measurementFields.some(m=>m.id==="f-m-"+key),category);
    assert.ok(vals.measurementFields.every(m=>/[^\x00-\x7F]/.test(m.label)),category+" Japanese measurement labels");
    assert.ok(vals.categoryList.some(o=>o.v===category && o.t===I.tx(category,"ja")));
  }
  S.all().products.push({id:1,category:"Imported category"});
  assert.ok(S.productCategories().includes("Imported category"));
  assert.ok(S.measurementFields("Imported category").length>=2);
});

test("changing category preserves entered values, but hidden values do not satisfy readiness",async()=>{
  const {c}=await fixture();
  c._setMeasure("chest","52"); c._setMeasure("length","72");
  assert.equal(c._completeness().checks.find(x=>x.key==="measurements").ok,true);
  c.renderVals().onCategory({target:{value:"Bottoms"}});
  assert.equal(c._completeness().checks.find(x=>x.key==="measurements").ok,false);
  c._setMeasure("waist","80"); c._setMeasure("inseam","75");
  assert.equal(c._completeness().checks.find(x=>x.key==="measurements").ok,true);
  c.renderVals().onCategory({target:{value:"Outerwear"}});
  assert.equal(Number(c.state.form.measurements.chest),52);
  assert.equal(Number(c.state.form.measurements.waist),80);
});

test("new drafts and duplicates receive unique automatic SKUs; edits keep the same SKU",async()=>{
  const {S,c,I,source}=await fixture();
  const skus=Array.from({length:1000},()=>S.blankProduct().sku);
  assert.equal(new Set(skus).size,1000);
  assert.ok(skus.every(s=>/^TSU-[A-F0-9]{32}$/.test(s)));
  const original=c.state.form.sku;
  c._set("name","QA garment"); c._set("brand","QA"); c._set("price",1000);
  const id=await c._save("draft"); assert.ok(id);
  assert.equal(S.getProduct(id).sku,original);
  c.props={view:"detail",entityId:id}; c._syncForm();
  c._set("name","QA renamed"); await c._save("draft");
  assert.equal(S.getProduct(id).sku,original);
  const copyId=S.duplicateProduct(id);
  assert.notEqual(S.getProduct(copyId).sku,original);
  assert.match(source,/<input id="f-sku"[^>]*readOnly="\{\{ true \}\}"/);
  assert.equal(I.t("ja").kProductIdSku,"商品管理番号（自動生成）");
  assert.equal(I.t("ja").secCondition,"状態");
});

test("public product details use the same measurements and hide unfilled or wrong-category values",async()=>{
  const {S,context}=await fixture();
  const p={...S.blankProduct(),id:123,name:"QA pants",status:"published",category:"Bottoms",measurements:{waist:80,inseam:75,chest:50,hip:0,hem:-1}};
  S.all().products=[p];
  const logic=(await read("TSUMUGI.dc.html")).match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  const C=vm.runInNewContext("(()=>{"+logic+";return Component;})()",context);
  const c=new C({}); c.store=S;
  const result=JSON.parse(JSON.stringify(c.products()[0].measurements));
  assert.deepEqual(result,[{k:"ウエスト",v:"80 cm"},{k:"股下",v:"75 cm"}]);
});

test("legacy letter grades and editor condition names render identically",async()=>{
  const {S,context}=await fixture();
  const base={...S.blankProduct(),status:"published",stock:1};
  S.all().products=[{...base,id:1,condition:"B"},{...base,id:2,condition:"Very Good"}];
  const logic=(await read("TSUMUGI.dc.html")).match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  const C=vm.runInNewContext("(()=>{"+logic+";return Component;})()",context);
  const c=new C({}); c.store=S;
  const products=c.products();
  assert.deepEqual([products[0].condition,products[0].conditionName],["B","Very Good"]);
  assert.deepEqual([products[1].condition,products[1].conditionName],["B","Very Good"]);
});

test("public product pages omit the former fabric and detail gallery",async()=>{
  const page=await read("PublicProduct.dc.html");
  const shell=await read("TSUMUGI.dc.html");
  for(const token of ["fabricDetail","detailImage1","detailImage2","detailImage3","detailCap1","detailCap2","detailCap3"]){
    assert.doesNotMatch(page,new RegExp(token));
    assert.doesNotMatch(shell,new RegExp(token));
  }
});

test("product image registration is visually first in both new and edit forms",async()=>{
  const source=await read("AdminProducts.dc.html");
  assert.ok(source.indexOf('<section id="sec-images"') < source.indexOf('<section id="sec-basic"'));
  assert.match(source,/const SECTIONS = \[\s*\["sec-images", T3\.kImages\], \["sec-basic", T3\.kBasicInformation\]/);
  assert.doesNotMatch(source,/activeSection: "sec-basic"/);
});

test("a newly registered product keeps every field and exposes customer-facing values without substitutions",async()=>{
  const {S,context}=await fixture();
  const p={
    ...S.blankProduct(), id:321, sku:"TSU-QA-321", slug:"qa-field-jacket",
    name:"QA Field Jacket", brand:"QA Atelier", year:1987, price:24680,
    taxStatus:"Tax included", category:"Outerwear", subcategory:"Field jacket",
    size:"L", sizeNotation:"42 REG", colour:"Olive", material:"Cotton twill",
    country:"Japan", era:"1980s", condition:"Good",
    conditionNote:"登録した状態説明", stains:"右袖に薄い汚れ", damage:"裾に小傷",
    repairs:"背面を補修", fading:"肩に退色", missingParts:"欠品なし",
    curatorNote:"登録したキュレーターコメント", story:"登録した商品の背景",
    styling:"登録した着こなしの提案", collection:"QA Collection",
    measurements:{shoulder:47,chest:58,length:72,sleeve:61},
    images:[{url:"https://example.invalid/front.jpg",thumb:"https://example.invalid/front-thumb.jpg",alt:"前面",role:"front"}],
    stock:1,status:"published",featured:true,metaTitle:"QA SEO title",
    metaDescription:"QA SEO description",publishDate:"2026-09-06"
  };
  S.all().products=[p];
  const logic=(await read("TSUMUGI.dc.html")).match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  const C=vm.runInNewContext("(()=>{"+logic+";return Component;})()",context);
  const c=new C({}); c.store=S;
  const mapped=JSON.parse(JSON.stringify(c.products()[0]));
  for(const key of ["sku","slug","taxStatus","subcategory","sizeNotation","conditionNote","stains","damage","repairs","fading","missingParts","short","story","styling","collection","status","featured","metaTitle","metaDescription","publishDate"]){
    const expected=key==="short" ? p.curatorNote : p[key];
    assert.deepEqual(mapped[key],expected,key);
  }
  c.state.page="product"; c.state.productId=321;
  const rendered=c.renderVals();
  assert.equal(rendered.prodNote,p.curatorNote);
  assert.equal(rendered.prodSizeMeta,"サイズ " + p.size);
  assert.ok(!rendered.prodFacts.some(x=>x.v===p.sizeNotation));
  assert.ok(!rendered.prodFacts.some(x=>x.v===p.sku));
  assert.ok(!rendered.prodFacts.some(x=>x.k==="税区分"));
  const accordion=Object.fromEntries(rendered.accordion.map(x=>[x.title,x.body]));
  assert.equal(accordion["商品の背景"],undefined);
  assert.equal(accordion["着こなしについて"],undefined);
  assert.equal(accordion["お手入れ"],undefined);
  for(const value of [p.conditionNote,p.stains,p.damage,p.repairs,p.fading,p.missingParts]){
    assert.match(accordion["状態"],new RegExp(value));
  }
});

test("removed editorial controls stay out of admin and public pages while their database fields remain compatible",async()=>{
  const {I}=await fixture();
  const admin=await read("AdminProducts.dc.html");
  const page=await read("PublicProduct.dc.html");
  const shell=await read("TSUMUGI.dc.html");
  for(const token of ['id="f-story"','id="f-styling"','id="f-sizenote"','fSizeNotation','onSizeNotation','addPlaceholder','kAddArchivePlaceholder','previewStory']){
    assert.doesNotMatch(admin,new RegExp(token));
  }
  assert.doesNotMatch(page,/kenjiKirigaya/);
  assert.doesNotMatch(page,/vm\.t\.(?:curatorNote|productInformation)/);
  assert.doesNotMatch(shell,/\{ key: "Product story"|\{ key: "Styling suggestions"|\{ key: "Care"/);
  assert.doesNotMatch(shell,/\[T\.productCode, cur\.sku\]|\[T\.productTax, displayValue\(cur\.taxStatus\)\]/);
  assert.equal(I.t("ja").kCuratorSNote,"商品詳細");
  assert.equal(I.t("ja").kCuratorSNote2,"商品詳細");
  assert.equal(I.t("ja").kNoCuratorSNoteYet,"商品詳細はまだありません。");
  const repository=await read("tsumugi-repository.js");
  assert.match(repository,/story: p\.story \|\| null, styling: p\.styling \|\| null/);
  assert.match(repository,/sku: String\(p\.sku \|\| ""\)/);
  assert.match(repository,/tax_status: p\.taxStatus \|\| null/);
});

test("admin header subtitles and seeded publication-setting markers are removed",async()=>{
  assert.doesNotMatch(await read("TSUMUGI Admin.dc.html"),/\{\{ pageSubtitle \}\}/);
  assert.doesNotMatch(await read("supabase/seed/production-content.json"),/（掲載用設定）/);
});
