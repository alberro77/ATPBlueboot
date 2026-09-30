export type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  nickname: string;
  avatar_url: string | null;
  elo: number;
  matches_played: number;
  wins: number;
  losses: number;
  last_match_at: string | null;
  created_at: string;
};

export type PlayerSummary = Pick<
  Profile,
  "id" | "nickname" | "first_name" | "last_name" | "avatar_url" | "elo"
>;

export type MatchStatus = "pending" | "confirmed" | "rejected" | "cancelled";

export type Match = {
  id: string;
  reporter_id: string;
  opponent_id: string;
  reporter_score: number;
  opponent_score: number;
  winner_id: string;
  status: MatchStatus;
  reporter_elo_before: number | null;
  opponent_elo_before: number | null;
  elo_delta: number | null;
  created_at: string;
  resolved_at: string | null;
};

export type MatchWithPlayers = Match & {
  reporter: PlayerSummary;
  opponent: PlayerSummary;
};

export type EloEvent = {
  id: number;
  kind: "match" | "decay";
  delta: number;
  elo_after: number;
  created_at: string;
};

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
