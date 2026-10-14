// Extension locale du stock #66 : aucune mutation de objets.ts ou des SVG validés.
// Les références désignent la facture graphique, jamais une preuve de restitution.
import { objets, placer } from "./objets";
export const palettePhase4 = { papier: "#f3f2ec", encre: "#1d2a3a", laiton: "#b08a3e", oxyde: "#8a2f2b", sauge: "#7e8c7a" };
const {papier: P, encre: E, laiton: L, oxyde: O, sauge: S} = palettePhase4;
const p = (d: string, fill?: string) => `<path d="${d}"${fill ? ` fill="${fill}"` : ""}/>`;
const r = (x: number, y: number, w: number, h: number, fill=P, rx=0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" rx="${rx}"/>`;
const c = (x: number,y: number,rayon: number,fill=P) => `<circle cx="${x}" cy="${y}" r="${rayon}" fill="${fill}"/>`;
export type ObjetPhase4 = {svg: string; references: string[]; adaptation: string};
export const objetsPhase4: Record<string, ObjetPhase4> = {};
function ajouter(nom:string, refs:string[], adaptation:string, svg:string) { objetsPhase4[nom] = {svg,references: refs.map(n=>`EVT-${n}.svg`), adaptation}; }
function derivation(nom:string, stock:string, adaptation:string, svg:string) { ajouter(nom,[objets[stock].reference.slice(4,8)],adaptation,svg); }
// Les personnages reprennent la tête ronde et les membres au trait d'EVT-0016.
function personne(x:number, y:number, fill:string, tunique=false) { return c(x,y,7)+p(tunique ? `M${x-7} ${y+8}l-4 34h22l-4-34z` : `M${x-9} ${y+8}h18v30h-18z`,fill)+p(`M${x-4} ${y+42}v16M${x+4} ${y+42}v16`); }
const groupe = (tunique=false) => [16,40,64].map((x,i)=>personne(x,20,i===1?L:S,tunique)).join("");
ajouter("citoyens-antiques",["0016","0623"],"Tuniques antiques ; citoyens masculins, sans portrait.",groupe(true));
ajouter("citoyens-xvii",["0016","0623"],"Manteaux et chapeaux de l'époque moderne ; silhouettes conventionnelles.",groupe()+[16,40,64].map(x=>p(`M${x-9} 15h18M${x-5} 15V8h10v7`,E)).join(""));
ajouter("marcheurs-inde",["0016","0623"],"Tuniques légères, bâton de marche ; aucune ressemblance attestée de Gandhi.",groupe(true)+p("M34 28L22 46M4 28v52"));
ajouter("electrices",["0006","0016"],"Femmes aux élections de 1945 ; silhouettes et robes sobres de l'après-guerre.",[20,58].map((x,i)=>personne(x,20,i?S:O,true)+p(`M${x-7} 18q-1-15 7-15q10 0 9 17`,E)).join(""));
ajouter("jeunes",["0016"],"Jeunes majeurs : même grammaire, silhouettes sans attribut militaire.",[20,56].map((x,i)=>personne(x,20,i?O:S)).join(""));
ajouter("orateur-grec",["0016","0623"],"Orateur en tunique devant des citoyens, pas portrait de Périclès.",personne(40,16,L,true)+p("M32 32L10 24M48 32l22-12")+r(18,74,44,10,S));
ajouter("hoplites",["0016","0685","0688"],"Boucliers ronds et lances ; aucun casque moderne ni croix de serrure.",[20,52].map(x=>personne(x,18,S,true)+c(x-7,48,14,L)+c(x-7,48,3,E)+p(`M${x+17} 76V8l-3 6h6z`)).join(""));
ajouter("legionnaires-republicains",["0016","0685","0623"],"Soldats romains de la fin de la République : tuniques et boucliers ovales, aucun hoplite grec ni équipement impérial tardif attesté.",[20,54].map(x=>personne(x,18,O,true)+`<ellipse cx="${x-7}" cy="50" rx="10" ry="19" fill="${L}"/>`+c(x-7,50,3,E)+p(`M${x-8} 14q0-10 8-10q8 0 8 10z`,L)+p(`M${x+14} 80V22l-2 4h4z`)).join(""));
ajouter("legionnaire-republicain",["0016","0685","0623"],"Soldat romain républicain sur une rive du Rubicon : tunique, bouclier ovale et lance ; aucun pont ajouté.",personne(34,18,O,true)+`<ellipse cx="27" cy="50" rx="10" ry="19" fill="${L}"/>`+c(27,50,3,E)+p("M26 14q0-10 8-10q8 0 8 10z",L)+p("M56 80V22l-2 4h4z"));
ajouter("barriere-levee",["0537","0064"],"Barrière d'accès terrestre levée à la fin du blocus de Berlin en 1949 ; aucun mur de 1961 ni chute de 1989.",r(10,58,18,26,L)+p("M22 62L62 10l6 5L28 67z",P)+p("M32 48l6 5M46 30l6 5M60 12l6 5")+p("M48 84h26M60 84V58",S));
ajouter("bouclier-rond",["0685","0688"],"Bouclier antique rond et lance, remplacement du bouclier à serrure.",c(34,48,28,S)+c(34,48,6,L)+p("M70 84V6l-4 8h8z"));
ajouter("boucliers-francs",["0685","0688"],"Boucliers ronds et fer de lance du haut Moyen Âge, pas armure à plates.",c(23,50,20,S)+c(57,48,20,L)+c(23,50,4,E)+c(57,48,4,E)+p("M12 26V4l-3 8h6zM68 24V4l-3 8h6z"));
ajouter("arc-long",["0688","0623"],"Arc long médiéval ; bois courbe et corde au trait, aucune surface pleine entre eux.",p("M24 8q50 36 0 72M24 8v72")+p("M12 46h62M66 42l8 4l-8 4M16 42l8 4l-8 4"));
ajouter("bouclier-normand",["0685","0623"],"Bouclier en amande, équipement normand conventionnel du XIe siècle.",p("M14 24a22 22 0 0 1 44 0q0 32-22 60q-22-28-22-60z",S)+p("M36 12v50M20 28h32",L)+p("M70 82V6l-4 8h8z"));
ajouter("bouclier-medieval",["0685","0688"],"Écu médiéval dépourvu de serrure contemporaine.",p("M12 16h56v24q0 28-28 42q-28-14-28-42z",S)+p("M40 18v56M14 40h52",L));
// Le couvre-chef du stock est un sous-chemin du path des membres, pas un élément séparé.
// Ne remplacer que ce segment conserve les membres et la silhouette du cheval validés.
const cavalierSansCasque=objets.cavalier.svg.replace("M22 12l6-8h12l4 8z","");
if(cavalierSansCasque===objets.cavalier.svg) throw new Error("Le segment de casque du stock a changé.");
derivation("cavalier-antique","cavalier","Cavalier en tunique et longue lance, couvre-chef bas ; pas d'armure ni d'étrier représenté.",cavalierSansCasque+p("M26 10q8-10 16 0z",L)+p("M48 38L74 6l-1 8l-5-4"));
derivation("cavalier-normand","cavalier","Cavalier avec casque conique simple, sans plates tardives.",cavalierSansCasque+p("M26 12L34 2l8 10z",S)+p("M46 32L74 12"));
derivation("voyageur-han","cavalier","Voyageur à cheval en tunique et couvre-chef en tissu ; pas casque guerrier du stock ni boussole.",cavalierSansCasque+r(26,8,16,5,E)+r(8,34,16,12,L));
derivation("voyageur-marchand","cavalier","Voyageur et ballots, couvre-chef souple, plutôt qu'un chevalier de conquête.",cavalierSansCasque+p("M24 12q10-16 20 0z",P)+r(10,34,16,12,L));
ajouter("hutte-archaique",["0705","0613"],"Habitat bas de bois/torchis, toiture végétale ; pas restitution exacte d'une hutte fouillée.",p("M10 50q30-58 60 0z",L)+p("M16 50v32h48V50z",P)+p("M34 82V60h14v22",E)+p("M24 44L36 18M56 44L44 18"));
ajouter("hameau-colonial",["0705","0613"],"Habitat colonial initial en bois ; silhouette de chantier, aucun territoire présenté comme inhabité.",r(10,46,56,38,L)+p("M4 46l34-26l34 26z",P)+p("M22 46v38M54 46v38M32 84V62h12v22",E));
ajouter("pierres-taillees",["0338","0368"],"Éclats et blocs de pierre : aucun manche métallique ni hache moderne.",p("M8 64L14 38l20-22l20 8l16 28l-14 28l-32-2z",S)+p("M14 38l22 16l18-30M36 54l20 26M36 54L8 64")+p("M4 80l10-12l12 16z",L));
ajouter("ossement",["0338","0623"],"Vestige schématique étudié par l'archéologie, aucun dinosaure.",p("M16 72q-16 4-12-8q0-8 10-8L52 20q-2-12 8-12q12-2 12 8q12 10 0 16q-6 2-12-2L24 64q8 10 0 14q-8 2-8-6z",P));
ajouter("hall-han",["0520","0620"],"Hall chinois bas à toiture, sans étages de pagode ; architecture conventionnelle non relevée.",r(12,44,56,40,P)+p("M2 42q16-3 24-16h28q8 13 24 16l-12 4H14z",S)+p("M14 50v30M28 50v30M52 50v30M66 50v30")+r(34,58,12,26,E));
ajouter("lamelles-bambou",["0298","0637"],"Administration Qin/Han : lamelles reliées plutôt que tablette cunéiforme.",[16,26,36,46,56,66].map(x=>r(x,12,8,68,L,2)).join("")+p("M16 28h58M16 64h58M30 38v16M50 38v16"));
ajouter("monnaie-qin",["0632"],"Monnaie ronde à trou carré, silhouette schématique sans inscription.",c(38,46,28,L)+r(31,39,14,14,P)+p("M56 68l12 10M62 54l12 2"));
ajouter("mesures-qin",["0632","0637"],"Mesure normalisée symbolique, pas mesure chiffrée inventée.",r(12,38,56,34,L)+p("M12 38l10-12h38l8 12M22 26v12M60 26v12M8 82h64M20 76v6M32 76v6M44 76v6M56 76v6"));
ajouter("galere",["0063","0707"],"Galère antique, rames et éperon ; aucun vapeur ni château arrière moderne.",p("M2 58h70l4 10l-12 12H14z",L)+p("M70 64h10M42 58V10M26 14h34")+p("M28 14h30v32H28z",P)+[12,22,32,42,52,62].map(x=>p(`M${x} 66l-8 20`)).join("")+p("M4 88q18-6 36 0t36 0"));
ajouter("triere",["0063","0707"],"Trière de combat à rames, mât abaissé ; pas restitution technique détaillée.",p("M2 52h70l4 12l-12 16H14z",L)+p("M70 58h10M8 48h62M14 42h48")+[12,24,36,48,60].map(x=>p(`M${x} 62l-10 24M${x+2} 52l-8 16`)).join("")+p("M2 88q18-6 36 0t38 0"));
ajouter("navire-xvii",["0063"],"Voilier commercial de l'époque moderne, aucun vapeur.",objets.navire.svg+p("M8 62V52h12v10M58 62V46h12v16",S));
ajouter("navire-debarquement",["0707","0017"],"Barge à moteur et rampe de débarquement de la Seconde Guerre mondiale.",p("M6 54h62v24H16z",S)+p("M68 54l10 28H68z",L)+r(12,32,22,22,P)+p("M14 32V20h8M34 42h22M4 84q18-6 36 0t38 0"));
ajouter("evacuation-dunkerque",["0707","0634"],"Petite embarcation et transport militaire ; le symbole n'attribue pas le sauvetage aux seuls civils.",p("M2 56h56L44 76H12z",L)+r(16,38,20,18,P)+p("M60 28h18v38H60z",S)+p("M2 84q18-6 36 0t38 0"));
ajouter("porte-avions",["0707","0013"],"Pont continu et îlot latéral de porte-avions du Pacifique ; pas un cuirassé.",p("M4 58h72L64 78H14z",S)+r(2,48,76,10,P)+r(52,26,16,22,L)+p("M58 26V8M52 14h18M8 42h44M8 84q18-6 36 0t36 0"));
ajouter("destroyer",["0707"],"Navire du contexte Tonkin : superstructure et mât, pas grand voilier.",p("M2 64h76L64 82H14z",S)+r(24,44,34,20,P)+r(34,28,12,16,P)+p("M40 28V8M28 14h28M8 60h12M62 60h14M4 88q18-6 36 0t36 0"));
ajouter("navire-1915",["0707","0210"],"Transport naval à vapeur de la Grande Guerre, sans avion ni péniche de 1944.",p("M2 64h76L64 82H14z",S)+r(18,42,46,22,P)+r(28,18,10,24,E)+p("M52 42V10M44 22h16M8 88q18-6 36 0t36 0"));
ajouter("navire-1850",["0707"],"Navire à vapeur et voile auxiliaire de la guerre de Crimée.",objets.vapeur.svg+p("M8 60h10M58 60h16"));
ajouter("navire-commerce-moderne",["0707"],"Navire de commerce du droit maritime contemporain, sans voile ancienne.",p("M2 62h76L64 82H14z",S)+r(6,34,20,28,P)+r(32,44,18,18,L)+r(50,44,20,18,O)+p("M14 34V14M8 88q18-6 36 0t36 0"));
ajouter("cargo-1950",["0707","0063"],"Cargo conventionnel du milieu du XXe siècle, mâts de charge et cales ; aucun empilement de conteneurs.",p("M2 64h76L64 82H14z",S)+r(48,38,22,26,P)+r(54,22,8,16,E)+r(12,56,28,8,L)+p("M22 56V14M22 26l18 14M36 56V22M36 34L8 46")+c(54,50,2,E)+c(64,50,2,E));
ajouter("avion-helices",["0013"],"Monoplan à hélice du contexte 1937–1945, aucune réaction.",objets.avion.svg);
ajouter("transport-helices",["0013"],"Transport bimoteur à hélices pour Berlin et Diên Biên Phu.",objets.transport.svg+p("M54 36v20M66 36v20"));
ajouter("avion-1991",["0013"],"Appareil à réaction contemporain de la guerre du Golfe.",objets.reacteur.svg);
ajouter("locomotive-1900",["0691","0018"],"Locomotive à vapeur ; aucun avion de transport à l'Exposition de 1900.",objets.train.svg);
ajouter("wagon-rethondes",["0691","0091"],"Wagon de signature sur rails ; aucune locomotive à la place du lieu de négociation.",r(4,26,72,46,L,3)+[14,34,54].map(x=>r(x,34,12,14,P)).join("")+p("M6 56h68M4 80h72")+[18,62].map(x=>c(x,76,6,E)).join(""));
ajouter("casque-allemand-1918",["0012"],"Casque à rebord du contexte Michael ; aucun Adrian français pour les Allemands.",p("M12 52V40q0-24 28-24t28 24v12l8 10H12z",S)+p("M12 52h56M12 62l8 8M60 62v12"));
ajouter("soldats-gallipoli",["0016","0012"],"Silhouettes de soldats en casquette souple de 1915 ; casque Adrian écarté.",groupe()+[16,40,64].map(x=>p(`M${x-8} 16h18l4 3h-22z`,L)).join(""));
ajouter("soldats-1940",["0016","0012"],"Silhouettes en casque du conflit 1939–1945, sans insigne idéologique.",groupe()+[16,40,64].map(x=>p(`M${x-9} 16q0-11 9-11q9 0 9 11z`,S)).join(""));
ajouter("combattants-medievaux",["0016","0623"],"Combattants de la fin du Moyen Âge en tenues simples et casques arrondis ; aucune tenue moderne.",groupe(true)+[16,40,64].map(x=>p(`M${x-8} 16q0-10 8-10q8 0 8 10z`,S)).join(""));
ajouter("habitants-rivage",["0016","0623"],"Présence de populations sur le rivage de Jamestown, sans déguisement de théâtre ni portrait ethnographique prétendu.",groupe(true));
ajouter("fort-chantier",["0173","0705"],"Forteresse initiale et matériaux de chantier, pas palais achevé de Saint-Pétersbourg.",p("M6 56l16-16l18 8l18-8l16 16l-8 28H14z",S)+p("M6 56h68M24 48v8M56 48v8M30 84V66h20v18",P)+p("M4 92h72"));
ajouter("char-1940",["0097"],"Blindé à chenilles contemporain de la campagne de France.",objets.char.svg);
ajouter("char-1991",["0097"],"Blindé contemporain simplifié : tourelle et canon long, sans modèle précis affirmé.",p("M8 50h64v18H8z",S)+p("M22 50l6-20h26l10 20z",S)+p("M54 38h26")+r(4,68,72,14,E,7)+[16,32,48,64].map(x=>c(x,75,3,P)).join(""));
ajouter("char-sovietique",["0097"],"Blindé schématique des interventions de 1968/1979 ; sans nationalité inscrite.",p("M8 52h64v16H8z",S)+p("M24 52q-6-30 22-24q12 2 14 24z",S)+p("M54 38h24")+r(4,68,72,14,E,7)+[16,32,48,64].map(x=>c(x,75,3,P)).join(""));
ajouter("canon-xviii",["0466","0210"],"Affût à roues de bois XVIIIe–XIXe ; l'artillerie moderne #66 n'est pas réutilisée.",p("M4 44l62-12l4 10l-62 12z",E)+p("M34 52l34 30h10")+c(32,66,18,L)+p("M14 66h36M32 48v36M20 54l24 24M20 78l24-24"));
ajouter("canon-1863",["0466","0210"],"Canon de campagne du XIXe siècle, sans équipement de guerre mondiale.",p("M4 44h62l8 8H4z",E)+p("M34 54l36 28h8")+c(32,66,18,L)+p("M14 66h36M32 48v36M20 54l24 24M20 78l24-24"));
ajouter("artillerie-xx",["0210"],"Pièce de campagne du XXe siècle ; évocation générique sans modèle exact.",objets.artillerie.svg);
ajouter("siege-vide",["0016","0044"],"Siège vide de succession ou absence, sans corps ni scène funéraire spectaculaire.",r(22,14,36,42,L,3)+r(16,56,48,10,P)+p("M22 66v18M58 66v18M16 42v14M64 42v14"));
ajouter("sieges-deux",["0016","0118"],"Deux sièges distincts d'autorité : la rivalité n'est pas un changement de religion.",[4,46].map(x=>r(x,24,28,32,L)+r(x-2,56,32,8,P)+p(`M${x} 64v20M${x+28} 64v20`)).join(""));
ajouter("couronne-lombarde",["0044"],"Bande royale sans croix haute ni couronne médiévale tardive.",r(10,40,60,22,L,2)+p("M10 50h60M22 40v22M40 40v22M58 40v22")+[22,40,58].map(x=>c(x,50,3,O)).join(""));
ajouter("couronne-ottonienne",["0044"],"Couronne impériale à plaques et arc, convention du sacre sans emblème écrit.",p("M10 62V34l15-10l15 10l15-10l15 10v28z",L)+p("M24 24q16-34 32 0M40 8V2M36 5h8")+r(8,62,64,8,O));
ajouter("voûte-sixtine",["0497","0521"],"Voûte en berceau stylisée, aucune coupole ni copie de fresque.",p("M8 82V42q32-54 64 0v40M16 80V44q24-38 48 0v36")+p("M16 44h48M40 24v20M16 44l12-18M64 44L52 26M8 62h8M64 62h8"));
ajouter("voute-peinte",["0497","0521","0016"],"Figures humaines abstraites en panneaux de voûte ; aucun Jugement dernier.",p("M8 82V42q32-54 64 0v40M16 80V44q24-38 48 0v36")+p("M16 44h48M40 24v20")+c(30,34,3,L)+c(50,34,3,L)+p("M30 38l-4 10h8zM50 38l-4 10h8z",O));
ajouter("facade-versailles",["0520"],"Façade basse de cour royale, silhouette évocatrice de Versailles, sans relevé architectural.",r(2,44,76,40,P)+r(24,28,32,56,P)+p("M20 28L40 14l20 14z",L)+[10,20,30,42,54,66].map(x=>r(x,52,6,12,P)).join("")+r(34,66,12,18,E));
ajouter("cathedrale-reims",["0521","0173"],"Façade à deux tours et arcs, symbole de cathédrale gothique sans restitution précise.",r(8,18,18,66,P)+r(54,18,18,66,P)+p("M26 84V40l14-14l14 14v44z",P)+c(40,48,6,L)+p("M34 84V70a6 6 0 0 1 12 0v14z",E)+p("M14 30h6M60 30h6M14 48h6M60 48h6"));
ajouter("porte-close",["0064"],"Porte fermée pour la mémoire d'un massacre, pas ouverture festive.",p("M12 84V32a28 28 0 0 1 56 0v52z",P)+p("M40 4v80M12 40h56M12 62h56")+c(34,54,2,L)+c(46,54,2,L));
ajouter("cles-grenade",["0064","0065"],"Clés conventionnelles de remise d'une ville ; aucun emblème contemporain.",c(24,24,12,L)+p("M24 36v46h12v-8H24M50 18a10 10 0 1 0 20 0a10 10 0 1 0-20 0",L)+p("M60 28v42h12v-8H60"));
ajouter("palais-nasride",["0520","0497"],"Façade à arc outrepassé, silhouette nasride conventionnelle, pas palais chinois.",r(8,30,64,54,P)+p("M4 30h72M14 20h52")+p("M28 84V60q-10-22 12-22q22 0 12 22v24z",E)+p("M16 42v20M64 42v20"));
ajouter("horloge-travail",["0438","0632"],"Horloge et calendrier hebdomadaire abstrait ; aucun chiffre ni durée quotidienne inventée.",c(40,40,26,P)+p("M40 20v20l14 10M40 12V6M12 40H6M68 40h6")+r(10,74,60,10,L)+p("M20 74v10M30 74v10M40 74v10M50 74v10M60 74v10"));
ajouter("calendrier-lunaire",["0298","0420"],"Cycles lunaires dans un rouleau : aucune date du voyage ni représentation de Muhammad.",r(14,12,52,64,P)+r(10,4,60,8,E)+r(10,76,60,8,E)+c(28,40,9,L)+p("M54 30a11 11 0 1 0 0 20a8 8 0 1 1 0-20z",S));
ajouter("electroscope",["0324","0338","0018"],"Instrument à feuilles et récipient de verre de Becquerel ; sans radiation colorée.",r(14,32,52,48,P,3)+r(8,26,64,6,L)+p("M40 14v38l-10 18M40 52l10 18")+c(40,12,9,L)+p("M10 84h60M18 38v36"));
ajouter("telegraphe",["0018","0014"],"Manipulateur et ligne électrique, sans téléphone ni écran.",r(8,66,64,14,L)+r(22,44,12,22,P)+p("M20 44h40M52 44v12M8 56h14M64 52h12V12M68 18h12M72 6v24")+c(62,42,5,E));
ajouter("cable-atlantique",["0707","0696"],"Câble sous les vagues entre deux rivages ; pas promesse d'une liaison déjà durable.",p("M2 30h12l10 14M78 30H66L56 44",S)+p("M4 48q18-8 36 0t36 0M4 64q18-8 36 0t36 0M14 38q8 42 28 42q18 0 24-42",undefined));
ajouter("brancard",["0016","0703"],"Brancard de secours de 1864 ; aucune victime blessée détaillée.",r(8,44,64,20,P)+p("M2 44h76M2 64h76M18 40v28M62 40v28")+p("M34 46h12v6h6v8H28v-8h6z",O));
ajouter("recipient-sel",["0324","0338"],"Récipient ordinaire de collecte du sel ; aucun appareil de laboratoire.",p("M10 48h60l-8 32H18z",L)+p("M10 48q30-18 60 0z",P)+p("M22 44l8-6l8 5l10-6l10 7",P));
ajouter("radar-1940",["0696","0018"],"Mât de détection de la défense britannique, schématique sans satellite.",p("M14 84L38 24l24 60M38 24V6M18 6h40M16 14h44M38 4v14M14 84h50M26 54h24M20 70h36"));
ajouter("iss-2000",["0288","0290","0693"],"Station lors d'Expedition1 : modules initiaux/Zvezda, petites ailes solaires ; pas station finale.",r(8,26,18,40,L)+r(54,26,18,40,L)+p("M17 26v40M63 26v40M8 40h18M8 54h18M54 40h18M54 54h18")+r(26,36,28,18,P,4)+p("M26 45H8M54 45h18M40 36V18h12v18M32 54v18h12V54",P)+p("M32 42h16"));
ajouter("centrale-endommagee",["0018","0705"],"Réacteur et bâtiments endommagés : aucun champignon de bombe atomique.",r(8,48,64,36,S)+p("M8 48V26h24l8 12l-8 10M44 48V34h28v14",P)+p("M32 26l-4 12l12 10M8 70h20M52 58h12M52 70h12")+p("M34 84V60h10v24",E));
ajouter("cite-akkad",["0613","0637"],"Façade de cité en briques crues ; ziggurat monumentale tardive écartée pour Sargon.",r(8,48,64,36,L)+r(26,32,28,52,L)+p("M4 48h22M54 48h22M22 32h36M8 60h18M54 60h18M8 72h18M54 72h18")+r(34,60,12,24,E));
ajouter("dossier-secret",["0632","0065"],"Second document fermé et partiellement caché : protocole secret, sans texte.",r(16,12,54,60,P)+r(8,34,52,50,S)+p("M24 24h36M24 34h36M16 50h36M16 62h24")+c(48,76,6,O));
ajouter("acte-dechire",["0632","0065"],"Pacte rompu matérialisé par un bord brisé, sans citation écrite.",p("M8 14h54v18l-8 8l8 10l-10 10l10 12v12H8z",P)+p("M20 28h30M20 42h24M20 58h24M20 72h30"));
ajouter("dossier-judiciaire",["0632","0058"],"Dossier juridique abstrait, aucune accusation représentée comme preuve définitive.",r(16,12,54,62,P)+r(8,24,50,58,P)+p("M18 38h30M18 50h30M18 62h18")+c(48,74,7,L));
ajouter("documents-diffuses",["0632"],"Pages en diffusion publique ; séparation lisible d'un acte de signature.",r(6,8,48,62,P)+r(24,24,48,62,P)+p("M14 24h28M14 36h28M32 42h30M32 54h30M32 66h18M32 78h30"));
ajouter("banque",["0118","0632"],"Institution financière symbolique, pas reproduction d'un siège bancaire.",p("M4 28L40 8l36 20z",P)+r(8,28,64,8,L)+[14,34,54].map(x=>r(x,36,10,42,P)).join("")+r(4,78,72,8,P)+c(40,22,4,L));
ajouter("table-vide",["0016"],"Table administrative vide pour Wannsee : évoquer la bureaucratie criminelle sans spectacle ni portrait.",r(8,46,64,14,L)+p("M16 60v24M64 60v24")+r(28,32,24,14,P)+p("M34 38h12"));
ajouter("table-trois",["0016"],"Table de conférence avec trois silhouettes, sans portrait ni ressemblance de dirigeants.",[16,40,64].map(x=>c(x,18,6,P)+r(x-7,26,14,24,S,3)).join("")+`<ellipse cx="40" cy="55" rx="37" ry="12" fill="${L}"/>`+p("M16 66v18M64 66v18")+r(26,48,28,12,P));
ajouter("table-conseil",["0016","0044"],"Conseillers sous l'autorité royale : présence d'un exécutif et de ministres.",[14,38,62].map((x,i)=>c(x,20,6,P)+r(x-7,28,14,24,i===1?O:S,3)).join("")+r(4,52,72,14,L)+p("M12 66v18M68 66v18")+r(28,48,20,8,P));
ajouter("figure-executive",["0016","0623"],"Figure du pouvoir exécutif distincte de l'assemblée ; pas portrait de président ni monarchie.",c(40,18,8,P)+r(28,30,24,42,S,3)+p("M34 72v12M46 72v12M40 32l-4 10h8z",L));
ajouter("colis-immerge",["0634","0700"],"Cargaison de thé en partie immergée ; les vagues masquent le bas sans disparition d'une population.",r(10,30,54,38,L)+p("M28 30v38M46 30v38")+p("M4 68q18-8 36 0t36 0M4 80q18-8 36 0t36 0"));
ajouter("coupe-socrate",["0324","0700"],"Coupe sobre comme allusion au procès et à la mort de Socrate, sans exécution figurée.",p("M16 28h48l-6 28H22z",P)+p("M40 56v20M26 80h28")+p("M64 32q22 0 10 18H60"));
ajouter("laurier-depose",["0357"],"Laurier posé et désaxé pour l'assassinat de César ; aucune arme ni corps.",`<g transform="rotate(35 40 44)">${objets.laurier.svg}</g>`);
ajouter("dossier-constitution",["0632","0065"],"Texte fondamental distinct de la simple nomination ; pages et sceau abstraits.",r(10,12,60,68,P)+p("M20 26h40M20 38h40M20 50h24")+c(54,66,8,O)+p("M50 74l-4 10l8-4l8 4l-4-10",S));
ajouter("femme-avocate",["0006","0016"],"Robe d'avocate avec rabat clair, sans portrait de Jeanne Chauvin ou d'Olga Petit.",c(38,22,13,P)+p("M24 22q0-19 14-19q18 0 18 23l-6-2l-2-13q-10 10-24 11z",E)+p("M14 84V52q0-14 16-14h16q16 0 16 14v32z",E)+p("M30 38h16l-3 18H33z",P));
ajouter("finance-crise",["0632","0058"],"Pièces dispersées et titres financiers, sans graphique ni chiffres inventés.",r(8,12,54,52,P)+p("M18 28h32M18 40h22M18 52h30")+c(20,76,7,L)+c(40,68,7,L)+c(60,80,7,L));
// Placer garde exactement la compensation de trait du générateur validé.
export function placerPhase4(nom:string,x:number,y:number,scale=1):string {
  if (objets[nom]) return placer(nom,x,y,scale);
  const objet=objetsPhase4[nom];
  if (!objet) throw new Error(`Objet phase4 inconnu : ${nom}`);
  const svg=objet.svg.replace(/stroke-width="([\d.]+)"/g,(_,w:string)=>`stroke-width="${Number(w)/scale}"`);
  return `<g transform="translate(${x} ${y}) scale(${scale})" stroke-width="${2/scale}">${svg}</g>`;
}
export function referencesObjetPhase4(nom:string):string[] { return objets[nom] ? [objets[nom].reference] : objetsPhase4[nom]?.references ?? []; }
