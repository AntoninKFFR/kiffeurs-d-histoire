import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { claimGame, finishGame, nextQuestion, startGame, submitAnswer, submitPeriodAnswer } from "@/app/solo/actions";

const gameId = "00000000-0000-0000-0000-000000000013";
const mocks = vi.hoisted(() => ({ values: new Map<string, string>(), set: vi.fn(), remove: vi.fn(), rpc: vi.fn(), schema: vi.fn(), account: vi.fn() }));
// Les appels de mesure (#26, kpi_*) sont vérifiés à part.
const gameCalls = () => mocks.rpc.mock.calls.filter(([name]) => name !== "purge_expired_anonymous_games" && !String(name).startsWith("kpi_"));
const soloCookies = () => mocks.set.mock.calls.filter(([name]) => String(name).startsWith("histoire-solo-"));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: (name: string) => mocks.values.has(name) ? { value: mocks.values.get(name) } : undefined,
  set: mocks.set,
  delete: mocks.remove,
}) }));
vi.mock("@/lib/account", () => ({ getAccount: mocks.account }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ schema: mocks.schema }) }));

beforeEach(() => {
  mocks.values.clear();
  mocks.account.mockReset().mockResolvedValue({ user: { id: "verified" }, username: "KFFR" });
  mocks.remove.mockReset().mockImplementation(name => mocks.values.delete(name));
  mocks.rpc.mockReset();
  mocks.schema.mockReset().mockReturnValue({ rpc: mocks.rpc });
  mocks.set.mockReset().mockImplementation((name: string, value: string) => mocks.values.set(name, value));
});

it("claim utilise uniquement le cookie serveur puis supprime ce seul cookie", async () => {
  mocks.values.set(`histoire-solo-${gameId}`, "test-secret");
  mocks.values.set("other-cookie", "other");
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  expect(await claimGame(gameId)).toEqual({ saved: true });
  expect(mocks.rpc).toHaveBeenLastCalledWith("claim_anonymous_game", { p_game_id: gameId, p_token: "test-secret" });
  expect(mocks.remove).toHaveBeenCalledExactlyOnceWith(`histoire-solo-${gameId}`);
  expect(mocks.values.get("other-cookie")).toBe("other");
});
it("sans session/pseudo/cookie le claim ne contacte jamais la RPC", async () => {
  mocks.account.mockResolvedValueOnce(null).mockResolvedValueOnce({ username: null });
  expect((await claimGame(gameId)).saved).toBe(false);
  expect((await claimGame(gameId)).saved).toBe(false);
  expect((await claimGame(gameId)).saved).toBe(false);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("un compte sans pseudo doit compléter son profil avant une nouvelle partie connectée", async () => {
  mocks.account.mockResolvedValue({ user: { id: "verified" }, username: null });
  await expect(startGame()).rejects.toThrow("Choisis ton pseudo KFFR");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("un claim refusé garde le cookie et masque les détails SQL", async () => {
  mocks.values.set(`histoire-solo-${gameId}`, "test-secret");
  mocks.rpc.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { code: "42501", message: "private hash" } });
  expect(JSON.stringify(await claimGame(gameId))).not.toMatch(/private hash|test-secret/);
  expect(mocks.remove).not.toHaveBeenCalled();
});
afterEach(() => vi.unstubAllEnvs());
it.each(["date","inverse","mystere"])("Expert conserve son filtre au lancement %s", async (mode) => {
  mocks.rpc.mockResolvedValue({data:{game_id:gameId,question_count:5,anonymous:false},error:null});
  await startGame({expertOnly:true,niveau:3,difficulty:"DAY",direction:mode==="inverse"?"inverse":"date",questionCount:5,mystery:mode==="mystere"});
  expect(gameCalls()).toHaveLength(1);
  expect(gameCalls()[0]).toEqual([mode==="mystere"?"start_mystery_game":"start_game",expect.objectContaining({p_expert_only:true,p_niveau:3,p_periodes:mode!=="inverse",p_question_count:5})]);
});
it("refuse Expert avec un autre niveau ou un test pédagogique avant toute RPC", async () => {
  await expect(startGame({expertOnly:true,niveau:2})).rejects.toThrow("Expert invalide");
  await expect(startGame({expertOnly:true,niveau:3,chapterTest:true,chapterIds:["CH"]})).rejects.toThrow("Expert invalide");
  expect(gameCalls()).toHaveLength(0);
});

it.each([5, 10, 20, 100, 0])("transmet la longueur %s sans la recalculer, y compris Tout", async (n) => {
  mocks.rpc.mockResolvedValue({ data: { game_id: gameId, question_count: n || 100, anonymous: false }, error: null });
  const resultat = await startGame({ questionCount: n, direction: "inverse", niveau: 2 });
  expect(gameCalls()[0][1]).toMatchObject({ p_question_count: n, p_direction: "inverse", p_niveau: 2 });
  expect(resultat.question_count).toBe(n || 100);
});

it("une roulette ou sa relance n'ajoute qu'une RPC métier et garde le secret serveur", async () => {
  const winner = { mode: "pack", id: "M95-PACK", titre: "Le gagnant" };
  const game = { game_id: gameId, question_count: 20, anonymous: true,
    mystery: { winner, candidates: [winner] } };
  mocks.rpc.mockResolvedValue({ data: game, error: null });
  expect(await startGame({ mystery: true, niveau: 2, direction: "inverse", difficulty: "DAY",
    questionCount: 20, packId: winner.id })).toEqual(game);
  expect(gameCalls()).toHaveLength(1);
  expect(gameCalls()[0]).toEqual(["start_mystery_game", { p_token: expect.stringMatching(/^[a-f0-9]{64}$/),
    p_niveau: 2, p_difficulty: "DAY", p_direction: "inverse", p_question_count: 20, p_pack_id: winner.id, p_tag_id: null }]);
  expect(soloCookies()[0][2]).toMatchObject({ httpOnly: true, sameSite: "strict" });
  expect(JSON.stringify(game)).not.toContain(gameCalls()[0][1].p_token);
});

it("génère un secret distinct pour chaque partie et le garde en cookie httpOnly de session", async () => {
  vi.stubEnv("NODE_ENV", "production");
  const game = { game_id: gameId, anonymous: true, question_count: 10, difficulty: "YEAR", state: "playing" };
  mocks.rpc.mockResolvedValue({ data: game, error: null });
  expect(await startGame()).toEqual(game);
  const token = gameCalls()[0][1].p_token;
  expect(token).toMatch(/^[a-f0-9]{64}$/);
  expect(mocks.schema).toHaveBeenCalledWith("histoire");
  expect(mocks.set).toHaveBeenCalledWith(`histoire-solo-${gameId}`, token,
    { httpOnly: true, secure: true, sameSite: "strict", path: "/" });
  expect(JSON.stringify(game)).not.toContain(token);
  await startGame();
  expect(gameCalls()[1][1].p_token).not.toBe(token);
});

it("transmet les filtres sans calcul métier et utilise les cookies pour les RPC suivantes", async () => {
  vi.stubEnv("NODE_ENV", "development");
  mocks.rpc.mockResolvedValue({ data: { game_id: gameId, anonymous: true }, error: null });
  await startGame({ packId: "PACK", tagId: "TAG", yearMin: -800, yearMax: 2000,
    levelId: "3e", chapterIds: ["CHAPTER"], difficulty: "DAY", questionCount: 20 });
  const token = mocks.values.get(`histoire-solo-${gameId}`);
  expect(gameCalls()[0]).toEqual(["start_game", {
    p_token: token, p_pack_id: "PACK", p_tag_id: "TAG", p_year_min: -800, p_year_max: 2000,
    p_level_id: "3e", p_chapter_ids: ["CHAPTER"], p_difficulty: "DAY", p_question_count: 20, p_direction: "date",
    p_periodes: true,
  }]);
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  expect(await nextQuestion(gameId)).toBeNull();
  expect(mocks.rpc).toHaveBeenLastCalledWith("next_question", { p_game_id: gameId, p_token: token });
  await submitAnswer(gameId, "question", { year: -44, month: 3, day: 15 });
  expect(mocks.rpc).toHaveBeenLastCalledWith("submit_answer", { p_game_id: gameId, p_question_id: "question", p_token: token, p_year: -44, p_month: 3, p_day: 15, p_answer_text: null });
  await submitAnswer(gameId, "question", null);
  expect(mocks.rpc).toHaveBeenLastCalledWith("submit_answer", { p_game_id: gameId, p_question_id: "question", p_token: token, p_year: null, p_month: null, p_day: null, p_answer_text: null });
  await finishGame(gameId);
  expect(mocks.rpc).toHaveBeenLastCalledWith("finish_game", { p_game_id: gameId, p_token: token });
  expect(mocks.rpc.mock.calls.map(([name]) => name).filter((name) => !name.startsWith("kpi_"))).toEqual([
    "purge_expired_anonymous_games", "start_game", "purge_expired_anonymous_games", "next_question",
    "purge_expired_anonymous_games", "submit_answer", "purge_expired_anonymous_games", "submit_answer",
    "purge_expired_anonymous_games", "finish_game",
  ]);
});

it("questions période : option transmise en jeu de dates seulement, deux dates à la correction", async () => {
  mocks.rpc.mockResolvedValue({ data: { game_id: gameId, anonymous: false }, error: null });
  await startGame({ periods: false, niveau: 2 });
  expect(gameCalls()[0][1]).toMatchObject({ p_periodes: false, p_niveau: 2 });
  await startGame({ direction: "inverse", niveau: 2 });
  expect(gameCalls()[1][1]).not.toHaveProperty("p_periodes");
  await startGame({ chapterTest: true, chapterIds: ["CH"] });
  expect(gameCalls()[2][1]).not.toHaveProperty("p_periodes");
  await startGame({ mystery: true, niveau: 1 });
  expect(gameCalls()[3]).toEqual(["start_mystery_game", expect.objectContaining({ p_periodes: true })]);
  mocks.rpc.mockResolvedValue({ data: { question_id: "q", expired: false }, error: null });
  await submitPeriodAnswer(gameId, "q", { debut: { year: 1914 }, fin: { year: 1918, month: 11, day: 11 } });
  expect(mocks.rpc).toHaveBeenLastCalledWith("submit_period_answer", { p_game_id: gameId, p_question_id: "q", p_token: null,
    p_start_year: 1914, p_start_month: null, p_start_day: null, p_end_year: 1918, p_end_month: 11, p_end_day: 11 });
  await submitPeriodAnswer(gameId, "q", null);
  expect(mocks.rpc).toHaveBeenLastCalledWith("submit_period_answer", expect.objectContaining({ p_start_year: null, p_end_year: null }));
});

it("une partie connectée utilise la session Supabase sans cookie anonyme", async () => {
  mocks.rpc.mockResolvedValue({ data: { game_id: gameId, anonymous: false }, error: null });
  await startGame();
  expect(soloCookies()).toEqual([]);
  await nextQuestion(gameId);
  expect(mocks.rpc).toHaveBeenLastCalledWith("next_question", { p_game_id: gameId, p_token: null });
});

it("les erreurs SQL privées ne sont pas propagées et aucun cookie n'est créé en cas d'échec", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "expected_year=1940 secret=private" } });
  await expect(startGame()).rejects.toThrow("Impossible d'effectuer cette action de partie");
  expect(mocks.set).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "token_hash=private" } });
  await expect(finishGame(gameId)).rejects.toThrow("Partie inaccessible");
});

it("une purge réussie précède même une création refusée, sans exposer le budget SQL", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({ data: null, error: { code: "53400", message: "budget=private" } });
  await expect(startGame()).rejects.toThrow("Les parties sans compte sont temporairement indisponibles");
  expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["purge_expired_anonymous_games", "start_game"]);
  expect(mocks.rpc.mock.calls[0]).toEqual(["purge_expired_anonymous_games"]);
  expect(mocks.set).not.toHaveBeenCalled();
});

it("un identifiant arbitraire ne peut pas servir à lire un autre cookie", async () => {
  await expect(nextQuestion("sb-auth-token")).rejects.toThrow("Identifiant de partie invalide");
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("transmet le sens inverse et le texte brut au seul correcteur de partie, avec le cookie", async () => {
  mocks.rpc.mockResolvedValue({ data: { game_id: gameId, anonymous: true, direction: "inverse" }, error: null });
  await startGame({ direction: "inverse", questionCount: 1 });
  expect(gameCalls()[0][1].p_direction).toBe("inverse");
  const token = mocks.values.get(`histoire-solo-${gameId}`);
  const question = { question_id: "question", date: { year: -44, month: 3, day: 15 }, date_label: "15 mars 44 av. J.-C.", date_precision: "DAY" };
  mocks.rpc.mockResolvedValue({ data: question, error: null });
  expect(await nextQuestion(gameId)).toEqual(question);
  await submitAnswer(gameId, "question", "  LA GUÈRRE FROIDE!  ");
  expect(mocks.rpc).toHaveBeenLastCalledWith("submit_answer", {
    p_game_id: gameId, p_question_id: "question", p_token: token,
    p_year: null, p_month: null, p_day: null, p_answer_text: "  LA GUÈRRE FROIDE!  ",
  });
  expect(mocks.rpc.mock.calls.some(([name]) => name === "check_event_answer")).toBe(false);
});

it("le texte connecté utilise la session et les erreurs du correcteur restent génériques", async () => {
  mocks.rpc.mockResolvedValueOnce({ data: null, error: null })
    .mockResolvedValueOnce({ data: null, error: { code: "22023", message: "EVT-0001 titre alias secret" } });
  await expect(submitAnswer(gameId, "question", "Autre événement")).rejects.toThrow("Impossible d'effectuer cette action de partie");
  expect(mocks.rpc).toHaveBeenLastCalledWith("submit_answer", {
    p_game_id: gameId, p_question_id: "question", p_token: null,
    p_year: null, p_month: null, p_day: null, p_answer_text: "Autre événement",
  });
});
it("un test de chapitre passe par la fonction dédiée, sans filtre libre, et garde le cookie d'une partie anonyme", async () => {
  mocks.account.mockResolvedValue(null);
  mocks.rpc.mockResolvedValue({ data: { game_id: gameId, anonymous: true, question_count: 8 }, error: null });
  await startGame({ chapterTest: true, chapterIds: ["THM-006"], difficulty: "MONTH", questionCount: 8 });
  const [nom, args] = gameCalls()[0];
  expect(nom).toBe("start_chapter_test");
  expect(args).toMatchObject({ p_chapter_id: "THM-006", p_difficulty: "MONTH", p_question_count: 8 });
  expect(Object.keys(args)).toEqual(["p_token", "p_chapter_id", "p_difficulty", "p_question_count"]);
  expect(soloCookies()).toHaveLength(1);
  // Sans le marqueur, ou avec plusieurs chapitres, c'est le tirage habituel.
  await startGame({ chapterIds: ["THM-006"] });
  await startGame({ chapterTest: true, chapterIds: ["THM-006", "THM-001"] });
  expect(gameCalls().slice(1).map(([n]) => n)).toEqual(["start_game", "start_game"]);
});

it("indicateurs : un visiteur anonyme durable par navigateur, rattaché à chaque partie", async () => {
  mocks.rpc.mockResolvedValue({ data: { game_id: gameId, anonymous: true }, error: null });
  await startGame();
  const visiteur = mocks.values.get("histoire-visiteur");
  expect(visiteur).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  expect(mocks.set).toHaveBeenCalledWith("histoire-visiteur", visiteur, expect.objectContaining({ httpOnly: true, maxAge: 60 * 60 * 24 * 395 }));
  const token = mocks.values.get(`histoire-solo-${gameId}`);
  expect(mocks.rpc).toHaveBeenCalledWith("kpi_noter_visiteur", { p_game_id: gameId, p_visitor: visiteur, p_token: token });
  mocks.set.mockClear();
  await startGame();
  expect(mocks.set.mock.calls.some(([name]) => name === "histoire-visiteur")).toBe(false);
  expect(mocks.rpc).toHaveBeenLastCalledWith("kpi_noter_visiteur", expect.objectContaining({ p_visitor: visiteur }));
});

it("indicateurs : la méthode de saisie est notée après une réponse datée, jamais après une expiration", async () => {
  mocks.values.set(`histoire-solo-${gameId}`, "secret");
  mocks.rpc.mockResolvedValue({ data: { question_id: "question", expired: false }, error: null });
  await submitAnswer(gameId, "question", { year: 1789 }, "frise");
  expect(mocks.rpc).toHaveBeenLastCalledWith("kpi_noter_saisie", { p_game_id: gameId, p_question_id: "question", p_method: "frise", p_token: "secret" });
  mocks.rpc.mockClear();
  await submitAnswer(gameId, "question", null, "clavier");
  await submitAnswer(gameId, "question", "Texte inversé", "clavier");
  await submitAnswer(gameId, "question", { year: 1789 });
  expect(mocks.rpc.mock.calls.some(([name]) => name === "kpi_noter_saisie")).toBe(false);
});

it("indicateurs : une mesure en échec n'empêche ni de lancer ni de répondre", async () => {
  mocks.rpc.mockImplementation(async (name: string) => name.startsWith("kpi_")
    ? Promise.reject(new Error("réseau"))
    : { data: { game_id: gameId, anonymous: false, question_id: "question", expired: false }, error: null });
  await expect(startGame()).resolves.toMatchObject({ game_id: gameId });
  await expect(submitAnswer(gameId, "question", { year: 1789 }, "clavier")).resolves.toMatchObject({ question_id: "question" });
});
