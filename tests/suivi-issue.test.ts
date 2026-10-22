import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";

// Exécuter le script réellement livré à actions/github-script, avec une API GitHub simulée.
// Reproduction : npx vitest run tests/suivi-issue.test.ts
const workflow = readFileSync(".github/workflows/suivi-issue.yml", "utf8");
const bloc = workflow.split(/ {10}script: \|\r?\n/)[1];
if (!bloc) throw new Error("Script du workflow introuvable");
const script = bloc.replace(/^ {12}/gm, "");
const executer = new Function("github", "context", "core", `return (async () => {${script}})();`);

type Issue = { title: string; body: string };
type Modification = { issue_number: number; title?: string; body?: string };

async function simuler(description: string | null, options: {
  labelAbsent?: boolean;
  apresEcriture?: (numero: number, issues: Map<number, Issue>) => void;
} = {}) {
  const corpsV1 = "Roadmap V1\n- [ ] 🚧 #12 🤖 Étape V1\n- [ ] #13 Autre étape\n";
  const corpsV11 = "Roadmap V1.1\n- [ ] 🚧 #85 🤖 Étape V1.1\n- [ ] #86 Autre étape\n";
  const corpsV13 = "Roadmap V1.3\n- [ ] 🚧 #133 🤖 Étape V1.3\n- [ ] #134 Autre étape\n";
  const issues = new Map<number, Issue>([
    [31, { title: "🚧 Roadmap V1", body: corpsV1 }],
    [98, { title: "🚧 Roadmap V1.1", body: corpsV11 }],
    [148, { title: "🚧 Roadmap V1.3", body: corpsV13 }],
    ...[12, 13, 85, 86, 133, 134, 999].map((numero): [number, Issue] =>
      [numero, { title: `🚧 Issue ${numero}`, body: "" }]),
  ]);
  const appels: string[] = [];
  const removeLabel = vi.fn(async ({ issue_number }: { issue_number: number }) => {
    appels.push(`label:${issue_number}`);
    if (options.labelAbsent) throw Object.assign(new Error("Label absent"), { status: 404 });
  });
  const get = vi.fn(async ({ issue_number }: { issue_number: number }) => {
    appels.push(`get:${issue_number}`);
    const issue = issues.get(issue_number);
    if (!issue) throw new Error(`Issue inattendue : #${issue_number}`);
    return { data: { ...issue } };
  });
  const update = vi.fn(async ({ issue_number, title, body }: Modification) => {
    appels.push(`update:${issue_number}`);
    const issue = issues.get(issue_number)!;
    if (title !== undefined) issue.title = title;
    if (body !== undefined) issue.body = body;
    options.apresEcriture?.(issue_number, issues);
  });
  const core = { info: vi.fn(), warning: vi.fn() };
  await executer(
    { rest: { issues: { removeLabel, get, update } } },
    { repo: { owner: "test", repo: "histoire" }, payload: { pull_request: { body: description, number: 100 } } },
    core,
  );
  const roadmapsModifiees = update.mock.calls
    .map(([modification]) => modification)
    .filter((modification) => modification.body !== undefined);
  return { issues, corpsV1, corpsV11, corpsV13, appels, removeLabel, get, update, core, roadmapsModifiees };
}

it.each([
  { numero: 12, roadmap: 31, version: "1" },
  { numero: 85, roadmap: 98, version: "1.1" },
  { numero: 133, roadmap: 148, version: "1.3" },
])("ferme #$numero uniquement dans la roadmap #$roadmap", async ({ numero, roadmap, version }) => {
  const resultat = await simuler(`Closes #${numero}`);
  expect(resultat.roadmapsModifiees.map(m => m.issue_number)).toEqual([roadmap]);
  expect(resultat.issues.get(roadmap)?.body).toContain(`- [x] #${numero} 🤖 Étape V${version} (PR #100)`);
  const corps = new Map([[31, resultat.corpsV1], [98, resultat.corpsV11], [148, resultat.corpsV13]]);
  for (const [autre, attendu] of corps) {
    if (autre !== roadmap) expect(resultat.issues.get(autre)?.body).toBe(attendu);
  }
  expect(resultat.issues.get(numero)?.title).toBe(`Issue ${numero}`);
  expect(resultat.removeLabel).toHaveBeenCalledWith({ owner: "test", repo: "histoire", issue_number: numero, name: "en cours" });
  expect(resultat.core.warning).not.toHaveBeenCalled();
});

it("avertit une seule fois pour une issue absente des deux roadmaps sans modifier leurs corps", async () => {
  const resultat = await simuler("Closes #999");
  expect(resultat.roadmapsModifiees).toEqual([]);
  expect(resultat.issues.get(31)?.body).toBe(resultat.corpsV1);
  expect(resultat.issues.get(98)?.body).toBe(resultat.corpsV11);
  expect(resultat.issues.get(148)?.body).toBe(resultat.corpsV13);
  expect(resultat.core.warning).toHaveBeenCalledExactlyOnceWith("#999 n'a pas de ligne dans les roadmaps #31, #98, #148.");
  expect(resultat.issues.get(999)?.title).toBe("Issue 999");
});

it("ignore #31 et #98 même lorsqu'une PR ferme aussi une étape", async () => {
  const resultat = await simuler("Closes #31\nCloses #98\nCloses #85");
  expect(resultat.removeLabel.mock.calls.map(([m]) => m.issue_number)).toEqual([85]);
  expect(resultat.update.mock.calls.some(([m]) => [31, 98].includes(m.issue_number) && m.title !== undefined)).toBe(false);
  expect(resultat.issues.get(31)?.title).toBe("🚧 Roadmap V1");
  expect(resultat.issues.get(98)?.title).toBe("🚧 Roadmap V1.1");
  expect(resultat.roadmapsModifiees.map(m => m.issue_number)).toEqual([98]);
  expect(resultat.core.warning).not.toHaveBeenCalled();
});

it.each(["Closes #31\nCloses #98", "PR intermédiaire sans fermeture", null])(
  "ne touche aucune issue ni roadmap sans étape visée (%s)", async (description) => {
    const resultat = await simuler(description);
    expect(resultat.get).not.toHaveBeenCalled();
    expect(resultat.removeLabel).not.toHaveBeenCalled();
    expect(resultat.update).not.toHaveBeenCalled();
    expect(resultat.core.warning).not.toHaveBeenCalled();
    expect(resultat.core.info).toHaveBeenCalledOnce();
  },
);

it("traite plusieurs issues, déduplique les fermetures et relit chaque roadmap juste avant son écriture", async () => {
  const resultat = await simuler("Closes #12\nFixes #85\nResolves #86\nCloses #85", {
    apresEcriture(numero, issues) {
      // Une modification humaine de #98 pendant le traitement de #31 doit être conservée.
      if (numero === 31) issues.get(98)!.body += "\nNote ajoutée par Antonin\n";
    },
  });
  expect(resultat.roadmapsModifiees.map(m => m.issue_number)).toEqual([31, 98]);
  expect(resultat.removeLabel.mock.calls.map(([m]) => m.issue_number)).toEqual([12, 85, 86]);
  expect(resultat.issues.get(98)?.body).toContain("- [x] #85 🤖 Étape V1.1 (PR #100)");
  expect(resultat.issues.get(98)?.body).toContain("- [x] #86 Autre étape (PR #100)");
  expect(resultat.issues.get(98)?.body).toContain("Note ajoutée par Antonin");
  for (const numero of [31, 98]) {
    const index = resultat.appels.indexOf(`update:${numero}`);
    expect(resultat.appels[index - 1]).toBe(`get:${numero}`);
  }
  expect(resultat.core.warning).not.toHaveBeenCalled();
});

it("conserve la tolérance au label absent et n'ajoute pas deux fois la référence de PR", async () => {
  const resultat = await simuler("Closes #12\nCloses #85", {
    labelAbsent: true,
    apresEcriture(numero, issues) {
      if (numero === 12) issues.get(31)!.body = "- [x] #12 🤖 Étape V1 (PR #100)\n";
    },
  });
  expect(resultat.issues.get(31)?.body).toBe("- [x] #12 🤖 Étape V1 (PR #100)\n");
  expect(resultat.roadmapsModifiees.map(m => m.issue_number)).toEqual([31, 98]);
  expect(resultat.core.warning).not.toHaveBeenCalled();
});
