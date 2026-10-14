import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync,writeFileSync,unlinkSync,rmdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,basename} from "node:path";
export function verifierDockerFixture(container:string){
  assert(container&&/^kffr-issue92-phase2(?:-[a-z0-9]+)?$/.test(container),"Conteneur de fixture explicite requis");
  assert(!process.env.DOCKER_HOST||/^(?:unix:|npipe:)/.test(process.env.DOCKER_HOST),"Docker distant interdit");
  const endpoint=execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();
  assert(/^(?:unix:|npipe:)/.test(endpoint),"Daemon Docker local requis");
  const label=execFileSync('docker',['inspect','--format','{{index .Config.Labels "kffr.audit"}}',container],{encoding:'utf8'}).trim();
  assert.equal(label,'issue92-phase2',"Conteneur non identifié comme fixture jetable");
}

/** Sur Windows, transmettre le même SQL par un fichier temporaire propre
 * à l'appel évite de dépendre du pipe stdin de Docker Desktop.
 */
export function executerSqlDockerLocal(container:string,database:string,requete:string,maxBuffer=10_000_000){
  const args=['exec',container,'psql','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-X','-Atq'];
  if(process.platform!=='win32')return execFileSync('docker',[args[0],'-i',...args.slice(1)],{
    input:requete,encoding:'utf8',maxBuffer,stdio:['pipe','pipe','pipe']}).trim();
  const directory=mkdtempSync(join(tmpdir(),'kffr-sql-local-')),file=join(directory,'requete.sql');
  const remote='/tmp/'+basename(directory)+'.sql';
  try{
    writeFileSync(file,requete);
    execFileSync('docker',['cp',file,container+':'+remote],{stdio:'pipe'});
    return execFileSync('docker',[...args,'-f',remote],{encoding:'utf8',maxBuffer,stdio:['ignore','pipe','pipe']}).trim();
  }finally{
    execFileSync('docker',['exec',container,'rm','-f',remote],{stdio:'pipe'});
    unlinkSync(file);rmdirSync(directory);
  }
}
