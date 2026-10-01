import { involving, MATCH_FIELDS } from "@/lib/data";
import { MIN_MATCHES_TO_RANK } from "@/lib/elo";
import { reignDays, type Reign } from "@/lib/format";
import type { createClient } from "@/lib/supabase/server";
import type { EloEvent, MatchWithPlayers } from "@/lib/types";
import type { EloPoint } from "@/components/elo-chart";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Todo lo que muestra un perfil: partidos confirmados, posición y días en el #1. */
export async function loadProfileData(supabase: Supabase, playerId: string) {
  const [{ data: matchData }, { data: rankedData }, { data: reignData }, { data: eventData }] = await Promise.all([
    supabase
      .from("matches")
      .select(MATCH_FIELDS)
      .eq("status", "confirmed")
      .or(involving(playerId))
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("profiles")
      .select("id")
      .gte("matches_played", MIN_MATCHES_TO_RANK)
      .order("elo", { ascending: false })
      .order("wins", { ascending: false })
      .order("nickname"),
    supabase.from("top_reigns").select("started_at, ended_at").eq("profile_id", playerId),
    supabase
      .from("elo_events")
      .select("id, kind, mode, delta, elo_after, created_at")
      .eq("profile_id", playerId)
      .order("created_at")
      .order("id")
      .limit(2000),
  ]);

  const ranked = (rankedData ?? []) as { id: string }[];
  const reigns = (reignData ?? []) as Reign[];
  return {
    matches: (matchData ?? []) as unknown as MatchWithPlayers[],
    position: ranked.findIndex((p) => p.id === playerId) + 1,
    rankedCount: ranked.length,
    daysAtTop: reignDays(reigns),
    reigningNow: reigns.some((r) => r.ended_at === null),
    eloHistory: toEloPoints((eventData ?? []) as EloEvent[]),
  };
}

/** Serie del gráfico: arranca en el ELO previo al primer cambio y sigue cada evento. */
function toEloPoints(events: EloEvent[]): EloPoint[] {
  if (events.length === 0) return [];
  const first = events[0];
  return [
    { t: first.created_at, elo: first.elo_after - first.delta, delta: 0, kind: "start", mode: null },
    ...events.map((e) => ({ t: e.created_at, elo: e.elo_after, delta: e.delta, kind: e.kind, mode: e.mode })),
  ];
}
