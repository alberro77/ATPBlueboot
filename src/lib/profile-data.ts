import { involving, MATCH_FIELDS } from "@/lib/data";
import { MIN_MATCHES_TO_RANK } from "@/lib/elo";
import { reignDays, type Reign } from "@/lib/format";
import { statsFor } from "@/lib/modes";
import type { createClient } from "@/lib/supabase/server";
import type { EloEvent, MatchWithPlayers, Profile, Scope } from "@/lib/types";
import type { EloPoint } from "@/components/elo-chart";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Todo lo que muestra un perfil: partidos confirmados, posición y días en el #1. */
export async function loadProfileData(supabase: Supabase, playerId: string) {
  const [matchData, { data: rankedData }, { data: reignData }, { data: eventData }] = await Promise.all([
    fetchAllConfirmed(supabase, playerId),
    supabase.from("profiles").select("*"),
    supabase.from("top_reigns").select("started_at, ended_at").eq("profile_id", playerId),
    supabase
      .from("elo_events")
      .select("id, kind, mode, delta, elo_after, created_at")
      .eq("profile_id", playerId)
      .eq("scope", "global")
      .order("created_at")
      .order("id")
      .limit(2000),
  ]);

  const reigns = (reignData ?? []) as Reign[];
  return {
    matches: matchData,
    ranks: ranksOf((rankedData ?? []) as Profile[], playerId),
    daysAtTop: reignDays(reigns),
    reigningNow: reigns.some((r) => r.ended_at === null),
    eloHistory: toEloPoints((eventData ?? []) as EloEvent[]),
  };
}

/** Serie del gráfico: arranca en el AURA previa al primer cambio y sigue cada evento. */
function toEloPoints(events: EloEvent[]): EloPoint[] {
  if (events.length === 0) return [];
  const first = events[0];
  return [
    { t: first.created_at, elo: first.elo_after - first.delta, delta: 0, kind: "start", mode: null },
    ...events.map((e) => ({ t: e.created_at, elo: e.elo_after, delta: e.delta, kind: e.kind, mode: e.mode })),
  ];
}

const PAGE = 1000; // máximo de filas por consulta de la API

/** Todos los partidos confirmados del jugador, del más nuevo al más viejo. */
async function fetchAllConfirmed(supabase: Supabase, playerId: string) {
  const all: MatchWithPlayers[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from("matches")
      .select(MATCH_FIELDS)
      .eq("status", "confirmed")
      .or(involving(playerId))
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + PAGE - 1);
    const rows = (data ?? []) as unknown as MatchWithPlayers[];
    all.push(...rows);
    if (rows.length < PAGE) return all;
  }
}

export type Rank = { position: number; count: number };

/** Posición del jugador (0 = sin clasificar) y cantidad de clasificados en cada uno de los tres rankings. */
function ranksOf(players: Profile[], playerId: string): Record<Scope, Rank> {
  const rank = (scope: Scope): Rank => {
    const list = players
      .map((p) => ({ p, s: statsFor(p, scope) }))
      .filter(({ s }) => s.played >= MIN_MATCHES_TO_RANK)
      .sort((a, b) => b.s.elo - a.s.elo || b.s.wins - a.s.wins || a.p.nickname.localeCompare(b.p.nickname));
    return { position: list.findIndex(({ p }) => p.id === playerId) + 1, count: list.length };
  };
  return { global: rank("global"), singles: rank("singles"), doubles: rank("doubles") };
}
