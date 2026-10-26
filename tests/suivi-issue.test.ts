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
  const corpsV13 = "Roadmap V1.3\n- [ ] 🚧 #5 🤖 Salons en base\n- [ ] #6 🤖 Invités sans compte\n- [ ] #7 🤖 Temps réel\n";
  const issues = new Map<number, Issue>([
    [20, { title: "🚧 Roadmap V1.3", body: corpsV13 }],
    ...[5, 6, 7, 999].map((numero): [number, Issue] =>
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
  return { issues, corpsV13, appels, removeLabel, get, update, core, roadmapsModifiees };
}

it.each([
  { numero: 5, etape: "🤖 Salons en base", autre: "- [ ] #6 🤖 Invités sans compte" },
  { numero: 6, etape: "🤖 Invités sans compte", autre: "- [ ] 🚧 #5 🤖 Salons en base" },
])("ferme #$numero dans la roadmap V1.3 #20", async ({ numero, etape, autre }) => {
  const resultat = await simuler(`Closes #${numero}`);
  expect(resultat.roadmapsModifiees.map(m => m.issue_number)).toEqual([20]);
  expect(resultat.issues.get(20)?.body).toContain(`- [x] #${numero} ${etape} (PR #100)`);
  expect(resultat.issues.get(20)?.body).toContain(autre);
  expect(resultat.issues.get(numero)?.title).toBe(`Issue ${numero}`);
  expect(resultat.removeLabel).toHaveBeenCalledWith({ owner: "test", repo: "histoire", issue_number: numero, name: "en cours" });
  expect(resultat.core.warning).not.toHaveBeenCalled();
});

it("avertit une seule fois pour une issue absente de la roadmap V1.3", async () => {
  const resultat = await simuler("Closes #999");
  expect(resultat.roadmapsModifiees).toEqual([]);
  expect(resultat.issues.get(20)?.body).toBe(resultat.corpsV13);
  expect(resultat.core.warning).toHaveBeenCalledExactlyOnceWith("#999 n'a pas de ligne dans les roadmaps #20.");
  expect(resultat.issues.get(999)?.title).toBe("Issue 999");
});

it("ignore #20 même lorsqu'une PR ferme aussi une étape", async () => {
  const resultat = await simuler("Closes #20\nCloses #5");
  expect(resultat.removeLabel.mock.calls.map(([m]) => m.issue_number)).toEqual([5]);
  expect(resultat.update.mock.calls.some(([m]) => m.issue_number === 20 && m.title !== undefined)).toBe(false);
  expect(resultat.issues.get(20)?.title).toBe("🚧 Roadmap V1.3");
  expect(resultat.roadmapsModifiees.map(m => m.issue_number)).toEqual([20]);
  expect(resultat.core.warning).not.toHaveBeenCalled();
});

it.each(["Closes #20", "PR intermédiaire sans fermeture", null])(
  "ne touche aucune issue ni roadmap sans étape visée (%s)", async (description) => {
    const resultat = await simuler(description);
    expect(resultat.get).not.toHaveBeenCalled();
    expect(resultat.removeLabel).not.toHaveBeenCalled();
    expect(resultat.update).not.toHaveBeenCalled();
    expect(resultat.core.warning).not.toHaveBeenCalled();
    expect(resultat.core.info).toHaveBeenCalledOnce();
  },
);

it("traite plusieurs issues, déduplique les fermetures et relit la roadmap juste avant son écriture", async () => {
  const resultat = await simuler("Closes #5\nFixes #6\nResolves #7\nCloses #6", {
    apresEcriture(numero, issues) {
      // Une modification humaine de #20 pendant le traitement des issues doit être conservée.
      if (numero === 5) issues.get(20)!.body += "\nNote ajoutée par Antonin\n";
    },
  });
  expect(resultat.roadmapsModifiees.map(m => m.issue_number)).toEqual([20]);
  expect(resultat.removeLabel.mock.calls.map(([m]) => m.issue_number)).toEqual([5, 6, 7]);
  expect(resultat.issues.get(20)?.body).toContain("- [x] #5 🤖 Salons en base (PR #100)");
  expect(resultat.issues.get(20)?.body).toContain("- [x] #6 🤖 Invités sans compte (PR #100)");
  expect(resultat.issues.get(20)?.body).toContain("- [x] #7 🤖 Temps réel (PR #100)");
  expect(resultat.issues.get(20)?.body).toContain("Note ajoutée par Antonin");
  const index = resultat.appels.indexOf("update:20");
  expect(resultat.appels[index - 1]).toBe("get:20");
  expect(resultat.core.warning).not.toHaveBeenCalled();
});

it("tolère un label absent et ne répète pas une référence de PR", async () => {
  const resultat = await simuler("Closes #5\nCloses #6", {
    labelAbsent: true,
    apresEcriture(numero, issues) {
      if (numero === 5) {
        issues.get(20)!.body = "- [x] #5 🤖 Salons en base (PR #100)\n- [ ] #6 🤖 Invités sans compte\n";
      }
    },
  });
  expect(resultat.issues.get(20)?.body).toContain("- [x] #5 🤖 Salons en base (PR #100)");
  expect(resultat.issues.get(20)?.body?.match(/PR #100/g)).toHaveLength(2);
  expect(resultat.issues.get(20)?.body).toContain("- [x] #6 🤖 Invités sans compte (PR #100)");
  expect(resultat.roadmapsModifiees.map(m => m.issue_number)).toEqual([20]);
  expect(resultat.core.warning).not.toHaveBeenCalled();
});
