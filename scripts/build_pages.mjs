// Publish only runtime files; never recursively copy the repository.
import {copyFile, mkdir, lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const files = [
  'site/index.html', 'site/favicon.svg', 'site/site.webmanifest',
  'site/icons/apple-touch-icon.svg', 'site/icons/favicon-16.svg',
  'site/icons/favicon-32.svg', 'site/icons/icon-192.svg',
  'site/icons/icon-512.svg', 'site/icons/mwh-temple.svg',
  'site-supabase/index.html',
  'data/current/unesco_official_sites.json',
  'data/current/unesco_official_sites.geojson'
];
export async function buildPages(destination) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  // Refuse an existing output directory so stale files cannot survive a build.
  await mkdir(destination);
  for (const file of files) {
    const source = path.join(root, file), target = path.join(destination, file);
    if (!(await lstat(source)).isFile()) throw new Error(`Not a regular file: ${file}`);
    await mkdir(path.dirname(target), {recursive:true});
    await copyFile(source, target);
  }
  console.log(`Published allowlist: ${files.length} files`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await buildPages(path.resolve(process.argv[2] || '.local/pages-dist'));
}
