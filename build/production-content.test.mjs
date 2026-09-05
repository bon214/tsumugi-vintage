import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const data = JSON.parse(await readFile(
  path.join(ROOT, "supabase/seed/production-content.json"), "utf8",
));
const base = `${data.meta.siteUrl}/uploads/production/`;
const localImage = (url) => path.join(ROOT, "uploads/production", url.slice(base.length));
const unique = (values) => new Set(values).size === values.length;

test("portfolio disclosure and release-sized content set are present", () => {
  assert.match(data.meta.disclosure, /fictional portfolio samples/i);
  assert.equal(data.products.length, 12);
  assert.equal(data.news.length, 6);
  assert.equal(data.hero_features.length, 4);
  assert.equal(data.special_features.length, 3);
});

test("every product is complete, unique and points at a local production image", () => {
  assert.ok(unique(data.products.map((p) => p.id)));
  assert.ok(unique(data.products.map((p) => p.sku)));
  assert.ok(unique(data.products.map((p) => p.slug)));
  for (const product of data.products) {
    assert.equal(product.status, "published", `product ${product.id} status`);
    assert.ok(product.name && product.sku && product.slug && product.price > 0);
    assert.ok(product.condition_note && product.curator_note && product.story && product.styling);
    assert.match(product.curator_note, /ポートフォリオ公開用の架空商品/);
    assert.ok(Object.keys(product.measurements || {}).length >= 2);
    assert.equal(product.images.filter((image) => image.primary).length, 1);
    for (const image of product.images) {
      assert.ok(image.url.startsWith(base), image.url);
      assert.ok(image.alt.length >= 12, `product ${product.id} alt`);
      assert.ok(existsSync(localImage(image.url)), image.url);
    }
    assert.ok(product.meta_title.length >= 20);
    assert.ok(product.meta_description.length >= 40);
  }
});

test("every article is substantive, safe to sanitize and fully described", () => {
  assert.ok(unique(data.news.map((article) => article.id)));
  assert.ok(unique(data.news.map((article) => article.slug)));
  for (const article of data.news) {
    assert.equal(article.status, "published", `article ${article.id} status`);
    assert.ok(article.body.length >= 500, `article ${article.id} body length`);
    assert.doesNotMatch(article.body, /<(?:script|style|iframe|form|input|button)\b/i);
    assert.doesNotMatch(article.body, /\son[a-z]+\s*=/i);
    assert.ok(article.image.startsWith(base), article.image);
    assert.ok(existsSync(localImage(article.image)), article.image);
    assert.ok(article.alt.length >= 12, `article ${article.id} alt`);
    assert.ok(article.seo_title.length >= 20);
    assert.ok(article.seo_description.length >= 45);
  }
});

test("hero and special features only reference this release set", () => {
  const productIds = new Set(data.products.map((p) => p.id));
  const articleIds = new Set(data.news.map((n) => n.id));
  assert.deepEqual(data.hero_features.map((hero) => hero.sort_order), [1, 2, 3, 4]);
  for (const hero of data.hero_features) {
    assert.equal(hero.source_type, "journal");
    assert.ok(articleIds.has(hero.source_id));
    assert.equal(hero.enabled, true);
  }
  for (const feature of data.special_features) {
    assert.ok(feature.candidate_product_ids.every((id) => productIds.has(id)));
    for (const media of feature.media) {
      assert.ok(media.src.startsWith(base), media.src);
      assert.ok(existsSync(localImage(media.src)), media.src);
    }
  }
});

