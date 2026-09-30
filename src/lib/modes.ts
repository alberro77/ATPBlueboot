import type { Mode, Profile } from "./types";

export const MODE_LABEL: Record<Mode, string> = {
  singles: "Singles (1v1)",
  doubles: "Dobles (2v2)",
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

export type ModeStats = { elo: number; played: number; wins: number; losses: number };

export function statsFor(p: Profile, mode: Mode): ModeStats {
  return mode === "singles"
    ? { elo: p.elo, played: p.matches_played, wins: p.wins, losses: p.losses }
    : { elo: p.elo_doubles, played: p.doubles_played, wins: p.doubles_wins, losses: p.doubles_losses };
}
