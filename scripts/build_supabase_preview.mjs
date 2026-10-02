// build_supabase_preview.mjs
// Generate a preview sharing the existing profile with a fixed Supabase endpoint.
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.resolve(process.argv[2] || path.join(root, 'site-supabase'));
let html = await readFile(path.join(root, 'site/index.html'), 'utf8');
function replaceOnce(pattern, replacement) {
  if (!pattern.test(html)) throw new Error(`Preview source changed: ${pattern}`);
  html = html.replace(pattern, replacement);
}
replaceOnce(/const DEFAULT_USAGE_SUMMARY_ENDPOINT = "[^"]+";/,
  'const DEFAULT_USAGE_SUMMARY_ENDPOINT = "https://fjqhgcegnphavatrchjb.supabase.co/functions/v1/usage-summary";');
replaceOnce(/<title>My World Heritage<\/title>/, '<title>My World Heritage — Supabase preview</title>');
html = html.replaceAll('https://pekka-28.github.io/unesco/site/', 'https://pekka-28.github.io/unesco/site-supabase/');
replaceOnce(/(<body>)/, '$1\n  <div style="position:fixed;bottom:24px;left:10px;z-index:1300;background:white;padding:5px 9px;border:1px solid #b8c1cc;border-radius:6px;font:12px sans-serif">Supabase preview · Shared local profile</div>');
await mkdir(destination, { recursive: true });
await writeFile(path.join(destination, 'index.html'), html.trimEnd() + '\n');
for (const asset of ['icons', 'favicon.svg', 'site.webmanifest']) {
  await cp(path.join(root, 'site', asset), path.join(destination, asset), { recursive: true });
}
const manifestPath = path.join(destination, 'site.webmanifest');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
manifest.name = 'My World Heritage — Supabase preview';
manifest.short_name = 'MyWH preview';
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Built Supabase preview: ${destination}`);
