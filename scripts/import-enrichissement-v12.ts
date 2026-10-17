// Préflight avant le premier upsert, comme les réservations Sport et fun.
// Tout futur dataset utilisant ces identifiants demande une migration de réconciliation.
import lotA1 from '../content/enrichissement-v12/a1.json';
import lotMassif from '../content/enrichissement-v12/massif.json';
const reservesA1=new Set(lotA1.events.map(e=>e.id));
const reservesMassif=new Set(lotMassif.events.map(e=>e.id));
export function verifierReservationsEnrichissement(evenements:{event_id:string}[]){
 if(evenements.some(e=>reservesMassif.has(e.event_id))){
  throw new Error('Identifiants réservés au lot V1.2 Massif : relire le manifeste et préparer une migration avant cet import.');
 }
 if(evenements.some(e=>reservesA1.has(e.event_id))){
  throw new Error('Identifiants réservés au lot V1.2 A1 : relire le manifeste et préparer une migration avant cet import.');
 }
}
