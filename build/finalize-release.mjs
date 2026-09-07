/* Hash the complete deployable artifact, including HTML, CSS and catalogue images.
   Every normal build (including cms-publish) generates its own release manifest. */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export async function finalizeRelease(dist) {
  const files = [];
  async function walk(dir, prefix = '') {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const name = prefix + entry.name;
      if (entry.isDirectory()) await walk(path.join(dir, entry.name), name + '/');
      else if (name !== 'version.json') files.push(name);
    }
  }
  await walk(dist);
  files.sort();
  const hash = createHash('sha256');
  for (const file of files) hash.update(file).update('\0').update(await readFile(path.join(dist, file))).update('\0');
  const version = hash.digest('hex');
  for (const file of files.filter(f => f.endsWith('.html'))) {
    const filename = path.join(dist, file);
    const html = await readFile(filename, 'utf8');
    if (!html.includes('__TSUMUGI_RELEASE__')) throw new Error('Missing release marker: ' + file);
    await writeFile(filename, html.replaceAll('__TSUMUGI_RELEASE__', version)
      .replace(/\?v=[a-f0-9]+(?=")/g, '?v=' + version));
  }
  await writeFile(path.join(dist, 'version.json'), JSON.stringify({ version }) + '\n');
  return version;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('release:', await finalizeRelease(path.resolve('dist')));
}
