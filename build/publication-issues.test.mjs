import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

async function fixture() {
  const storage = () => { const data = new Map(); return { getItem:k => data.get(k) || null, setItem:(k,v) => data.set(k,String(v)), removeItem:k => data.delete(k) }; };
  const context = { window:{ addEventListener() {}, dispatchEvent() {} }, document:{ documentElement:{ setAttribute() {} } },
    localStorage:storage(), sessionStorage:storage(), location:{ href:"https://example.invalid/" }, URL, console,
    setTimeout:() => 0, clearTimeout() {}, setInterval:() => 0, clearInterval() {} };
  vm.runInNewContext(await readFile(new URL("../tsumugi-data.js", import.meta.url), "utf8"), context);
  const S = context.window.TSUMUGI_STORE;
  S.all().products = []; S.all().heroFeatures = []; S.all().news = [];
  return S;
}
function product(patch = {}) {
  return { id:1, name:"Vintage shirt", sku:"QA-1", slug:"qa-1", category:"Shirting", size:"M",
    condition:"B", conditionNote:"Minor wear", price:1000, measurements:{ chest:50,length:70 },
    images:[{ primary:true,url:"./shirt.jpg",alt:"Shirt" }], stock:1,status:"published", ...patch };
}
test("one available piece and an ordinary sold-out archive do not raise alerts", async () => {
  const S=await fixture();
  S.all().products=[product(),product({id:2,stock:0,status:"soldout"})];
  assert.equal(S.publicationIssues().length,0);
});
test("zero-stock published products are actionable, without changing data", async () => {
  const S=await fixture(), p=product({ stock:0 }); S.all().products=[p];
  const issue=S.publicationIssues()[0];
  assert.equal(issue.reasons[0],"issueStock");
  assert.equal(issue.path,"/admin/products/1");
  assert.equal(p.status,"published");
});
test("missing public product information is grouped once per record, without a six-row cap", async () => {
  const S=await fixture();
  S.all().products=Array.from({length:8},(_,i)=>product({ id:i+1,images:[],price:0 }));
  const issues=S.publicationIssues();
  assert.equal(issues.length,8);
  assert.equal(issues[0].reasons.length,2);
  assert.equal(issues[0].reasons[0],"issueImage");
  assert.equal(issues[0].reasons[1],"issueRequired");
});
test("drafts and archives do not generate public-readiness alerts", async () => {
  const S=await fixture(); S.all().products=[product({status:"draft",images:[],stock:0}),product({status:"archived",price:0})];
  assert.equal(S.publicationIssues().length,0);
});
test("only enabled broken hero references raise alerts, not scheduled content", async () => {
  const S=await fixture();
  S.all().news=[{id:5,status:"scheduled",publishDate:"2099-01-01"}];
  S.all().heroFeatures=[
    {id:"broken",enabled:true,sourceType:"journal",sourceId:999,order:1},
    {id:"disabled",enabled:false,sourceType:"journal",sourceId:null,order:2},
    {id:"scheduled",enabled:true,sourceType:"journal",sourceId:5,order:3},
    {id:"page",enabled:true,sourceType:"page",route:"shop",order:4}
  ];
  assert.equal(S.publicationIssues().length,1);
  assert.equal(S.publicationIssues()[0].id,"hero-broken");
});
test("legacy notification opt-out is preserved while the new switch takes precedence", async () => {
  const S=await fixture();
  S.all().settings={notifyLowStock:false,lowStockThreshold:1};
  assert.equal(S.settings().notifyPublicationIssues,false);
  S.all().settings.notifyPublicationIssues=true;
  assert.equal(S.settings().notifyPublicationIssues,true);
});
test("hosted checkout remains disabled; order RPC decrements stock atomically", async () => {
  const repo=await readFile(new URL("../tsumugi-repository.js",import.meta.url),"utf8");
  assert.match(repo,/s\.placeOrder = function \(\) \{ return \{ ok: false, code: "portfolio_only" \}/);
  const sql=await readFile(new URL("../supabase/migrations/0008_create_order_rpc.sql",import.meta.url),"utf8");
  assert.match(sql,/set stock = stock - v_qty/);
  assert.match(sql,/stock - v_qty = 0 then 'soldout'/);
  assert.match(sql,/and stock >= v_qty/);
  assert.match(sql,/'pending', 'unfulfilled'/);
});
test("order endpoint defaults off before any database client is constructed", async () => {
  const source=await readFile(new URL("../supabase/functions/create-order/index.ts",import.meta.url),"utf8");
  const {code}=await transform(source.replace(/^import .*;$/m,""),{loader:"ts"});
  for (const enabled of [undefined,"false","TRUE",""]) {
    let handler, calls=0;
    vm.runInNewContext(code,{ Deno:{env:{get:()=>enabled},serve:fn=>{handler=fn;}},
      createClient:()=>{calls++;throw new Error("database must not be called");},Response,console });
    const res=await handler(new Request("https://example.invalid",{method:"POST",body:"{}"}));
    assert.equal(res.status,403);
    assert.equal((await res.json()).code,"commerce_disabled");
    assert.equal(calls,0);
  }
});
