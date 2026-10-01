import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "./types";

export const PLAYER_FIELDS = "id, nickname, first_name, last_name, avatar_url, elo";

export const MATCH_FIELDS = `
  id, mode, reporter_id, reporter_partner_id, opponent_id, opponent_partner_id,
  reporter_won, reporter_score, opponent_score, winner_id, status, elo_delta, confirmed_by,
  reporter_elo_before, reporter_partner_elo_before, opponent_elo_before, opponent_partner_elo_before,
  created_at, resolved_at,
  reporter:profiles!matches_reporter_id_fkey(${PLAYER_FIELDS}),
  reporter_partner:profiles!matches_reporter_partner_id_fkey(${PLAYER_FIELDS}),
  opponent:profiles!matches_opponent_id_fkey(${PLAYER_FIELDS}),
  opponent_partner:profiles!matches_opponent_partner_id_fkey(${PLAYER_FIELDS})
`;

/** Filtro PostgREST: partidos donde el jugador participa en cualquiera de los dos equipos. */
export function involving(playerId: string) {
  return [
    `reporter_id.eq.${playerId}`,
    `reporter_partner_id.eq.${playerId}`,
    `opponent_id.eq.${playerId}`,
    `opponent_partner_id.eq.${playerId}`,
  ].join(",");
}

/** Filtro PostgREST: partidos que el jugador puede confirmar (es del equipo rival). */
export function confirmableBy(playerId: string) {
  return `opponent_id.eq.${playerId},opponent_partner_id.eq.${playerId}`;
}

/** Usuario autenticado + su perfil (null si todavía no completó el onboarding). */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<Profile>();

  return { user, profile };
});
