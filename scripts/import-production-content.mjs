/* Reproducible portfolio-content import. Run only from a trusted local terminal.

   This updates the seventeen product slots and six article slots listed in
   supabase/seed/production-content.json, then refreshes the existing hero and
   special-feature rows. It never deletes customer, order or authentication
   data. The service-role key stays in the Git-ignored .env.local file and is
   never copied into dist/ or printed.

   The supplied product records and photographs are explicitly disclosed as
   fictional portfolio samples. Replace their copy and images with inspected,
   real inventory before enabling commerce. */
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const url = String(process.env.SUPABASE_URL || "").trim();
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !serviceKey) {
  console.error("接続設定がありません。service_role key を含む .env.local が必要です。");
  process.exit(1);
}

const input = JSON.parse(await readFile(
  process.env.PRODUCTION_CONTENT_FILE || "supabase/seed/production-content.json",
  "utf8",
));
if (!input.meta?.disclosure || input.products?.length !== 17 || input.news?.length !== 6) {
  throw new Error("production-content.json の件数または開示情報が不正です。取込を中止しました。");
}

const client = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const checked = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data || [];
};

const productColumns = [
  "sku", "slug", "name", "brand", "year", "year_label", "price", "tax_status",
  "category", "subcategory", "size", "size_notation", "colour", "material", "country",
  "era", "condition", "condition_note", "stains", "damage", "repairs", "fading",
  "missing_parts", "curator_note", "story", "styling", "collection", "measurements",
  "images", "stock", "status", "featured", "meta_title", "meta_description", "publish_date",
];
const productRows = input.products.map((product) => Object.fromEntries(
  productColumns.map((column) => [column, product[column] ?? null]),
));
const products = checked(await client.from("products")
  .upsert(productRows, { onConflict: "sku" }).select("id,sku"), "products");
const productId = new Map(input.products.map((entry) => {
  const row = products.find((candidate) => candidate.sku === entry.sku);
  if (!row) throw new Error(`products: imported row missing for ${entry.sku}`);
  return [String(entry.id), row.id];
}));

const newsColumns = [
  "type", "title", "slug", "category", "summary", "body", "image", "thumb", "alt",
  "tags", "status", "publish_date", "seo_title", "seo_description", "author", "featured",
];
const newsRows = input.news.map((entry) => ({
  ...Object.fromEntries(newsColumns.map((column) => [column, entry[column] ?? null])),
  related_product_ids: (entry.related_product_ids || [])
    .map((id) => productId.get(String(id))).filter(Boolean),
}));
const news = checked(await client.from("news")
  .upsert(newsRows, { onConflict: "slug" }).select("id,slug"), "news");
const newsId = new Map(input.news.map((entry) => {
  const row = news.find((candidate) => candidate.slug === entry.slug);
  if (!row) throw new Error(`news: imported row missing for ${entry.slug}`);
  return [String(entry.id), row.id];
}));

const heroRows = input.hero_features.map((entry) => ({
  ...entry,
  source_id: entry.source_type === "page" ? null : newsId.get(String(entry.source_id)),
}));
const heroes = checked(await client.from("hero_features")
  .upsert(heroRows, { onConflict: "id" }).select("id"), "hero features");

const specialRows = input.special_features.map((entry) => ({
  ...entry,
  candidate_product_ids: (entry.candidate_product_ids || [])
    .map((id) => productId.get(String(id))).filter(Boolean),
  media: (entry.media || []).map((item) => item.sourceType === "product"
    ? { ...item, productId: productId.get(String(item.productId)) || null }
    : item),
}));
const specials = checked(await client.from("special_features")
  .upsert(specialRows, { onConflict: "id" }).select("id"), "special features");

console.log(`production content imported: ${products.length} products, ${news.length} articles, `
  + `${heroes.length} hero features, ${specials.length} special features`);
