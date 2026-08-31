/* Generate the crawler catalogue from public Supabase rows.
   This runs in GitHub Actions before prerender; no privileged key is needed. */
import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const url = String(process.env.SUPABASE_URL || "").trim();
const key = String(process.env.SUPABASE_PUBLISHABLE_KEY || "").trim();
if (!url || !key) {
  console.log("live catalogue: Supabase is not configured; keeping committed demo snapshot");
  process.exit(0);
}
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const PRODUCT_SELECT = [
  "id", "name", "brand", "price", "category", "size", "material", "condition",
  "year", "year_label", "country", "colour", "condition_note", "curator_note",
  "story", "images", "status", "created_at"
].join(",");
const [productsResult, newsResult] = await Promise.all([
  supabase.from("products").select(PRODUCT_SELECT).order("created_at", { ascending: false }),
  supabase.from("news").select("*").order("publish_date", { ascending: false }),
]);
if (productsResult.error) throw productsResult.error;
if (newsResult.error) throw newsResult.error;

const plain = (html) => String(html || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const firstImage = (images) => Array.isArray(images) && images.length ? images[0] : {};
const catalog = {
  prods: (productsResult.data || []).map((p) => {
    const image = firstImage(p.images);
    return {
      id: p.id, name: p.name, brand: p.brand || "", price: p.price,
      category: p.category || "", size: p.size || "", material: p.material || "",
      condition: p.condition || "", year: p.year || p.year_label || "",
      country: p.country || "", colour: p.colour || "",
      note: p.condition_note || p.curator_note || p.story || "",
      img: image.url || image.src || image.thumb || "", alt: image.alt || p.name,
      status: p.status,
    };
  }),
  news: (newsResult.data || []).map((n) => ({
    slug: n.slug, title: n.title, summary: n.summary || "",
    body: plain(n.body), category: n.category || "",
    date: n.publish_date || String(n.created_at || "").slice(0, 10),
    img: n.image || n.thumb || "", alt: n.alt || n.title,
  })),
};
await writeFile("build/seed-catalog.json", JSON.stringify(catalog, null, 2) + "\n");
console.log(`live catalogue: ${catalog.prods.length} products, ${catalog.news.length} articles`);
