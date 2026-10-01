import type { Metadata } from "next";
import { PlayerAvatar } from "@/components/player-avatar";
import { computeRelations, RelationCards, StatsCard } from "@/components/player-stats";
import { getSession, involving, MATCH_FIELDS } from "@/lib/data";
import { MIN_MATCHES_TO_RANK } from "@/lib/elo";
import { fullName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { MatchWithPlayers } from "@/lib/types";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const { profile } = await getSession();
  const me = profile!;
  const supabase = await createClient();

  const [{ data: matchData }, { data: rankedData }] = await Promise.all([
    supabase
      .from("matches")
      .select(MATCH_FIELDS)
      .eq("status", "confirmed")
      .or(involving(me.id))
      .order("created_at", { ascending: false })
      .limit(500),
    supabase
      .from("profiles")
      .select("id")
      .gte("matches_played", MIN_MATCHES_TO_RANK)
      .order("elo", { ascending: false })
      .order("wins", { ascending: false })
      .order("nickname"),
  ]);

  const matches = (matchData ?? []) as unknown as MatchWithPlayers[];
  const ranked = (rankedData ?? []) as { id: string }[];
  const position = ranked.findIndex((p) => p.id === me.id) + 1;
  const { rival, partner } = computeRelations(matches, me.id);

  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <section className="bg-brand flex flex-col items-center gap-2 rounded-3xl px-4 pt-6 pb-5 text-center text-white shadow-lg shadow-primary/25">
        <PlayerAvatar player={me} size={88} className="ring-4 ring-white/60" />
        <div>
          <h1 className="text-2xl font-extrabold">{me.nickname}</h1>
          <p className="text-sm text-white/75">{fullName(me)}</p>
        </div>
        <div className="mt-1 flex items-center gap-6">
          <div>
            <p className="text-3xl leading-none font-extrabold tabular-nums">{me.elo}</p>
            <p className="mt-1 text-xs text-white/75">ELO</p>
          </div>
          <div className="h-9 w-px bg-white/25" />
          <div>
            <p className="text-3xl leading-none font-extrabold tabular-nums">{position > 0 ? `#${position}` : "–"}</p>
            <p className="mt-1 text-xs text-white/75">{position > 0 ? `de ${ranked.length}` : "Sin clasificar"}</p>
          </div>
        </div>
      </section>

      <StatsCard profile={me} matches={matches} />
      <RelationCards rival={rival} partner={partner} />
      <ProfileForm profile={me} />
    </div>
  );
}
