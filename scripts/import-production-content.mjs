/* Reproducible portfolio-content import. Run only from a trusted local terminal.

   This updates the twelve product slots and six article slots listed in
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
if (!input.meta?.disclosure || input.products?.length !== 12 || input.news?.length !== 6) {
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
  "id", "sku", "slug", "name", "brand", "year", "year_label", "price", "tax_status",
  "category", "subcategory", "size", "size_notation", "colour", "material", "country",
  "era", "condition", "condition_note", "stains", "damage", "repairs", "fading",
  "missing_parts", "curator_note", "story", "styling", "collection", "measurements",
  "images", "stock", "status", "featured", "meta_title", "meta_description", "publish_date",
];
const productRows = input.products.map((product) => Object.fromEntries(
  productColumns.map((column) => [column, product[column] ?? null]),
));
const newsColumns = [
  "id", "type", "title", "slug", "category", "summary", "body", "image", "thumb", "alt",
  "tags", "status", "publish_date", "seo_title", "seo_description", "author", "featured",
  "related_product_ids",
];
const newsRows = input.news.map((entry) => Object.fromEntries(
  newsColumns.map((column) => [column, entry[column] ?? null]),
));

const products = checked(await client.from("products")
  .upsert(productRows, { onConflict: "id" }).select("id"), "products");
const news = checked(await client.from("news")
  .upsert(newsRows, { onConflict: "id" }).select("id"), "news");
const heroes = checked(await client.from("hero_features")
  .upsert(input.hero_features, { onConflict: "id" }).select("id"), "hero features");
const specials = checked(await client.from("special_features")
  .upsert(input.special_features, { onConflict: "id" }).select("id"), "special features");

console.log(`production content imported: ${products.length} products, ${news.length} articles, `
  + `${heroes.length} hero features, ${specials.length} special features`);

