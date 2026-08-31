/* Extract the non-personal demo catalogue from the legacy local Store.
   Customers, orders, auth users and audit logs are intentionally excluded. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import vm from "node:vm";

const values = new Map();
const storage = {
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
const document = { documentElement: { setAttribute() {} } };
const window = {
  addEventListener() {}, document, localStorage: storage, sessionStorage: storage,
  TSUMUGI_SAN: { html: (value) => String(value ?? "") },
};
window.window = window;

const context = vm.createContext({
  window, document, localStorage: storage, sessionStorage: storage,
  console, Date, Math, JSON, Array, Object, String, Number, Boolean, RegExp,
  Set, Map, Intl, setTimeout, clearTimeout, crypto: globalThis.crypto,
});
vm.runInContext(await readFile("tsumugi-data.js", "utf8"), context, {
  filename: "tsumugi-data.js",
});

const source = context.window.TSUMUGI_STORE.all();
const output = {
  generatedAt: new Date().toISOString(),
  note: "Non-personal demo CMS data. Import defaults every record to draft/disabled.",
  products: source.products,
  news: source.news,
  heroFeatures: source.heroFeatures,
  specialFeatures: source.specialFeatures,
};

await mkdir("supabase/seed", { recursive: true });
await writeFile("supabase/seed/demo-content.json", JSON.stringify(output, null, 2) + "\n");
console.log(`demo export: ${output.products.length} products, ${output.news.length} articles, `
  + `${output.heroFeatures.length} hero features, ${output.specialFeatures.length} special features`);

