/* One-time hosted import. Run only from a trusted local terminal.

   Required environment variables:
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY

   .env.local is Git-ignored and mode 0600; the key is never printed or copied
   into the website build. */
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { loadLocalEnv } from "./load-local-env.mjs";

loadLocalEnv();

const url = String(process.env.SUPABASE_URL || "").trim();
const serviceKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || !serviceKey) {
  console.error("接続設定がありません。先に npm run setup:local を実行してください。");
  process.exit(1);
}

const input = JSON.parse(await readFile(
  process.env.DEMO_CONTENT_FILE || "supabase/seed/demo-content.json", "utf8"
));
const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const requireData = (result, label) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data || [];
};

const productRows = input.products.map((p) => ({
  sku: p.sku || `DEMO-${p.id}`,
  slug: p.slug || `demo-product-${p.id}`,
  name: p.name, brand: p.brand || null,
  year: Number(p.year) || null, year_label: p.year ? String(p.year) : null,
  price: Math.max(0, Number(p.price) || 0), tax_status: p.taxStatus || null,
  category: p.category || null, subcategory: p.subcategory || null,
  size: p.size || null, size_notation: p.sizeNotation || null,
  colour: p.colour || null, material: p.material || null, country: p.country || null,
  era: p.era || null, condition: p.condition || null,
  condition_note: p.conditionNote || null, stains: p.stains || null,
  damage: p.damage || null, repairs: p.repairs || null, fading: p.fading || null,
  missing_parts: p.missingParts || null, curator_note: p.curatorNote || null,
  story: p.story || null, styling: p.styling || null, collection: p.collection || null,
  measurements: p.measurements || {}, images: p.images || [],
  stock: Math.max(0, Number(p.stock) || 0), status: "draft", featured: false,
  meta_title: p.metaTitle || null, meta_description: p.metaDescription || null,
  publish_date: p.publishDate || null,
}));
const importedProducts = requireData(await supabase.from("products")
  .upsert(productRows, { onConflict: "sku" }).select("id,sku"), "products");
const productId = new Map();
for (const p of input.products) {
  const row = importedProducts.find((r) => r.sku === (p.sku || `DEMO-${p.id}`));
  if (row) productId.set(String(p.id), row.id);
}

const newsRows = input.news.map((n) => ({
  type: n.type === "news" ? "news" : "journal",
  title: n.title, slug: n.slug || `demo-article-${n.id}`,
  category: n.category || null, summary: n.summary || null, body: n.body || null,
  image: n.image || null, thumb: n.thumb || n.image || null, alt: n.alt || null,
  author: n.author || null, tags: n.tags || [], status: "draft",
  publish_date: n.publishDate || null, seo_title: n.seoTitle || null,
  seo_description: n.seoDescription || null, featured: false,
  related_product_ids: (n.relatedProducts || []).map((id) => productId.get(String(id))).filter(Boolean),
}));
const importedNews = requireData(await supabase.from("news")
  .upsert(newsRows, { onConflict: "slug" }).select("id,slug"), "news");
const newsId = new Map();
for (const n of input.news) {
  const slug = n.slug || `demo-article-${n.id}`;
  const row = importedNews.find((r) => r.slug === slug);
  if (row) newsId.set(String(n.id), row.id);
}

const heroRows = input.heroFeatures.map((f, index) => ({
  id: String(f.id), source_type: f.sourceType || "page",
  source_id: f.sourceType === "page" ? null : (newsId.get(String(f.sourceId)) || null),
  route: f.sourceType === "page" ? (f.route || "shop") : null,
  enabled: false, sort_order: index + 1,
}));
if (heroRows.length) requireData(await supabase.from("hero_features")
  .upsert(heroRows, { onConflict: "id" }).select("id"), "hero features");

const specialRows = input.specialFeatures.map((f) => ({
  id: String(f.id), slug: f.slug || String(f.id),
  title_en: f.titleEn || "", title_ja: f.titleJa || "",
  description_en: f.descriptionEn || "", description_ja: f.descriptionJa || "",
  category: f.category || null, era_label: f.eraLabel || null,
  enabled: false, publish_at: null, unpublish_at: null,
  candidate_product_ids: (f.candidateProductIds || [])
    .map((id) => productId.get(String(id))).filter(Boolean).slice(0, 8),
  media: (f.media || []).map((m) => ({
    ...m,
    productId: m.productId == null ? null : (productId.get(String(m.productId)) || null),
  })).filter((m) => m.sourceType !== "product" || m.productId).slice(0, 6),
}));
if (specialRows.length) requireData(await supabase.from("special_features")
  .upsert(specialRows, { onConflict: "id" }).select("id"), "special features");

console.log(`import complete: ${importedProducts.length} products, ${importedNews.length} articles, `
  + `${heroRows.length} hero features, ${specialRows.length} special features — all draft/disabled`);
