import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

async function featured() {
  const source = await readFile(new URL("../AdminFeatured.dc.html", import.meta.url), "utf8");
  const logic = source.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
  const records = [{ id:"existing", sourceType:"page", sourceId:null, route:"shop", order:1, enabled:true }];
  const calls = [], nav = [];
  let editable = true, result = "created", pause = null;
  const S = {
    lang: () => "en", can: () => editable, HERO_MAX:6, HERO_PAGES:["shop","about","journal","contact"],
    heroFeatures: () => records, publicHeroFeatures: () => records,
    news: () => [{ id:10, title:"Article", status:"published", slug:"article" }],
    getNews: id => id === 10 ? S.news()[0] : null,
    heroSourceState: f => f.sourceType === "page" ? (f.route ? "ok":"unset") : (f.sourceId ? "ok":"unset"),
    blankHeroFeature: () => ({ id:"created", order:2, sourceType:"journal", sourceId:null, route:"", enabled:false }),
    saveHeroFeature: async row => { calls.push(row); if (pause) await pause; return result; },
    toast: () => {},
  };
  class DCLogic {
    constructor(props) { this.props = props; }
    setState(value) { Object.assign(this.state, typeof value === "function" ? value(this.state) : value); }
    forceUpdate() {}
  }
  const C = vm.runInNewContext(logic + ";Component", { DCLogic, window:{ TSUMUGI_STORE:S, innerWidth:1440 } });
  const c = new C({ view:"new", nav: p => nav.push(p) });
  return { c, S, calls, nav, records, setEditable:v => editable=v, setResult:v => result=v, setPause:v => pause=v };
}
const event = { preventDefault() {} };

test("hero creation does not persist an empty or cancelled draft", async () => {
  const { c, calls, nav } = await featured();
  await c.renderVals().onCreate(event);
  c.renderVals().onCancelCreate();
  assert.equal(calls.length, 0);
  assert.deepEqual(nav, ["/admin/featured"]);
});
test("hero creation saves a valid article reference, initially disabled", async () => {
  const { c, calls, nav } = await featured();
  c.setState({ draftSource:"10" });
  await c.renderVals().onCreate(event);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sourceId, 10);
  assert.equal(calls[0].route, "");
  assert.equal(calls[0].enabled, false);
  assert.deepEqual(nav, ["/admin/featured"]);
});
test("hero creation saves a valid page reference with null article id", async () => {
  const { c, calls } = await featured();
  c.setState({ draftType:"page", draftSource:"about" });
  await c.renderVals().onCreate(event);
  assert.equal(calls[0].route, "about");
  assert.equal(calls[0].sourceId, null);
  assert.equal(calls[0].sourceType, "page");
});
test("hero creation guards permissions, limit and unknown references", async () => {
  const h = await featured();
  h.c.setState({ draftSource:"10" });
  h.setEditable(false); await h.c._create(event);
  h.setEditable(true); h.c.setState({ draftSource:"999" }); await h.c._create(event);
  h.c.setState({ draftType:"page", draftSource:"invalid" }); await h.c._create(event);
  h.c.setState({ draftSource:"shop" });
  while (h.records.length < 6) h.records.push({ id:String(h.records.length) });
  await h.c._create(event);
  assert.equal(h.calls.length, 0);
});
test("hero save failure preserves the draft, double submit produces one write", async () => {
  const h = await featured();
  let resolve;
  h.setPause(new Promise(r => { resolve = r; }));
  h.setResult(null);
  h.c.setState({ draftSource:"10" });
  const first = h.c._create(event);
  await h.c._create(event);
  assert.equal(h.calls.length, 1);
  resolve(); await first;
  assert.equal(h.c.state.draftSource, "10");
  assert.equal(h.c.state.saving, false);
  assert.equal(h.nav.length, 0);
});
test("changing an existing hero type waits for a valid source before saving", async () => {
  const { c, calls } = await featured();
  c.props.view = "list";
  c.renderVals().rows[0].onType({ target:{ value:"journal" } });
  assert.equal(calls.length, 0);
  assert.equal(c.renderVals().rows[0].toggleLocked, true);
  await c.renderVals().rows[0].onSource({ target:{ value:"" } });
  assert.equal(calls.length, 0);
  await c.renderVals().rows[0].onSource({ target:{ value:"10" } });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sourceType, "journal");
  assert.equal(calls[0].sourceId, 10);
  assert.equal(calls[0].route, "");
});

test("remote hero insertion appends after the highest order, including deletion gaps", async () => {
  const source = await readFile(new URL("../tsumugi-repository.js", import.meta.url), "utf8");
  const rows = [{ id:"first", order:1 }, { id:"last", order:4 }];
  const sent = [];
  const S = {
    isStaffSession: () => true, can: () => true, _applyRemoteCMS() {},
    getHeroFeature: id => rows.find(r => r.id === id), heroFeatures: () => rows,
    HERO_MAX:6, heroSourceState: () => "ok", blankHeroFeature: () => ({ id:"new", order:3 }),
  };
  const client = { from: () => ({
    select: () => ({ order: async () => ({ data:[] }) }),
    upsert: row => { sent.push(row); return { select: () => ({ single: async () => ({ data:{ id:row.id } }) }) }; }
  }) };
  const context = { window:{
    TSUMUGI_AUTH_CONFIG:{ url:"https://example.test", anonKey:"test" },
    TSUMUGI_STORE:S, TSUMUGI_SUPABASE_CLIENT:async () => client,
    TSUMUGI_AUTH:{ boot:async () => {}, subscribe:() => () => {} },
  }, console, setTimeout:() => 1, clearTimeout() {} };
  vm.runInNewContext(source, context);
  await context.window.TSUMUGI_CMS.ready();
  await S.saveHeroFeature({ sourceType:"page", route:"about", enabled:false });
  assert.equal(sent[0].sort_order, 5);
  assert.equal(sent[0].source_id, null);
  await S.saveHeroFeature({ id:"last", sourceType:"page", route:"shop" });
  assert.equal(sent[1].sort_order, 4);
});
