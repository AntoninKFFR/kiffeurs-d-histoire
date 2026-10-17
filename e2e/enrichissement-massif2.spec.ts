import {expect,test} from '@playwright/test';
import lot from '../content/enrichissement-v12/massif2.json';
import {lireSql} from './local';
import {attendreQuestion,idPartie} from './outils';

for(const inverse of [false,true])for(const pack of [
 {id:'COL-0110',nom:'Sports mécaniques'},
 {id:'COL-0109',nom:'Cyclisme'},
 {id:'COL-0107',nom:'Tennis'},
])test(`Massif2 : vingt questions Débutant ${pack.nom}, inverse=${inverse}`,async({page})=>{
 await page.goto(inverse?'/inverse':'/solo');
 await page.getByRole('group',{name:'Niveau'}).getByRole('button',{name:/^Débutant/}).click();
 const longueurs=page.getByRole('group',{name:'Longueur de la partie'});
 await longueurs.getByRole('button',{name:/^5 questions/}).click();
 await page.getByRole('button',{name:'Pack',exact:true}).click();
 await page.getByRole('button',{name:/^Jouer tout Sport/}).click();
 await page.getByRole('button',{name:'Voir les sous-thèmes de Sport'}).click();
 await page.getByRole('button',{name:new RegExp('^'+pack.nom)}).click();
 await expect(longueurs.getByRole('button',{name:/^20 questions/})).toBeEnabled();
 await longueurs.getByRole('button',{name:/^20 questions/}).click();
 await page.getByRole('button',{name:'Jouer',exact:true}).click();
 expect(await attendreQuestion(page,1)).toBe(20);
 const jeu=idPartie(page),ids=new Set(lot.events.map(e=>e.id));
 const questions=lireSql<{event_id:string;niveau:number;precision:string;y:number;m:number;d:number}[]>(
  `select q.event_id,e.niveau,e.precision,q.expected_year y,q.expected_month m,q.expected_day d
   from histoire.game_questions q join histoire.events e on e.id=q.event_id where q.game_id='${jeu}'`);
 expect(questions).toHaveLength(20);expect(questions.every(q=>q.niveau===1)).toBe(true);
 expect(questions.some(q=>ids.has(q.event_id))).toBe(true);
 if(inverse){
  expect(questions.every(q=>q.precision==='DAY')).toBe(true);
  expect(new Set(questions.map(q=>[q.y,q.m,q.d].join('/'))).size).toBe(20);
 }
});
