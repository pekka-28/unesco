import ts from 'typescript';
import {readdirSync} from 'node:fs';
const config=ts.readConfigFile('tsconfig.supabase.json',ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,'.');
const program=ts.createProgram(parsed.fileNames,parsed.options),checker=program.getTypeChecker(),errors: string[]=[];
for(const file of readdirSync('supabase/functions',{recursive:true,encoding:"utf8"}))if(/\.m?js$/.test(file))errors.push(`Untyped server source: ${file}`);
for(const source of program.getSourceFiles().filter(f=>/supabase[\\/]functions[\\/]/.test(f.fileName))){
 if(/@ts-(?:ignore|nocheck)|@ts-expect-error/.test(source.text))errors.push(`${source.fileName}: type suppression`);
 function visit(node: ts.Node){
  if(node.kind===ts.SyntaxKind.AnyKeyword)errors.push(`${source.fileName}: explicit any`);
  if((ts.isVariableDeclaration(node)||ts.isParameter(node))&&ts.isIdentifier(node.name)&&checker.getTypeAtLocation(node.name).flags&ts.TypeFlags.Any)errors.push(`${source.fileName}: untyped ${node.name.text}`);
  ts.forEachChild(node,visit);
 }
 visit(source);
}
for(const file of ['usage-summary','owner-admin','monthly-report','new-profile-notifications'])if(!parsed.fileNames.some(name=>name.replaceAll('\\','/').endsWith(`${file}/index.ts`)))errors.push(`Unchecked entrypoint: ${file}`);
if(errors.length)throw new Error(errors.join('\n'));
console.log('All Supabase entrypoints, handlers and shared modules are covered; no any or type suppressions.');
