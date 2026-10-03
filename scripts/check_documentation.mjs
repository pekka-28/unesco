// Validate active product documentation, HTML assets and local heading links.
import {readFileSync, existsSync} from 'node:fs';
import path from 'node:path';
const docs = ['README.md','Requirements.md','ARCHITECTURE.md','SYSTEM_BEHAVIOUR.md','TRACEABILITY.md',
  'SECURITY.md','ADMINISTRATION.md','TEST_PLAN.md','RETIRED_CODE.md','My World Heritage.md',
  'supabase/SCHEMA.md','supabase/GITHUB_DEPLOYMENT.md','supabase/EXCHANGE_SETUP.md','site/user-guide.html'];
const errors = [];
let links = 0;
const slug = text => text.toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu,'').replace(/\s/g,'-');
for (const file of docs) {
  const source = readFileSync(file,'utf8');
  const targets = file.endsWith('.html')
    ? [...source.matchAll(/(?:href|src)="([^"]+)"/g)].map(match=>match[1])
    : [...source.matchAll(/\]\(([^)]+)\)/g)].map(match=>match[1]);
  for (let target of targets) {
    if (/^(?:https?:|mailto:|data:)/.test(target)) continue;
    links++;
    target = decodeURIComponent(target).replaceAll('&amp;','&');
    const [relative,fragment] = target.split('#');
    let destination = path.resolve(path.dirname(file),relative||path.basename(file));
    if (relative?.endsWith('/')) destination = path.join(destination,'index.html');
    if (!existsSync(destination)) { errors.push(`${file}: missing ${target}`); continue; }
    if (fragment && /\.(?:html|md)$/.test(destination)) {
      const text = readFileSync(destination,'utf8');
      const found = destination.endsWith('.html') ? text.includes(`id="${fragment}"`)
        : [...text.matchAll(/^#+ (.+)$/gm)].some(match=>slug(match[1])===fragment);
      if (!found) errors.push(`${file}: missing fragment ${target}`);
    }
  }
}
if (errors.length) throw Error(errors.join('\n'));
console.log(`${docs.length} active documents and ${links} local links checked`);
