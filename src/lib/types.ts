export type Mode = "singles" | "doubles";

/** Los tres rankings: Global (el principal), 1 vs 1 y 2 vs 2. */
export type Scope = "global" | "singles" | "doubles";

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string;
  avatar_url: string | null;
  /** Ranking Global: suman los partidos de 1v1 y de 2v2. */
  elo: number;
  matches_played: number;
  wins: number;
  losses: number;
  last_match_at: string | null;
  /** Victorias seguidas actuales y mejor racha histórica. */
  win_streak: number;
  best_win_streak: number;
  /** Ranking 1 vs 1: solo cuentan los partidos de 1 vs 1. */
  singles_elo: number;
  singles_matches_played: number;
  singles_wins: number;
  singles_losses: number;
  singles_win_streak: number;
  singles_best_win_streak: number;
  /** Ranking 2 vs 2: solo cuentan los partidos de 2 vs 2. */
  doubles_elo: number;
  doubles_matches_played: number;
  doubles_wins: number;
  doubles_losses: number;
  doubles_win_streak: number;
  doubles_best_win_streak: number;
  created_at: string;
};

export type PlayerSummary = Pick<
  Profile,
  "id" | "nickname" | "first_name" | "last_name" | "avatar_url" | "elo" | "singles_elo" | "doubles_elo"
>;

export type MatchStatus = "pending" | "confirmed" | "rejected" | "cancelled";

/** Equipo A = reporter (+ reporter_partner); equipo B = opponent (+ opponent_partner). */
export type Match = {
  id: string;
  mode: Mode;
  reporter_id: string;
  reporter_partner_id: string | null;
  opponent_id: string;
  opponent_partner_id: string | null;
  /** true si ganó el equipo A (quien cargó el partido). */
  reporter_won: boolean;
  /** Marcador: solo en partidos cargados con la versión anterior. */
  reporter_score: number | null;
  opponent_score: number | null;
  winner_id: string;
  status: MatchStatus;
  reporter_elo_before: number | null;
  reporter_partner_elo_before: number | null;
  opponent_elo_before: number | null;
  opponent_partner_elo_before: number | null;
  /** Puntos del ranking de la modalidad (1 vs 1 o 2 vs 2). */
  elo_delta: number | null;
  /** Puntos del ranking Global. */
  global_elo_delta: number | null;
  confirmed_by: string | null;
  /** Serie de partidos cargados juntos (se confirman de una vez). */
  batch_id: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type MatchWithPlayers = Match & {
  reporter: PlayerSummary;
  reporter_partner: PlayerSummary | null;
  opponent: PlayerSummary;
  opponent_partner: PlayerSummary | null;
};

export type EloEvent = {
  id: number;
  kind: "match" | "decay";
  /** Ranking al que pertenece el cambio. */
  scope: Scope;
  /** null en las penalizaciones por inactividad. */
  mode: Mode | null;
  delta: number;
  elo_after: number;
  created_at: string;
};

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
