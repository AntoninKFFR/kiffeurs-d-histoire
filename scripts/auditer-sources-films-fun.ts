// Audit documentaire ponctuel, jamais lancé par la CI ni connecté à KFFR.
// Ne conserve que titre, URL et date de sortie affichés par le catalogue AFI.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { ajouts } from '../content/fun/ajouts';
const noms = ['Citizen Kane','Casablanca','Gone with the Wind','The Wizard of Oz',"Singin' in the Rain",'Psycho',
  '2001: A Space Odyssey','The Godfather','The Godfather Part II','Jaws',"One Flew Over the Cuckoo's Nest",'Rocky',
  'Taxi Driver','Apocalypse Now','Alien','Raiders of the Lost Ark','E.T.: The Extra-Terrestrial','Lawrence of Arabia',
  'Some Like It Hot','Modern Times','City Lights','The Gold Rush','The Sound of Music','West Side Story','Mary Poppins',
  'Snow White and the Seven Dwarfs','Fantasia','Pinocchio','Forrest Gump','Pulp Fiction'];
const html = readFileSync(process.argv[2], 'utf8');
const liens = [...html.matchAll(/data-href="(https:\/\/catalog\.afi\.com\/Film\/[^\"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
  .map(m=>({url:m[1],titre:m[2].replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim()}));
const autres: Record<string,string> = {Alien:'https://catalog.afi.com/Catalog/moviedetails/53908',
  'Mary Poppins':'https://catalog.afi.com/Catalog/moviedetails/23290',Pinocchio:'https://catalog.afi.com/Catalog/moviedetails/5131'};
const resultats=[];
for(let i=0;i<noms.length;i++) {
  const nom=noms[i], e=ajouts.filter(a=>a.pack_id==='COL-0114')[i];
  const lien=liens.find(l=>l.titre===`${nom} (${e.annee})`);
  const original=lien?.url??autres[nom];
  if(!original)throw new Error(`Fiche AFI absente : ${nom}`);
  const id=original.match(/\/(?:Film|moviedetails)\/(\d+)/i)![1];
  const url=`https://catalog.afi.com/Catalog/moviedetails/${id}`;
  const page=execFileSync('curl.exe',['-fsSL',url],{encoding:'utf8',maxBuffer:8_000_000});
  const date=[...page.matchAll(/href="\/Search\?searchField=ReleaseDate[^\"]*">([^<]+)<\/a>/g)].map(m=>m[1].trim());
  if(date.length!==1||!date[0].includes(String(e.annee)))throw new Error(`Date AFI ambiguë : ${nom}, ${date}`);
  resultats.push({titre_fr:e.titre,titre_original:nom,url,date_sortie:date[0],verification:'2026-10-15'});
}
writeFileSync('content/fun/sources-films-afi.json',JSON.stringify(resultats,null,2)+'\n');
console.log(resultats.map(r=>`${r.titre_original} : ${r.date_sortie}`).join('\n'));
