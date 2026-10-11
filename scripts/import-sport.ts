// Les identifiants éditoriaux Sport sont hors des propriétaires synchronisés du dataset.
// Refuser une collision AVANT la première écriture, y compris pour un futur v19.
import sport from "../content/sport/packs-proposes.json";
export function verifierCollectionsSport(packs: { collection_id: string; slug: string }[]) {
  const ids = new Set(sport.packs.map((p) => p.id));
  const slugs = new Set(sport.packs.map((p) => p.slug));
  const collisions = packs.filter((p) => ids.has(p.collection_id) || slugs.has(p.slug));
  if (collisions.length) throw new Error(`Collections réservées au pack Sport : ${collisions.map((p) => p.collection_id).join(", ")}. Relire le manifeste et préparer une migration avant cet import.`);
}
