import { MATCH_FIELDS, PLAYER_FIELDS } from "@/lib/data";
import { computeSeason, seasonKeyAt, seasonRange, type SeasonElo } from "@/lib/seasons";
import type { createClient } from "@/lib/supabase/server";
import type { MatchWithPlayers, PlayerSummary } from "@/lib/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const PAGE = 1000; // máximo de filas por consulta de la API de Supabase

/** Partidos confirmados jugados en [start, end), paginando de a 1000. */
async function fetchSeasonMatches(supabase: Supabase, start: string, end: string) {
  const all: MatchWithPlayers[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("matches")
      .select(MATCH_FIELDS)
      .eq("status", "confirmed")
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at")
      .order("id")
      .range(from, from + PAGE - 1);
    const rows = (data ?? []) as unknown as MatchWithPlayers[];
    all.push(...rows);
    if (rows.length < PAGE) return all;
  }
}

export async function loadSeason(supabase: Supabase, key: string) {
  const { start, end } = seasonRange(key);
  const [matches, { data: elo }, { data: players }] = await Promise.all([
    fetchSeasonMatches(supabase, start, end),
    supabase.rpc("season_elo", { p_start: start, p_end: end }),
    supabase.from("profiles").select(PLAYER_FIELDS),
  ]);
  return computeSeason(key, matches, (elo ?? []) as SeasonElo[], (players ?? []) as PlayerSummary[]);
}

/** Temporada del primer partido confirmado (o null si todavía no hubo ninguno). */
export async function firstSeasonKey(supabase: Supabase) {
  const { data } = await supabase
    .from("matches")
    .select("created_at")
    .eq("status", "confirmed")
    .order("created_at")
    .limit(1)
    .maybeSingle<{ created_at: string }>();
  return data ? seasonKeyAt(Date.parse(data.created_at)) : null;
}
