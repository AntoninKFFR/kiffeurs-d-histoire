import { afterEach, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { lireCsv } from "../scripts/csv";
import { chargerCartesChapitre } from "@/lib/apprendre/cartes-serveur";
import { illustrationCarte, illustrationDediee } from "@/lib/apprendre/illustration-serveur";
import { GET } from "@/app/api/pedagogie/illustration/[cardId]/route";
import { CHAPITRES } from "@/lib/apprendre/catalogue";
import { chargerDemoPedagogie } from "@/app/demo/pedagogie/donnees";
import { generateStaticParams, default as ChapitrePage } from "@/app/apprendre/[niveau]/[chapitre]/page";

vi.mock("server-only", () => ({}));
vi.mock("node:fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("node:fs")>();
  return { ...original, readFileSync: vi.fn(original.readFileSync), existsSync: vi.fn(original.existsSync) };
});
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it("lie le contenu et son cache à l'édition demandée, sans exposer les champs privés",async()=>{
  const carte=chargerDemoPedagogie()[0].cartes[0];
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://supabase-fictif.example');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY','publique');
  const fetcher=vi.fn().mockImplementation(async()=>Response.json([{...carte,event_id:'EVT-9999',sources:['interne']}]));
  vi.stubGlobal('fetch',fetcher);
  const initial=await chargerCartesChapitre(carte.chapter_id,'legacy-v1');
  await chargerCartesChapitre(carte.chapter_id,'completion-v1');
  expect(fetcher.mock.calls.map(c=>c[0])).toEqual([
    `https://supabase-fictif.example/rest/v1/rpc/get_chapter_cards_version?p_chapter_id=${carte.chapter_id}&p_version=legacy-v1`,
    `https://supabase-fictif.example/rest/v1/rpc/get_chapter_cards_version?p_chapter_id=${carte.chapter_id}&p_version=completion-v1`,
  ]);
  expect(JSON.stringify(initial)).not.toMatch(/event_id|sources|EVT-/);
});

it("charge seulement le chapitre demandé via la RPC anonyme mise en cache et filtre les champs", async () => {
  const carte = chargerDemoPedagogie()[0].cartes[0];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase-fictif.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "cle-publique-fictive");
  const fetcher = vi.fn().mockResolvedValue(Response.json([{ ...carte, illustrationDediee: false, event_id: "EVT-9999", sources: ["interne"], image_path: "EVT-9999.svg", date_status: "EXACT" }]));
  vi.stubGlobal("fetch", fetcher);
  expect(await chargerCartesChapitre(carte.chapter_id)).toEqual([{ ...carte, illustrationDediee: true }]);
  expect(fetcher).toHaveBeenCalledExactlyOnceWith(`https://supabase-fictif.example/rest/v1/rpc/get_chapter_cards?p_chapter_id=${carte.chapter_id}`, expect.objectContaining({
    headers: { apikey: "cle-publique-fictive", "Accept-Profile": "histoire" }, next: { revalidate: 3600, tags: ["cartes-pedagogiques", `chapitre-${carte.chapter_id}`] },
  }));
});

it("calcule les 303 disponibilités dédiées côté serveur sans accepter un booléen upstream ni transmettre un lien interne", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase-fictif.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publique");
  let dediees = 0, motifs = 0;
  const canonique = lireCsv("content/pedagogie/cartes-v1.csv");
  for (const chapitre of chargerDemoPedagogie()) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(chapitre.cartes.map(c => ({ ...c, illustrationDediee: true, event_id: "EVT-9999", sources: ["interne"], image_path: "content/illustrations/EVT-9999.svg" })))));
    const cartes = await chargerCartesChapitre(chapitre.id);
    for (const c of cartes) {
      const attendue = Boolean(canonique.find(l => l.card_id === c.card_id)!.event_id);
      expect(c.illustrationDediee).toBe(attendue);
      expect(illustrationDediee(c.card_id)).toBe(attendue);
      if (c.illustrationDediee) dediees++; else motifs++;
    }
    expect(JSON.stringify(cartes)).not.toMatch(/EVT-\d|event_id|content\/illustrations|"sources"\s*:|"image_path"\s*:/);
  }
  expect({ dediees, motifs }).toEqual({ dediees: 303, motifs: 22 });
  expect(illustrationDediee("CARD-016-nazisme")).toBe(false);
  expect(illustrationDediee("EVT-0210")).toBe(false);
  expect(illustrationDediee("../../.env.local")).toBe(false);
});

it("partage la décision SVG/fallback pour un asset manquant, actif ou trop lourd", () => {
  const lecture = vi.mocked(readFileSync), original = lecture.getMockImplementation()!;
  // Charger le catalogue avant de doubler la lecture du seul SVG, sans modifier un asset.
  expect(illustrationDediee("CARD-016-verdun")).toBe(true);
  for (const contenu of ["<svg><script/></svg>", "<svg>EVT-9999</svg>", "x".repeat(8193)]) {
    lecture.mockImplementation(((fichier, ...args: unknown[]) =>
      String(fichier).endsWith("EVT-0482.svg") ? contenu : Reflect.apply(original, undefined, [fichier, ...args])) as typeof readFileSync);
    expect(illustrationDediee("CARD-016-verdun")).toBe(false);
    expect(illustrationCarte("CARD-016-verdun")).toContain('translate(56 36)');
    lecture.mockImplementation(original);
  }
  const absence = vi.mocked(existsSync), originalExiste = absence.getMockImplementation()!;
  absence.mockReturnValue(false);
  expect(illustrationDediee("CARD-016-verdun")).toBe(false);
  expect(illustrationCarte("CARD-016-verdun")).toContain('translate(56 36)');
  absence.mockImplementation(originalExiste);
});

it("ne transmet pas les erreurs Supabase et refuse une réponse d'un autre chapitre", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase-fictif.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publique");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Erreur SQL interne EVT-9999", { status: 500 })));
  await expect(chargerCartesChapitre("THM-027")).rejects.toThrow("Contenu pédagogique momentanément indisponible.");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(chargerDemoPedagogie()[0].cartes)));
  await expect(chargerCartesChapitre("THM-027")).rejects.toThrow("Contenu pédagogique momentanément indisponible.");
});

it("génère les 41 routes et traite les erreurs et les RPC vides sans donner une fausse carte", async () => {
  expect(generateStaticParams()).toEqual(CHAPITRES.map((c) => ({ niveau: c.niveauSlug, chapitre: c.slug })));
  await expect(ChapitrePage({ params: Promise.resolve({ niveau: "inconnu", chapitre: "inconnu" }), searchParams: Promise.resolve({}) })).rejects.toThrow("404");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase-fictif.example");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publique");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
  const c = CHAPITRES[0];
  await expect(ChapitrePage({ params: Promise.resolve({ niveau: c.niveauSlug, chapitre: c.slug }), searchParams: Promise.resolve({}) })).rejects.toThrow("404");
});

it("sert les 325 illustrations ou motifs sans identifiant d'événement, URL upstream ou redirection", async () => {
  const cartes = chargerDemoPedagogie().flatMap((c) => c.cartes);
  const canonique = lireCsv("content/pedagogie/cartes-v1.csv");
  let dediees = 0, motifs = 0;
  for (const carte of cartes) {
    const url = `http://localhost/api/pedagogie/illustration/${carte.card_id}`;
    const response = await GET(new Request(url), { params: Promise.resolve({ cardId: carte.card_id }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/svg+xml");
    expect(response.headers.get("cache-control")).toContain("s-maxage=");
    expect(response.headers.get("location")).toBeNull();
    expect(JSON.stringify([...response.headers])).not.toMatch(/EVT-\d|event_id|supabase|sources/);
    const svg = await response.text();
    expect(svg).not.toMatch(/EVT-\d|event_id|supabase|<script|<foreignObject|href\s*=|<!DOCTYPE/);
    const evenement = canonique.find(c => c.card_id === carte.card_id)!.event_id;
    if (evenement) {
      expect(svg).toBe(readFileSync(`content/illustrations/${evenement}.svg`, "utf8").replace(/<!--[\s\S]*?-->/g, ""));
      expect(svg).not.toContain('translate(56 36)');
      dediees++;
    } else { expect(svg).toContain('translate(56 36)'); motifs++; }
  }
  expect({ dediees, motifs }).toEqual({ dediees: 303, motifs: 22 });
  expect(illustrationCarte("CARD-024-bastille-mobilisation")).toBe(readFileSync("content/illustrations/EVT-0173.svg", "utf8").replace(/<!--[\s\S]*?-->/g, ""));
  expect(illustrationCarte("CARD-016-nazisme")).toContain('translate(56 36)');
});

it("remplace les motifs du lot pilote par les 20 SVG, pour toutes les cartes du même événement", async () => {
  const pilote = lireCsv("content/illustrations/pilote-pedagogie.csv");
  const cartes = lireCsv("content/pedagogie/cartes-v1.csv");
  expect(pilote).toHaveLength(20);
  expect(new Set(pilote.map((c) => c.card_id)).size).toBe(20);
  expect(new Set(pilote.map((c) => c.event_id)).size).toBe(20);
  for (const choix of pilote) {
    expect(cartes.find((c) => c.card_id === choix.card_id)).toMatchObject({ event_id: choix.event_id, title: choix.title });
    expect(choix.illustration_existante).toBe("non");
    expect(choix.nouveau_fichier_svg).toBe(`${choix.event_id}.svg`);
    const svg = readFileSync(`content/illustrations/${choix.nouveau_fichier_svg}`, "utf8");
    expect(svg).not.toMatch(/<text|<image|<filter|<linearGradient|<radialGradient|translate\(56 36\)/);
    for (const carte of cartes.filter((c) => c.event_id === choix.event_id)) {
      const response = await GET(new Request(`http://localhost/api/pedagogie/illustration/${carte.card_id}`), {
        params: Promise.resolve({ cardId: carte.card_id }),
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(svg);
    }
  }
});

it("refuse identifiants inconnus, entrées EVT et chemins arbitraires", async () => {
  for (const cardId of ["inconnu", "EVT-0210", "../../.env.local", "CARD-027-somme-guerre-usure/../../EVT-0210.svg"]) {
    const response = await GET(new Request("http://localhost/api/pedagogie/illustration/inconnu"), { params: Promise.resolve({ cardId }) });
    expect(response.status).toBe(404); expect(await response.text()).toBe(""); expect(response.headers.get("location")).toBeNull();
  }
});
