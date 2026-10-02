import type { Mode, PlayerSummary, Profile, Scope } from "./types";

export const MODE_LABEL: Record<Mode, string> = {
  singles: "1 vs 1",
  doubles: "2 vs 2",
};

export const MODE_SHORT: Record<Mode, string> = {
  singles: "1v1",
  doubles: "2v2",
};

/** Valor del query param `?modo=` en la URL. */
export function parseMode(value: string | string[] | undefined): Mode | null {
  if (value === "2v2") return "doubles";
  if (value === "1v1") return "singles";
  return null;
}

export const SCOPE_LABEL: Record<Scope, string> = {
  global: "Global",
  singles: "1 vs 1",
  doubles: "2 vs 2",
};

/** Ranking a mostrar según `?ranking=`: Global por defecto. */
export function parseScope(value: string | string[] | undefined): Scope {
  if (value === "1v1") return "singles";
  if (value === "2v2") return "doubles";
  return "global";
}

export function scopeParam(scope: Scope) {
  return scope === "singles" ? "1v1" : scope === "doubles" ? "2v2" : null;
}

export type ScopeStats = {
  elo: number;
  played: number;
  wins: number;
  losses: number;
  streak: number;
  bestStreak: number;
};

/** Puntaje, partidos, récord y rachas del jugador en uno de los tres rankings. */
export function statsFor(p: Profile, scope: Scope): ScopeStats {
  switch (scope) {
    case "singles":
      return {
        elo: p.singles_elo,
        played: p.singles_matches_played,
        wins: p.singles_wins,
        losses: p.singles_losses,
        streak: p.singles_win_streak,
        bestStreak: p.singles_best_win_streak,
      };
    case "doubles":
      return {
        elo: p.doubles_elo,
        played: p.doubles_matches_played,
        wins: p.doubles_wins,
        losses: p.doubles_losses,
        streak: p.doubles_win_streak,
        bestStreak: p.doubles_best_win_streak,
      };
    default:
      return {
        elo: p.elo,
        played: p.matches_played,
        wins: p.wins,
        losses: p.losses,
        streak: p.win_streak,
        bestStreak: p.best_win_streak,
      };
  }
}

/** Puntaje de un jugador en el ranking de una modalidad. */
export function ratingOf(p: Pick<PlayerSummary, "singles_elo" | "doubles_elo">, mode: Mode) {
  return mode === "singles" ? p.singles_elo : p.doubles_elo;
}
