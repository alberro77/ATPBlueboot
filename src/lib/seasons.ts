import { perspective, teamA, teamB } from "@/components/match-views";
import { expectedScore, MIN_MATCHES_TO_RANK } from "@/lib/elo";
import type { MatchWithPlayers, PlayerSummary } from "@/lib/types";

/*
 * Temporadas: cada mes calendario (hora de Argentina, UTC-3 sin horario de
 * verano) es una temporada. El AURA no se resetea: se mide cuánto ganó o perdió
 * cada jugador en el mes. Campeón = más AURA ganada con al menos 3 partidos.
 */

/** Cookie con la última temporada cuyo resumen ya se vio en este dispositivo. */
export const SEASON_SEEN_COOKIE = "pp_season_seen";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** "2026-09" → { year: 2026, month: 9 } */
function parseKey(key: string) {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

export function isSeasonKey(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function keyOf(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Temporada (mes) de un instante, en hora de Argentina. */
export function seasonKeyAt(ms: number) {
  const ar = new Date(ms - 3 * 3_600_000);
  return keyOf(ar.getUTCFullYear(), ar.getUTCMonth() + 1);
}

export function shiftSeason(key: string, delta: number) {
  const { year, month } = parseKey(key);
  const index = year * 12 + (month - 1) + delta;
  return keyOf(Math.floor(index / 12), (index % 12) + 1);
}

/** Inicio (inclusive) y fin (exclusivo) del mes en hora de Argentina, como ISO UTC. */
export function seasonRange(key: string) {
  const start = new Date(`${key}-01T00:00:00-03:00`);
  const end = new Date(`${shiftSeason(key, 1)}-01T00:00:00-03:00`);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function seasonLabel(key: string) {
  const { year, month } = parseKey(key);
  return `${MONTHS[month - 1]} ${year}`;
}

export function seasonMonthName(key: string) {
  return MONTHS[parseKey(key).month - 1].toLowerCase();
}

export type SeasonElo = {
  profile_id: string;
  elo_start: number;
  elo_end: number;
  matches_before_end: number;
};

export type SeasonPlayer = {
  player: PlayerSummary;
  games: number;
  wins: number;
  losses: number;
  eloStart: number;
  eloEnd: number;
  change: number;
  bestStreak: number;
};

type Pair = { a: PlayerSummary; b: PlayerSummary; games: number; aWins: number };

export type SeasonSummary = {
  key: string;
  label: string;
  totalMatches: number;
  doublesMatches: number;
  standings: SeasonPlayer[];
  /** Más AURA ganada en el mes (con al menos 3 partidos). */
  champion: SeasonPlayer | null;
  /** #1 del ranking oficial al cierre del mes. */
  topAtClose: { player: PlayerSummary; elo: number } | null;
  mostActive: SeasonPlayer | null;
  bestStreak: SeasonPlayer | null;
  /** Victoria con menos probabilidad (según el AURA previa). */
  upset: { winners: PlayerSummary[]; losers: PlayerSummary[]; chance: number; date: string } | null;
  /** Par con más partidos 1 vs 1 entre sí. */
  rivalry: Pair | null;
  /** Dupla con más victorias juntos en 2 vs 2. */
  duo: { players: [PlayerSummary, PlayerSummary]; games: number; wins: number } | null;
};

function avg(values: (number | null)[]) {
  const nums = values.filter((v): v is number => v !== null);
  return nums.reduce((s, v) => s + v, 0) / nums.length;
}

export function computeSeason(
  key: string,
  matches: MatchWithPlayers[],
  elo: SeasonElo[],
  players: PlayerSummary[],
): SeasonSummary {
  const sorted = [...matches].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const byId = new Map(players.map((p) => [p.id, p]));
  const eloById = new Map(elo.map((e) => [e.profile_id, e]));

  // Estadísticas por jugador en el mes (y racha máxima dentro del mes).
  const stats = new Map<string, { games: number; wins: number; streak: number; best: number }>();
  for (const m of sorted) {
    for (const p of [...teamA(m), ...teamB(m)]) {
      const won = perspective(m, p.id).won;
      const s = stats.get(p.id) ?? { games: 0, wins: 0, streak: 0, best: 0 };
      s.games++;
      if (won) {
        s.wins++;
        s.streak++;
        s.best = Math.max(s.best, s.streak);
      } else {
        s.streak = 0;
      }
      stats.set(p.id, s);
    }
  }

  const standings: SeasonPlayer[] = [...stats.entries()]
    .map(([id, s]) => {
      const e = eloById.get(id);
      const eloStart = e?.elo_start ?? 1000;
      const eloEnd = e?.elo_end ?? eloStart;
      return {
        player: byId.get(id)!,
        games: s.games,
        wins: s.wins,
        losses: s.games - s.wins,
        eloStart,
        eloEnd,
        change: eloEnd - eloStart,
        bestStreak: s.best,
      };
    })
    .filter((p) => p.player)
    .sort((a, b) => b.change - a.change || b.wins - a.wins || a.player.nickname.localeCompare(b.player.nickname));

  const top = <T,>(list: T[], score: (x: T) => number, min = 1) =>
    list.reduce<T | null>((best, x) => (score(x) >= min && (!best || score(x) > score(best)) ? x : best), null);

  // #1 al cierre: mayor AURA entre los que tenían 3+ partidos confirmados.
  const closing = elo
    .filter((e) => e.matches_before_end >= MIN_MATCHES_TO_RANK && byId.has(e.profile_id))
    .sort((a, b) => b.elo_end - a.elo_end)[0];

  // Mayor sorpresa: el ganador con menos chances según el AURA previa del partido.
  let upset: SeasonSummary["upset"] = null;
  for (const m of sorted) {
    if (m.reporter_elo_before === null || m.opponent_elo_before === null) continue;
    const a = avg([m.reporter_elo_before, m.reporter_partner_elo_before]);
    const b = avg([m.opponent_elo_before, m.opponent_partner_elo_before]);
    const chance = m.reporter_won ? expectedScore(a, b) : expectedScore(b, a);
    if (chance < 0.5 && (!upset || chance < upset.chance)) {
      upset = {
        winners: m.reporter_won ? teamA(m) : teamB(m),
        losers: m.reporter_won ? teamB(m) : teamA(m),
        chance,
        date: m.created_at,
      };
    }
  }

  // Rivalidad (1v1) y dupla (2v2) del mes.
  const pairs = new Map<string, Pair>();
  const duos = new Map<string, { players: [PlayerSummary, PlayerSummary]; games: number; wins: number }>();
  for (const m of sorted) {
    if (m.mode === "singles") {
      const [x, y] = [m.reporter, m.opponent].sort((p, q) => p.id.localeCompare(q.id));
      const k = `${x.id}:${y.id}`;
      const pair = pairs.get(k) ?? { a: x, b: y, games: 0, aWins: 0 };
      pair.games++;
      if (m.winner_id === x.id) pair.aWins++;
      pairs.set(k, pair);
    } else {
      for (const [team, won] of [
        [teamA(m), m.reporter_won],
        [teamB(m), !m.reporter_won],
      ] as const) {
        const [x, y] = [...team].sort((p, q) => p.id.localeCompare(q.id));
        const k = `${x.id}:${y.id}`;
        const duo = duos.get(k) ?? { players: [x, y] as [PlayerSummary, PlayerSummary], games: 0, wins: 0 };
        duo.games++;
        if (won) duo.wins++;
        duos.set(k, duo);
      }
    }
  }

  return {
    key,
    label: seasonLabel(key),
    totalMatches: sorted.length,
    doublesMatches: sorted.filter((m) => m.mode === "doubles").length,
    standings,
    champion: standings.find((p) => p.games >= MIN_MATCHES_TO_RANK) ?? null,
    topAtClose: closing ? { player: byId.get(closing.profile_id)!, elo: closing.elo_end } : null,
    mostActive: top(standings, (p) => p.games),
    bestStreak: top(standings, (p) => p.bestStreak, 2),
    upset,
    rivalry: top([...pairs.values()], (p) => p.games, 2),
    duo: top([...duos.values()], (d) => d.wins * 1000 + d.games, 1000 + 2),
  };
}
