// Préparation de catalogue après activation locale autorisée. Aucun export distant dans cette phase.
import { writeFileSync,existsSync } from "node:fs";
import { connecterCartes, estUrlLocale } from "./import-cartes";
import { chargerStructure, appliquerEtatsPublies, type EtatPublie } from "./structure-pedagogique";
import { empreintesCartesPubliees } from "./completions-pedagogiques";
import { lignesEnfantsCourantes117 } from './han-117';
async function main(){
  const url=process.env.SUPABASE_URL, cle=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !cle || !estUrlLocale(url)) throw new Error("Export réservé à une pile locale explicite");
  const {data,error}=await connecterCartes(url,cle).rpc("export_pedagogical_structure");
  if (error) throw new Error("Export pédagogique indisponible");
  const registre=appliquerEtatsPublies(chargerStructure(),data as EtatPublie[]);
  const {data:editions,error:erreurEditions}=await connecterCartes(url,cle).from('pedagogical_editions').select('cards').eq('published',true);
  if(erreurEditions)throw new Error('Instantanés de complétion indisponibles');
  if(editions?.length) {
    const lignes=['content/pedagogie/cartes-v1.csv','content/pedagogie/cartes-sous-chapitres.csv','content/pedagogie/cartes-completions.csv'].flatMap(file=>existsSync(file)?lignesEnfantsCourantes117(file):[]);
    const empreintes=empreintesCartesPubliees(lignes,editions.flatMap(e=>e.cards as Record<string,unknown>[]));
    writeFileSync('content/pedagogie/cartes-publiees.json',JSON.stringify(empreintes,null,2)+'\n');
  }
  writeFileSync("src/lib/apprendre/structure.json",JSON.stringify(registre.filter(c=>c.etat!=="inactif"),null,2)+"\n");
  console.log(`${registre.filter(c=>c.etat==='actif').length} actifs, ${registre.filter(c=>c.etat==='historique').length} historiques ; régénérer le catalogue Solo et vérifier le build.`);
}
main().catch((error:unknown)=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
