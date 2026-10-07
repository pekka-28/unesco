import ts from 'typescript';
import {readdirSync} from 'node:fs';
const config = ts.readConfigFile('tsconfig.tooling.json', ts.sys.readFile);
if(config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config,ts.sys,'.');
const program = ts.createProgram(parsed.fileNames,parsed.options), checker=program.getTypeChecker();
const errors: string[]=[];
for(const dir of ['scripts','tests']) {
  for(const file of readdirSync(dir,{recursive:true,encoding:'utf8'})) {
    if(/\.(?:mjs|cjs|js)$/.test(file)) errors.push(`Unchecked JavaScript: ${dir}/${file}`);
  }
}
function containsAny(type: ts.Type, seen = new Set<ts.Type>()): boolean {
  if(seen.has(type)) return false;
  seen.add(type);
  if(type.flags & ts.TypeFlags.Any) return true;
  if(type.isUnionOrIntersection()) return type.types.some(t=>containsAny(t,seen));
  if(type.flags & ts.TypeFlags.Object) {
    const objectType=type as ts.ObjectType;
    if(objectType.objectFlags & ts.ObjectFlags.Reference) return checker.getTypeArguments(type as ts.TypeReference).some(t=>containsAny(t,seen));
  }
  return false;
}
for(const source of program.getSourceFiles().filter(f=>!f.isDeclarationFile && /(?:^|[\\/])(?:scripts|tests)[\\/]/.test(f.fileName) && !f.fileName.includes('node_modules'))) {
  const scanner=ts.createScanner(ts.ScriptTarget.Latest,false,ts.LanguageVariant.Standard,source.text);
  for(let token=scanner.scan();token!==ts.SyntaxKind.EndOfFileToken;token=scanner.scan()) {
    if((token===ts.SyntaxKind.SingleLineCommentTrivia||token===ts.SyntaxKind.MultiLineCommentTrivia) && /@ts-(?:ignore|nocheck|expect-error)/.test(scanner.getTokenText())) errors.push(`${source.fileName}: type suppression`);
  }
  function visit(node: ts.Node) {
    const location=source.getLineAndCharacterOfPosition(node.getStart(source));
    if(node.kind===ts.SyntaxKind.AnyKeyword) errors.push(`${source.fileName}:${location.line+1}: explicit any`);
    if((ts.isVariableDeclaration(node)||ts.isParameter(node)||ts.isBindingElement(node)) && ts.isIdentifier(node.name) && containsAny(checker.getTypeAtLocation(node.name))) errors.push(`${source.fileName}:${location.line+1}: untyped ${node.name.text}`);
    ts.forEachChild(node,visit);
  }
  visit(source);
}
if(errors.length) throw new Error(errors.join('\n'));
console.log('All Node scripts and tests are TypeScript; no any declarations, untyped collections or type suppressions.');
