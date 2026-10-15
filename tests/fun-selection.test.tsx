// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen,within } from '@testing-library/react';
import { afterEach,expect,it,vi } from 'vitest';
import { SelectionPacks } from '../src/components/choix/SelectionPacks';
import type { PackJouable } from '../src/lib/solo/packs';
import fun from '../content/fun/manifeste.json';
afterEach(cleanup);
const classiques: PackJouable[]=[{id:'COL-0105',titre:'Sport',description:'',parent_id:null,comptes:{YEAR:397,MONTH:29,DAY:29},b:[-790,2030]}];
const packs:PackJouable[]=[...classiques,...fun.packs.map(p=>({id:p.id,titre:p.title,description:p.description,parent_id:null,
  comptes:p.n[1] as PackJouable['comptes'],b:null}))];
it('regroupe les six packs fun avant les anciens, avec sélection clavier native',()=>{
  const choisir=vi.fn();
  render(<SelectionPacks packs={packs} ouvert={null} selection='' precision='YEAR' longueur={10} onOuvrir={vi.fn()} onChoisir={choisir}/>);
  const liste=screen.getByRole('list',{name:'Packs disponibles'});
  expect(within(liste).getAllByRole('heading').map(e=>e.textContent)).toEqual(['Pour le fun','Les autres packs']);
  expect(within(liste).getAllByRole('button')[0].textContent).toContain('Grandes premières');
  const films=screen.getByRole('button',{name:/Sorties de films cultes/});
  expect(films.hasAttribute('disabled')).toBe(false);
  fireEvent.click(films);expect(choisir).toHaveBeenCalledWith('COL-0114');
});
it('respecte les retraits et compteurs vivants, même quand un pack fun ne remplit plus dix questions',()=>{
  render(<SelectionPacks packs={packs.map(p=>p.id==='COL-0114'?{...p,comptes:{YEAR:9,MONTH:0,DAY:0}}:p)}
    ouvert={null} selection='COL-0114' precision='YEAR' longueur={10} onOuvrir={vi.fn()} onChoisir={vi.fn()}/>);
  expect(screen.getByRole('button',{name:/Sorties de films cultes/}).hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('button',{name:/Sorties de films cultes/}).getAttribute('aria-pressed')).toBe('true');
});
it('ne montre pas de rubrique vide avant migration ou quand aucun pack fun n’est actif',()=>{
  render(<SelectionPacks packs={classiques} ouvert={null} selection='' precision='YEAR' longueur={10} onOuvrir={vi.fn()} onChoisir={vi.fn()}/>);
  expect(screen.queryByText('Pour le fun')).toBeNull();
  expect(screen.getByRole('button',{name:/Sport/}).hasAttribute('disabled')).toBe(false);
});
