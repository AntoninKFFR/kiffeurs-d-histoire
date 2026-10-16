// Préflight avant le premier upsert, comme les réservations Sport et fun.
// Tout futur dataset utilisant ces identifiants demande une migration de réconciliation.
import lotA1 from '../content/enrichissement-v12/a1.json';
const reservesA1=new Set(lotA1.events.map(e=>e.id));
export function verifierReservationsEnrichissement(evenements:{event_id:string}[]){
 if(evenements.some(e=>reservesA1.has(e.event_id))){
  throw new Error('Identifiants réservés au lot V1.2 A1 : relire le manifeste et préparer une migration avant cet import.');
 }
}
