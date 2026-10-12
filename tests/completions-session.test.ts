// @vitest-environment jsdom
import {beforeEach,expect,it,vi} from "vitest";
vi.mock('@/lib/apprendre/catalogue',()=>({CHAPITRES:[{id:'THM-001',content_version:'legacy-v1',edition_active:'completion-v1'}]}));
import {lireProgressionSession,noterDecouvertSession,noterTestSession} from '@/lib/progression/session';
beforeEach(()=>sessionStorage.clear());
it("conserve les résultats de session historiques sans les transmettre à la complétion",()=>{
  const ancien={decouvert:true,precision:83,difficulte:'MONTH',tests:7};
  sessionStorage.setItem('histoire-progression-session',JSON.stringify({'THM-001':ancien}));
  expect(lireProgressionSession()).toEqual({});
  noterDecouvertSession('THM-001');
  expect(lireProgressionSession()['THM-001']).toMatchObject({precision:null,tests:0});
  noterTestSession('THM-001','nouveau',50,'YEAR','completion-v1');
  noterTestSession('THM-001','ancien-rejoue',80,'DAY','legacy-v1');
  expect(lireProgressionSession()['THM-001']).toMatchObject({precision:50,difficulte:'YEAR',tests:1});
  expect(JSON.parse(sessionStorage.getItem('histoire-progression-session')!)['THM-001']).toMatchObject({precision:83,difficulte:'MONTH',tests:8});
});
