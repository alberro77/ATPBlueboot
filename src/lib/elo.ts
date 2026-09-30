// Espejo de la lógica de confirm_match() en supabase/schema.sql.
// Solo se usa para previsualizar; el cálculo real lo hace la base de datos.

export const INITIAL_ELO = 1000;
export const K_FACTOR = 32;
export const MIN_MATCHES_TO_RANK = 3;

export function expectedScore(rating: number, opponentRating: number) {
  return 1 / (1 + Math.pow(10, (opponentRating - rating) / 400));
}

/** Puntos que el ganador le saca al perdedor. */
export function eloDelta(winnerElo: number, loserElo: number) {
  return Math.round(K_FACTOR * (1 - expectedScore(winnerElo, loserElo)));
}
