import ts from 'typescript';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
const root = new URL('../', import.meta.url);
// Test helpers use the same compiler output as the published inline script.
export function siteCode(name = 'app') {
  const source = readFileSync(new URL(`site/src/${name}.ts`, root), 'utf8');
  return ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}})
    .outputText.replace(/^export \{\};?\s*$/m, '').split('\n').map(line => '    '+line).join('\n');
}
export function siteHtml(name = 'app') {
  const file = name === 'app' ? 'site/index.html' : name === 'admin' ? 'admin/index.html' : 'site-supabase/index.html';
  const code = `\n${siteCode(name)}\n`;
  let html=readFileSync(new URL(file, root),'utf8').replace(`<!-- compiled:${name} -->`, `<script>${code}</script>`);
  if(name==='admin') {
    const hash=createHash('sha256').update(code).digest('base64');
    html=html.replace('<head>',`<head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src 'self'; connect-src https://fjqhgcegnphavatrchjb.supabase.co; base-uri 'none'; form-action 'none'">`);
  }
  return html;
}
export function siteFunction(name) {
  const source = siteCode();
  const ast = ts.createSourceFile('app.js',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
  const node = ast.statements.find(n=>ts.isFunctionDeclaration(n) && n.name?.text===name);
  if (!node) throw new Error(`Function not found: ${name}`);
  return node.getText(ast);
}
