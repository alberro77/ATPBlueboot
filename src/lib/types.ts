export type Mode = "singles" | "doubles";

export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string;
  avatar_url: string | null;
  // Singles (1v1)
  elo: number;
  matches_played: number;
  wins: number;
  losses: number;
  last_match_at: string | null;
  // Dobles (2v2)
  elo_doubles: number;
  doubles_played: number;
  doubles_wins: number;
  doubles_losses: number;
  doubles_last_match_at: string | null;
  created_at: string;
};

export type PlayerSummary = Pick<
  Profile,
  "id" | "nickname" | "first_name" | "last_name" | "avatar_url" | "elo" | "elo_doubles"
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
  elo_delta: number | null;
  confirmed_by: string | null;
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
  mode: Mode;
  delta: number;
  elo_after: number;
  created_at: string;
};

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
