import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "./types";

export const PLAYER_FIELDS = "id, nickname, first_name, last_name, avatar_url, elo";

export const MATCH_FIELDS = `
  id, reporter_id, opponent_id, reporter_score, opponent_score, winner_id, status,
  reporter_elo_before, opponent_elo_before, elo_delta, created_at, resolved_at,
  reporter:profiles!matches_reporter_id_fkey(${PLAYER_FIELDS}),
  opponent:profiles!matches_opponent_id_fkey(${PLAYER_FIELDS})
`;

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
