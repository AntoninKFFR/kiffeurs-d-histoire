// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { ProgressionPedagogique } from "@/components/profil/ProgressionPedagogique";

vi.mock("@/lib/apprendre/catalogue", () => ({
  CHAPITRES_ACTIFS: [{ id: "THM-059", titre: "Construire l'Europe", niveauSlug: "troisieme", slug: "thm-059-sequence" }],
  CHAPITRES_HISTORIQUES: [{ id: "THM-017", titre: "Monde depuis 1945", niveauSlug: "troisieme", slug: "monde-depuis-1945" }],
  NIVEAUX: [{ slug: "troisieme", nom: "Troisième" }],
  cheminChapitre: (c: { niveauSlug: string; slug: string }) => `/apprendre/${c.niveauSlug}/${c.slug}`,
}));
afterEach(cleanup);

it("affiche le parent historique séparément sans transmettre son score ni compter sa découverte dans l'actif", () => {
  render(<ProgressionPedagogique progression={{ connecte: true, chapitres: {
    "THM-017": { decouvert: true, precision: 83, difficulte: "MONTH", tests: 7 },
  } }} />);
  expect(screen.getByText(/0 chapitre découvert sur 1 · 0 testé/)).toBeTruthy();
  const historique = screen.getByRole("region", { name: "Résultats historiques" });
  expect(within(historique).getByText(/Meilleur test : 83 % · Mois/)).toBeTruthy();
  expect(within(historique).getByRole("link").getAttribute("href")).toBe("/apprendre/troisieme/monde-depuis-1945");
  expect(screen.getAllByText("Découvert")).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Construire l'Europe" }).closest("li")?.textContent).not.toContain("Meilleur test");
});

it("compte le résultat propre de l'enfant et conserve le résultat historique du parent", () => {
  render(<ProgressionPedagogique progression={{ connecte: true, chapitres: {
    "THM-017": { decouvert: true, precision: 83, difficulte: "MONTH", tests: 7 },
    "THM-059": { decouvert: true, precision: 50, difficulte: "YEAR", tests: 1 },
  } }} />);
  expect(screen.getByText(/1 chapitre découvert sur 1 · 1 testé/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "Construire l'Europe" }).closest("li")?.textContent).toContain("Meilleur test : 50 % · Année");
  expect(within(screen.getByRole("region", { name: "Résultats historiques" })).getByText(/83 % · Mois/)).toBeTruthy();
});
