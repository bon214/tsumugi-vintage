export function slugifyPublic(value) {
  let slug = String(value || "");
  if (!slug.trim()) return "";
  if (slug.normalize) slug = slug.normalize("NFKC");
  slug = slug.toLowerCase().trim()
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "item";
}

export function normaliseArticleSlugs(rows) {
  const used = new Set();
  return (rows || []).map((row, index) => {
    const copy = { ...row };
    const base = slugifyPublic(copy.slug)
      || slugifyPublic(copy.title)
      || `article-${copy.id || index + 1}`;
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) slug = `${base}-${suffix++}`;
    used.add(slug);
    copy.slug = slug;
    return copy;
  });
}
