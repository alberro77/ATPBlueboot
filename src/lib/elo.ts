// Espejo de private.elo_delta() en supabase/schema.sql.
// Solo se usa para previsualizar; el cálculo real lo hace la base de datos.

import type { Scope } from "./types";

export const INITIAL_ELO = 1000;
export const K_FACTOR = 32;
export const MIN_MATCHES_TO_RANK = 3;
/** Victorias seguidas a partir de las cuales un jugador está "on fire". */
export const ON_FIRE_STREAK = 3;

export function expectedScore(rating: number, opponentRating: number) {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

/** Puntos que el ganador le saca al perdedor (mínimo 1). En 2v2 se pasa el promedio de cada equipo. */
export function eloDelta(winnerElo: number, loserElo: number) {
  return Math.max(1, Math.round(K_FACTOR * (1 - expectedScore(winnerElo, loserElo))));
}

type Ratings = { elo: number; singles_elo: number; doubles_elo: number };

/**
 * AURA de un equipo en uno de los rankings: promedio de sus integrantes
 * (en 1 vs 1, el del jugador). Cada partido se calcula en el Global y en el de su modalidad.
 */
export function teamElo(players: Ratings[], scope: Scope) {
  const rating = (p: Ratings) => (scope === "singles" ? p.singles_elo : scope === "doubles" ? p.doubles_elo : p.elo);
  return players.reduce((sum, p) => sum + rating(p), 0) / players.length;
}

/**
 * Simula una serie de partidos en orden (true = ganó mi equipo) y devuelve el
 * AURA total que gana (+) o pierde (−) mi equipo. Sirve de estimación: el cálculo
 * real lo hace la base al confirmar.
 */
export function seriesDelta(myElo: number, rivalElo: number, results: boolean[]) {
  let total = 0;
  for (const won of results) {
    const d = won ? eloDelta(myElo, rivalElo) : -eloDelta(rivalElo, myElo);
    myElo += d;
    rivalElo -= d;
    total += d;
  }
  return total;
}

/** Probabilidad (0–1) de que gane quien tiene `myElo` (en 2v2, promedio del equipo). */
export function winProbability(myElo: number, rivalElo: number) {
  return expectedScore(myElo, rivalElo);
}
