// Espejo de private.elo_delta() en supabase/schema.sql.
// Solo se usa para previsualizar; el cálculo real lo hace la base de datos.

export const INITIAL_ELO = 1000;
export const K_FACTOR = 32;
export const MIN_MATCHES_TO_RANK = 3;

export function expectedScore(rating: number, opponentRating: number) {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

/** Puntos que el ganador le saca al perdedor (mínimo 1). En 2v2 se pasa el promedio de cada equipo. */
export function eloDelta(winnerElo: number, loserElo: number) {
  return Math.max(1, Math.round(K_FACTOR * (1 - expectedScore(winnerElo, loserElo))));
}

/** ELO de un equipo: promedio de sus integrantes (en 1v1, el del jugador). */
export function teamElo(players: { elo: number }[]) {
  return players.reduce((sum, p) => sum + p.elo, 0) / players.length;
}
