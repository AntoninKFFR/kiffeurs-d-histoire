import {expect,test} from '@playwright/test';
import massif from '../content/enrichissement-v12/massif.json';
import massif2 from '../content/enrichissement-v12/massif2.json';
import {lireSql} from './local';
import {attendreQuestion,idPartie} from './outils';

for(const inverse of [false,true])for(const pack of [
 {id:'COL-0105',nom:'Jouer tout Sport',n:20},
 {id:'COL-0117',nom:'Quand l’histoire dérape',n:5},
])test(`Massif : Débutant ${pack.nom}, ${pack.n} questions, inverse=${inverse}`,async({page})=>{
 await page.goto(inverse?'/inverse':'/solo');
 await page.getByRole('group',{name:'Niveau'}).getByRole('button',{name:/^Débutant/}).click();
 const longueurs=page.getByRole('group',{name:'Longueur de la partie'});
 await longueurs.getByRole('button',{name:/^5 questions/}).click();
 await page.getByRole('button',{name:'Pack',exact:true}).click();
 await page.getByRole('button',{name:new RegExp('^'+pack.nom)}).click();
 await longueurs.getByRole('button',{name:new RegExp('^'+pack.n+' questions')}).click();
 await page.getByRole('button',{name:'Jouer',exact:true}).click();
 expect(await attendreQuestion(page,1)).toBe(pack.n);
 const ids=new Set([...massif.events,...massif2.events].map(e=>e.id)),game=idPartie(page);
 const questions=lireSql<{event_id:string;niveau:number;expected_year:number;expected_month:number;expected_day:number}[]>(
  `select q.event_id,e.niveau,q.expected_year,q.expected_month,q.expected_day from histoire.game_questions q join histoire.events e on e.id=q.event_id where q.game_id='${game}'`);
 expect(questions).toHaveLength(pack.n);expect(questions.every(q=>q.niveau===1)).toBe(true);
 expect(questions.some(q=>ids.has(q.event_id))).toBe(true);
 if(inverse)expect(new Set(questions.map(q=>[q.expected_year,q.expected_month,q.expected_day].join('/'))).size).toBe(pack.n);
});
