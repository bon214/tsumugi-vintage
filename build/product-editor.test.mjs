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

test("public product pages omit the former fabric and detail gallery",async()=>{
  const page=await read("PublicProduct.dc.html");
  const shell=await read("TSUMUGI.dc.html");
  for(const token of ["fabricDetail","detailImage1","detailImage2","detailImage3","detailCap1","detailCap2","detailCap3"]){
    assert.doesNotMatch(page,new RegExp(token));
    assert.doesNotMatch(shell,new RegExp(token));
  }
});

test("admin header subtitles and seeded publication-setting markers are removed",async()=>{
  assert.doesNotMatch(await read("TSUMUGI Admin.dc.html"),/\{\{ pageSubtitle \}\}/);
  assert.doesNotMatch(await read("supabase/seed/production-content.json"),/（掲載用設定）/);
});
