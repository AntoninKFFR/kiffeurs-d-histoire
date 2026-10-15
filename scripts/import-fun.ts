// Réservations avant toute écriture d'un futur dataset ; aucune réponse dans le code client.
import packs from '../content/fun/packs.json';
import manifeste from '../content/fun/manifeste.json';
export function verifierReservationsFun(collections: {collection_id:string;slug:string}[], evenements: {event_id:string}[]) {
  const ids=new Set(packs.map(p=>p.id)),slugs=new Set(packs.map(p=>p.slug));
  const nouveaux=new Set(manifeste.events.filter(e=>e.nouveau).map(e=>e.id));
  if(collections.some(p=>ids.has(p.collection_id)||slugs.has(p.slug))||evenements.some(e=>nouveaux.has(e.event_id))) {
    throw new Error('Identifiants réservés aux packs fun : relire le manifeste et préparer une migration avant cet import.');
  }
}
