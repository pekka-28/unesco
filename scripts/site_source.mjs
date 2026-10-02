import ts from 'typescript';
import {readFileSync} from 'node:fs';
const root = new URL('../', import.meta.url);
// Test helpers use the same compiler output as the published inline script.
export function siteCode(name = 'app') {
  const source = readFileSync(new URL(`site/src/${name}.ts`, root), 'utf8');
  return ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022}})
    .outputText.replace(/^export \{\};?\s*$/m, '').split('\n').map(line => '    '+line).join('\n');
}
export function siteHtml(name = 'app') {
  const file = name === 'app' ? 'site/index.html' : 'site-supabase/index.html';
  return readFileSync(new URL(file, root),'utf8').replace(`<!-- compiled:${name} -->`, `<script>\n${siteCode(name)}\n</script>`);
}
export function siteFunction(name) {
  const source = siteCode();
  const ast = ts.createSourceFile('app.js',source,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
  const node = ast.statements.find(n=>ts.isFunctionDeclaration(n) && n.name?.text===name);
  if (!node) throw new Error(`Function not found: ${name}`);
  return node.getText(ast);
}
