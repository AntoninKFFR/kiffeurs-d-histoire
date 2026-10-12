import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
export function verifierDockerFixture(container:string){
  assert(container&&/^kffr-issue92-phase2(?:-[a-z0-9]+)?$/.test(container),"Conteneur de fixture explicite requis");
  assert(!process.env.DOCKER_HOST||/^(?:unix:|npipe:)/.test(process.env.DOCKER_HOST),"Docker distant interdit");
  const endpoint=execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();
  assert(/^(?:unix:|npipe:)/.test(endpoint),"Daemon Docker local requis");
  const label=execFileSync('docker',['inspect','--format','{{index .Config.Labels "kffr.audit"}}',container],{encoding:'utf8'}).trim();
  assert.equal(label,'issue92-phase2',"Conteneur non identifié comme fixture jetable");
}
