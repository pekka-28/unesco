// Validate Mermaid diagrams and render review images; accepts Markdown file paths.
import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
declare const mermaid: {
 initialize(options:{startOnLoad:boolean;theme:string}):void;
 render(id:string,source:string):Promise<{svg:string}>;
};
const files=process.argv.slice(2);
if(!files.length)files.push('supabase/SCHEMA.md','ARCHITECTURE.md');
const diagrams: {file:string;source:string}[]=[];
for(const file of files) {
 const markdown=await readFile(file,'utf8');
 for(const match of markdown.matchAll(/```mermaid\r?\n([\s\S]*?)```/g))diagrams.push({file,source:match[1]});
}
if(!diagrams.length)throw new Error('No Mermaid diagrams found in the requested files');
const output=path.resolve('.local/diagrams');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.MWH_CHROME_PATH});
try {
 const page=await browser.newPage({viewport:{width:1100,height:900}});
 await page.setContent('<html><body style="background:white"></body></html>');
 await page.addScriptTag({url:'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js'});
 for(const [index,diagram] of diagrams.entries()) {
  await page.evaluate(async({source,index})=>{
   mermaid.initialize({startOnLoad:false,theme:'base'});
   const {svg}=await mermaid.render('diagram'+index,source);document.body.innerHTML=svg;
  },{source:diagram.source,index});
  await page.screenshot({path:path.join(output,`diagram-${index}.png`),fullPage:true});
  console.log(`${diagram.file}: diagram ${index} rendered`);
 }
}finally{await browser.close();}
