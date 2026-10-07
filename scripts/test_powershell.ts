import {execFileSync} from 'node:child_process';
const shell=process.platform==='win32'?'powershell.exe':'pwsh';
for(const file of ['scripts/check_powershell.ps1','tests/catalogue.tests.ps1']) {
  execFileSync(shell,['-NoProfile','-ExecutionPolicy','Bypass','-File',file],{stdio:'inherit'});
}
