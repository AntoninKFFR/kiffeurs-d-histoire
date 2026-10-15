// Métadonnées éditoriales uniquement : ne jamais importer le manifeste de réponses ici.
import packs from '../../../content/fun/packs.json';
const ids = new Set(packs.map(p => p.id));
export const estPackFun = (id: string): boolean => ids.has(id);
