/* Regenerate build/artifact-manifest.json from the delivered project tree.
 * Dependencies and editor/session artefacts are intentionally excluded; source,
 * generated modules, local vendor files and the final dist are all covered. */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "build", "artifact-manifest.json");
const EXCLUDED_DIRS = new Set([".git", "node_modules", "outputs", "work"]);
const EXCLUDED_FILES = new Set([".thumbnail", "build/artifact-manifest.json"]);

const paths = [];
async function walk(dir, relative = "") {
  for (const name of (await readdir(dir)).sort()) {
    const rel = relative ? `${relative}/${name}` : name;
    if (EXCLUDED_DIRS.has(rel) || EXCLUDED_DIRS.has(name) && !relative) continue;
    if (EXCLUDED_FILES.has(rel)) continue;
    const absolute = path.join(dir, name);
    const info = await stat(absolute);
    if (info.isDirectory()) await walk(absolute, rel);
    else if (info.isFile()) paths.push(rel);
  }
}

await walk(ROOT);

const files = [];
const groups = { source: 0, generated: 0, vendor: 0, dist: 0 };
const emptyFiles = [];
let bytes = 0;

for (const file of paths.sort()) {
  const body = await readFile(path.join(ROOT, file));
  const group = file.startsWith("dist/") ? "dist"
    : file.startsWith("vendor/") ? "vendor"
      : file.startsWith("generated/") ? "generated" : "source";
  groups[group]++;
  bytes += body.length;
  if (body.length === 0) emptyFiles.push(file);
  files.push({
    file,
    group,
    bytes: body.length,
    sha256: createHash("sha256").update(body).digest("hex"),
  });
}

const manifest = {
  manifestVersion: 2,
  projectRoot: "project-relative",
  excludes: [...EXCLUDED_DIRS, ...EXCLUDED_FILES].sort(),
  totals: { files: files.length, bytes, groups },
  emptyFiles,
  files,
};

await writeFile(OUT, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`artifact-manifest: ${files.length} files, ${bytes} bytes, ${emptyFiles.length} empty`);
