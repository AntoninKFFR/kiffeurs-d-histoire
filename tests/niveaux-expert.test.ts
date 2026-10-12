import { expect, it } from "vitest";
import { ecrireChoix, lireChoix, filtresDepuis, relanceEnregistree, NIVEAUX, libelleNiveau, comptesDe } from "@/lib/solo/choix";
import { choixMystere, choixGagnant } from "@/lib/solo/mystere";

it.each([[1,false,"Débutant"],[2,false,"Intermédiaire"],[3,true,"Expert"],[3,false,"Toutes les questions"]] as const)("contrat distinct %s / %s : %s", (niveau, expertOnly, label) => {
  for (const inverse of [false,true]) for (const longueur of [5,10,20,"tout"] as const) {
    const c = lireChoix(new URLSearchParams(`mode=pack&pack=COL-0105&niveau=${niveau}&difficulte=YEAR&longueur=${longueur}${expertOnly ? "&expertOnly=1" : ""}${inverse ? "&sens=inverse" : ""}`))!;
    expect(libelleNiveau(c)).toBe(label);
    expect(Boolean(c.expertOnly)).toBe(expertOnly);
    expect(lireChoix(new URLSearchParams(ecrireChoix(c)))).toEqual(c);
    const filtres = filtresDepuis(c);
    expect(Boolean(filtres.expertOnly)).toBe(expertOnly);
    expect(lireChoix(new URLSearchParams(relanceEnregistree(filtres)!))).toEqual(c);
    expect(Boolean(choixMystere(c).expertOnly)).toBe(expertOnly);
    expect(Boolean(choixGagnant(c,{mode:"pack",id:"COL-0106",titre:"Football"}).expertOnly)).toBe(expertOnly);
  }
});
it("quatre cartes et quatre filtres différents, ancien niveau 3 inchangé", () => {
  expect(NIVEAUX.map(n=>n.titre)).toEqual(["Débutant","Intermédiaire","Expert","Toutes les questions"]);
  expect(new Set(NIVEAUX.map(n=>`${n.valeur}:${Boolean(n.expertOnly)}`)).size).toBe(4);
  expect(lireChoix(new URLSearchParams("mode=general&niveau=3&difficulte=YEAR"))!.expertOnly).toBeUndefined();
  expect(relanceEnregistree({niveau:3,difficulty:"YEAR",questionCount:10})).not.toContain("expertOnly");
});
it.each(["niveau=1&expertOnly=1","niveau=2&expertOnly=true","niveau=3&expertOnly=invalide"])("refuse la combinaison %s", params => {
  expect(lireChoix(new URLSearchParams(`mode=general&difficulte=YEAR&${params}`))).toBeNull();
});
it("Expert n'invente pas des décomptes statiques et n'entre pas dans le scolaire", () => {
  expect(comptesDe({mode:"pack",pack:"COL-0105",niveau:3,expertOnly:true})).toBeNull();
  expect(lireChoix(new URLSearchParams("mode=scolaire&chapitres=THM-001&difficulte=YEAR&expertOnly=1"))).toBeNull();
});
