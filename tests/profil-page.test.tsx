import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ProfilPage from "@/app/profil/page";
import { statistiques, historique } from "./fixtures/profil";
const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  stats: vi.fn(),
  history: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/admin-packs/serveur", () => ({ accesAdministrateur: mocks.admin }));
vi.mock("@/lib/account", () => ({ getAccount: mocks.account }));
vi.mock("@/lib/profil/serveur", () => ({
  chargerHistorique: mocks.history,
  chargerStatistiques: mocks.stats,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));
vi.mock("@/app/connexion/actions", () => ({ signOut: vi.fn() }));
vi.mock("@/components/AccountForm", () => ({
  default: (props: { username: string; next: string }) => (
    <div data-form="profile" data-next={props.next}>
      {props.username}
    </div>
  ),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue(false);
  mocks.account.mockResolvedValue({
    username: "Pseudo A",
    user: { email: "a@example.test" },
  });
  mocks.stats.mockResolvedValue(statistiques);
  mocks.history.mockResolvedValue(historique);
});
const page = (searchParams: Record<string, string | string[]> = {}) =>
  ProfilPage({
    params: Promise.resolve({}),
    searchParams: Promise.resolve(searchParams),
  });
it("affiche les deux accès uniquement après autorisation serveur", async () => {
  let html = renderToStaticMarkup(await page());
  expect(html).not.toContain("Mon espace administrateur");
  expect(html).not.toContain("/admin/packs");
  mocks.admin.mockResolvedValue(true);
  html = renderToStaticMarkup(await page());
  expect(html).toContain("Mon espace administrateur");
  expect(html).toContain('href="/admin/packs"');
  expect(html).toContain('href="/admin/indicateurs"');
});
it("redirige le visiteur sans session en gardant l'onglet demandé", async () => {
  mocks.account.mockResolvedValue(null);
  await expect(page({ onglet: "statistiques" })).rejects.toThrow(
    "REDIRECT /connexion?next=%2Fprofil%3Fonglet%3Dstatistiques",
  );
  expect(mocks.stats).not.toHaveBeenCalled();
  expect(mocks.history).not.toHaveBeenCalled();
});
it("garde l’onboarding et la destination de sauvegarde accessibles avant les statistiques", async () => {
  mocks.account.mockResolvedValue({
    username: null,
    user: { email: "a@example.test" },
  });
  const html = renderToStaticMarkup(await page({ next: "/partie/sauvegarde" }));
  expect(html).toContain("Choisis ton pseudo");
  expect(html).toContain('data-next="/partie/sauvegarde"');
  expect(html).toContain("next=%2Fpartie%2Fsauvegarde");
});
it("les rubriques sont des liens accessibles et les paramètres supplémentaires ne choisissent aucun joueur", async () => {
  const element = await page({
    onglet: "statistiques",
    user_id: "B",
    next: "https://evil.example",
  });
  const html = renderToStaticMarkup(element);
  expect(html).toMatch(/aria-current="page"[^>]*>Statistiques/);
  expect(html).not.toContain("evil.example");
  expect(html).not.toContain("user_id");
});
