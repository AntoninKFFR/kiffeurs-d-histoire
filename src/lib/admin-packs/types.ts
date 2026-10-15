export type AdminPack = {
  id: string;
  title: string;
  active: boolean;
  total: number;
  retired: number;
  playable: number;
  parent_id?: string | null;
  scope_playable?: number;
};

export type PackQuestion = {
  id: string;
  title: string;
  niveau: 1 | 2 | 3;
  date_text: string | null;
  start_year: number | null;
  start_month: number | null;
  start_day: number | null;
  end_year: number | null;
  end_month: number | null;
  end_day: number | null;
  removed: boolean;
  playable: boolean;
  last_change: {
    admin_id: string;
    occurred_at: string;
    operation: "retirer" | "remettre";
    reason: string | null;
  } | null;
};

export type PackChange = { changed: boolean; packs: AdminPack[]; questions: PackQuestion[] };
export type PackActionResult = { ok: true; data: PackChange } | { ok: false; message: string };

export type EditorialChange = {
  id: number;
  event_id: string;
  admin_id: string;
  occurred_at: string;
  old_title: string;
  new_title: string;
  old_niveau: 1 | 2 | 3;
  new_niveau: 1 | 2 | 3;
  reason: string | null;
};
export type EditorialResult = PackChange & { history: EditorialChange[] };
export type EditorialActionResult = { ok: true; data: EditorialResult } | { ok: false; message: string; conflict?: boolean };
export type HistoryActionResult = { ok: true; history: EditorialChange[] } | { ok: false; message: string };

export type SearchFilters = { query: string; niveau: number | null; yearMin: number | null; yearMax: number | null; page: number };
export type SearchQuestion = Pick<PackQuestion, "id" | "title" | "niveau" | "date_text" | "start_year" | "start_month" | "start_day" | "end_year" | "end_month" | "end_day"> & {
  associated: boolean; removed: boolean; packs: { id: string; title: string; removed: boolean }[];
};
export type SearchPage = { items: SearchQuestion[]; has_more: boolean };
export type NewEvent = {
  title: string; description: string; niveau: number; kind: "event" | "film"; territory: string;
  date_status: "EXACT" | "CONVENTIONAL" | "TRADITIONAL" | "APPROXIMATE" | "DISPUTED";
  start_year: number | null; start_month: number | null; start_day: number | null;
  end_year: number | null; end_month: number | null; end_day: number | null;
  date_text: string; sources: string[];
};
export type ContentChange = PackChange & { added: number; restored: number; event_id?: string };
export type ContentHistory = {
  creation: { admin_id: string; created_at: string; sources: string[]; territory: string | null } | null;
  operations: { id: number; admin_id: string; occurred_at: string; event_id: string; pack_id: string; operation: "creer" | "ajouter" | "reintegrer" }[];
};
export type AdminResult<T> = { ok: true; data: T } | { ok: false; message: string };
