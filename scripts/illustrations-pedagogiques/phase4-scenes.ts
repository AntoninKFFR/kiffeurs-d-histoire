// Choix explicites après lecture des 203 besoins et des cartes qui les partagent.
// Le CSV phase3 reste la source documentaire ; le tableau ci-dessous décrit les dessins.
import { lireCsv } from "../csv";
import { objetsPhase4, referencesObjetPhase4 } from "./phase4-objets";
export type CompositionPhase4 = "visavis" | "groupe" | "institution" | "reunion" | "signature" | "naval" | "rivage" | "memoire" | "atelier" | "division" | "couronnes" | "union" | "collines" | "tunnel" | "orbite" | "traversee" | "cargaison" | "desert" | "montagne" | "canal";
export type ScenePhase4 = { event:string; objets:string[]; composition:CompositionPhase4; intention:string; vigilance:string; references_DA:string[]; cardIds:string[]; title:string; adaptations:string[] };
// Deux grands objets en vis-à-vis ; un troisième en accessoire comme dans #66.
// Les exceptions de disposition ont un sens : rive/navire, atelier/instrument,
// deux couronnes ou institutions distinctes, division de l'autorité, table de signature.
const choix = `
0007|electrices,urne|groupe
0008|electrices,urne,assemblee|institution
0025|hutte-archaique,hutte-archaique|collines
0030|orateur-grec,temple,citoyens-antiques|groupe
0032|assemblee,laurier,colonne|institution
0035|menorah,mur,bouclier-rond|visavis
0040|hall-han,lamelles-bambou,rouleau|institution
0043|calendrier-lunaire,table-vide|atelier
0067|facade-versailles,couronne,soleil|institution
0074|barricade,facade-versailles|visavis
0075|table-conseil,couronne,documents|reunion
0077|siege-vide,couronne,bougie|memoire
0085|kepi,dossier-judiciaire|visavis
0087|femme-avocate,balance,documents|groupe
0092|table,parchemin,balance|signature
0093|assemblee,citoyens,documents|institution
0095|valise,citoyens,documents|groupe
0096|horloge-travail,citoyens,documents|visavis
0098|documents,assemblee,casque|institution
0099|acte-dechire,char-1940|visavis
0100|barricade,citoyens,ville|groupe
0102|cuirasse,table,documents|signature
0103|table,documents,casque|reunion
0105|wagon-rethondes,table,plume|signature
0106|assemblee,documents,siege-vide|institution
0112|transport-helices,barriere-levee,colis|visavis
0116|parchemin,chevalement,minerai|visavis
0117|documents,table,minerai|reunion
0119|dossier-constitution,colis,table|visavis
0121|documents,artillerie-xx,valise|memoire
0122|urne,citoyens,documents|groupe
0123|documents-diffuses,table|signature
0124|citoyens,palais,valise|groupe
0130|famille,dossier-constitution|groupe
0131|jeunes,urne,documents|groupe
0135|citoyens,documents,monnaie|groupe
0146|parchemin,voûte-sixtine,pinceau|atelier
0148|voute-peinte,pinceau,croix|institution
0153|parchemin,navire-xvii,monnaie|visavis
0158|baluchon,ouvert,parlement|visavis
0159|presse,ouvert,documents-diffuses|atelier
0171|femme,barreaux,ouvert|memoire
0176|assemblee,balance,couronne|institution
0177|dossier-judiciaire,table,balance|reunion
0178|assemblee,urne,balance|institution
0182|table,parchemin,globe|signature
0185|citoyens,barricade,couronne-brisee|groupe
0189|dossier-constitution,assemblee,figure-executive|institution
0190|urne,bicorne,citoyens|groupe
0191|parchemin,assemblee,plume|institution
0193|documents,boulevard,ville|visavis
0194|monnaie,train,usine|visavis
0195|banque,usine,rails|visavis
0198|parchemin,urne,documents-diffuses|visavis
0199|dossier-constitution,couronne,assemblee|institution
0202|urne,ville,citoyens|institution
0203|assemblee,parchemin,ville|institution
0205|barricade,barreaux,ville|memoire
0209|navire-1915,soldats-gallipoli,artillerie-xx|rivage
0211|artillerie-xx,barbeles,casque-allemand-1918|visavis
0227|portique,machine,locomotive-1900|institution
0241|parchemin,banque,micro|institution
0246|radio,parchemin|visavis
0248|artillerie-xx,documents|memoire
0249|documents,radio,citoyens|visavis
0252|barbeles,artillerie-xx,transport-helices|visavis
0258|tunnel,rails|tunnel
0264|ouvert,urne,citoyens|visavis
0269|plume,dossier-constitution,couronne|signature
0270|documents-diffuses,assemblee,citoyens|institution
0272|parchemin,citoyens,reseau|groupe
0274|table,globe,parchemin|reunion
0279|navire-commerce-moderne,poisson,parchemin|rivage
0281|porte-ouverte,valise,reseau|visavis
0291|iss-2000,globe|orbite
0301|documents,avion-1991,char-1991|memoire
0319|parchemin,usine,thermometre|visavis
0321|parchemin,reseau,thermometre|visavis
0323|electroscope,minerai,plaque-photo|atelier
0339|pierres-taillees,ossement|atelier
0370|lamelles-bambou,monnaie-qin,mesures-qin|atelier
0371|voyageur-han,baluchon,rouleau|visavis
0373|hoplites,bouclier-rond|rivage
0374|triere,triere|naval
0375|monnaie,temple,triere|institution
0376|bouclier-rond,triere,temple|visavis
0377|citoyens-antiques,coupe-socrate|groupe
0378|laurier,hoplites|visavis
0379|bouclier-rond,cavalier-antique|visavis
0380|cavalier-antique,hoplites|groupe
0381|laurier-depose,sieges-deux,parchemin|division
0382|assemblee,sieges-deux|institution
0383|galere,triere|naval
0384|mur-brise,porte-close|memoire
0385|legionnaire-republicain,legionnaire-republicain,laurier|traversee
0386|laurier-depose,assemblee|memoire
0387|galere,galere,laurier|naval
0389|table,rouleau,croix|reunion
0390|porte-ouverte,mur,bouclier-rond|visavis
0391|rouleau,table,croix|institution
0392|lamelles-bambou,sieges-deux|division
0393|boucliers-francs,epee|visavis
0394|porte-ouverte,couronne-lombarde|visavis
0395|boucliers-francs,cavalier-antique|groupe
0396|parchemin,sceau,baluchon|signature
0397|couronne-ottonienne,croix|visavis
0398|bouclier-normand,cavalier-normand|groupe
0404|baluchon,voyageur-marchand|visavis
0405|navire,ouvert|visavis
0406|arc-long,bouclier-medieval|visavis
0407|couronne,chaine,parchemin|memoire
0409|sieges-deux,croix,parchemin|division
0410|bouclier-medieval,arc-long|rivage
0411|porte-ouverte,bouclier-medieval,combattants-medievaux|groupe
0412|couronne,cathedrale-reims|institution
0413|dossier-judiciaire,bougie|memoire
0415|couronne,couronne,parchemin|couronnes
0416|parchemin,balance,barreaux|institution
0417|palais-nasride,cles-grenade|visavis
0421|parchemin,eglise,sceau|visavis
0422|porte-close,bougie|memoire
0423|parlement,parlement,couronne|union
0424|navire-xvii,hameau-colonial,habitants-rivage|rivage
0425|parchemin,table,navire-xvii|signature
0426|parchemin,epee,baluchon|memoire
0430|fort-chantier,navire-xvii,roue|atelier
0431|navire-xvii,globe|visavis
0433|navire-xvii,colis,colis-immerge|cargaison
0435|canon-xviii,table|signature
0436|navire-xvii,canon-xviii|rivage
0437|table,parchemin,sceau|signature
0440|couronne-brisee,assemblee,bonnet|institution
0441|canon-xviii,citoyens-xvii,bonnet|groupe
0443|femme,balance,couronne|memoire
0444|assemblee,barreaux|memoire
0445|table-conseil,parlement,dossier-constitution|institution
0449|citoyens,chaine-rompue,parchemin|groupe
0450|table,couronne,parchemin|signature
0451|citoyens,barricade|groupe
0452|parchemin,assemblee,siege-vide|institution
0454|parlement,urne,usine|institution
0455|parchemin,chaine,sceau|signature
0456|telegraphe,citoyens|atelier
0461|canon-1863,navire-1850|rivage
0462|parchemin,navire-1850|visavis
0464|cable-atlantique,telegraphe|atelier
0468|canon-1863,mur|visavis
0470|brancard,parchemin|visavis
0473|canon-1863,couronne-brisee,bicorne|memoire
0474|parchemin,monnaie,documents|visavis
0477|tour,machine,citoyens|atelier
0478|dossier-judiciaire,couronne,bougie|memoire
0479|documents,artillerie-xx,casque|visavis
0480|documents,artillerie-xx,kepi|visavis
0481|documents,navire-1915|visavis
0483|assemblee,navire-1915,citoyens|institution
0485|parchemin,acte-dechire|visavis
0486|table-trois,documents|reunion
0487|assemblee,dossier-constitution,globe|institution
0488|citoyens,palais,couronne|groupe
0489|couronne,documents,assemblee|institution
0490|citoyens,barreaux,documents|memoire
0491|monnaie,table,documents|reunion
0492|documents,balance,porte-close|visavis
0493|table,documents,artillerie-xx|signature
0495|finance-crise,balance|visavis
0496|marcheurs-inde,recipient-sel|rivage
0498|parlement,barreaux,documents|memoire
0500|chaine-rompue,dossier-judiciaire,casque|memoire
0503|ville,avion-helices,pinceau|memoire
0505|table,dossier-secret|reunion
0506|char-1940,valise|visavis
0507|evacuation-dunkerque,soldats-1940|rivage
0508|soldats-1940,ville,valise|groupe
0509|avion-helices,radar-1940,maison|visavis
0511|table-vide,documents|memoire
0512|porte-avions,avion-helices,documents|rivage
0513|mur-brise,artillerie-xx,barbeles|visavis
0514|artillerie-xx,mur|desert
0515|navire-debarquement,artillerie-xx|rivage
0516|documents,micro,acte-dechire|visavis
0517|table-trois,documents,casque|reunion
0519|table-trois,documents-diffuses|reunion
0523|micro,documents,maison|visavis
0524|table,documents,globe|signature
0525|citoyens,micro,documents|groupe
0527|table,documents,char-sovietique|reunion
0528|cargo-1950,table|canal
0529|citoyens,porte-ouverte,documents|groupe
0530|parchemin,artillerie-xx,baluchon|visavis
0531|assemblee,urne,dossier-constitution|institution
0532|navire-debarquement,char-1940|rivage
0534|dossier-constitution,micro,bougie|memoire
0535|destroyer,documents,assemblee|institution
0536|journal,char-sovietique|visavis
0538|documents,table,missile|signature
0539|urne,siege-vide,documents|institution
0540|table,documents-diffuses,citoyens|reunion
0543|char-sovietique,baluchon|montagne
0544|citoyens,table,destroyer|reunion
0545|centrale-endommagee,valise,documents|memoire
0548|chaine-rompue,documents,citoyens|groupe
0553|cite-akkad,tablette|institution
`;
const lignesChoix=choix.trim().split("\n").map(l=>l.trim().split("|"));
const inventaire=lireCsv("docs/phase-3-92/illustrations-par-evenement.csv");
const cartes=[...lireCsv("content/pedagogie/cartes-completions.csv"),...lireCsv("content/pedagogie/cartes-sous-chapitres.csv")];
if (lignesChoix.length!==203 || new Set(lignesChoix.map(l=>l[0])).size!==203) throw new Error("Il faut exactement 203 choix explicites distincts.");
export const scenesPhase4:ScenePhase4[]=lignesChoix.map(([id,liste,composition])=>{
  const event=`EVT-${id}`, notice=inventaire.find(r=>r.event_id===event);
  if (!notice || notice.nouvelle_illustration_requise!=="oui") throw new Error(`Événement non manquant : ${event}`);
  const liees=cartes.filter(c=>c.event_id===event), objets=liste.split(",");
  if (!liees.length || liees.map(c=>c.card_id).sort().join(";")!==notice.card_ids.split(";").sort().join(";")) throw new Error(`Correspondance documentaire incorrecte : ${event}`);
  const references_DA=[...new Set(objets.flatMap(referencesObjetPhase4))];
  if (!references_DA.length || objets.some(n=>!referencesObjetPhase4(n).length)) throw new Error(`Forme sans référence : ${event}`);
  const adaptations=objets.map(n=>objetsPhase4[n]?.adaptation).filter((s):s is string=>Boolean(s));
  if(event==="EVT-0383") adaptations.push("L'île entre les flottes est symbolique : son contour ne prétend pas être une représentation cartographique reconnaissable ou exacte de la Sicile.");
  return {event,objets,composition:composition as CompositionPhase4,intention:notice.intention,vigilance:notice.vigilances_historiques,references_DA,cardIds:liees.map(c=>c.card_id),title:liees[0].title,adaptations};
});
