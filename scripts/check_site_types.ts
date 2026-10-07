import ts from 'typescript';
import {readFileSync} from 'node:fs';
const config = ts.readConfigFile('tsconfig.json',ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config,ts.sys,'.');
const program = ts.createProgram(parsed.fileNames,parsed.options);
const checker = program.getTypeChecker();
const errors: string[] = [];
for (const source of program.getSourceFiles().filter(f=>/site[\\/]src[\\/].*\.ts$/.test(f.fileName))) {
  if (/@ts-(?:ignore|nocheck)/.test(source.text)) errors.push(`${source.fileName}: type suppression`);
  const visit = (node: ts.Node) => {
    if (node.kind===ts.SyntaxKind.AnyKeyword) errors.push(`${source.fileName}: explicit any`);
    if ((ts.isVariableDeclaration(node)||ts.isParameter(node)) && ts.isIdentifier(node.name) &&
        checker.getTypeAtLocation(node.name).flags & ts.TypeFlags.Any) errors.push(`${source.fileName}: untyped ${node.name.text}`);
    ts.forEachChild(node,visit);
  };
  visit(source);
}
for (const file of ['site/index.html','site-supabase/index.html','admin/index.html']) {
  const html=readFileSync(file,'utf8');
  if (/<script\s*>|\son\w+\s*=/i.test(html)) errors.push(`${file}: first-party code outside TypeScript`);
}
if (errors.length) throw new Error(errors.join('\n'));
console.log('Site code has no any declarations, type suppressions or handwritten inline JavaScript.');
