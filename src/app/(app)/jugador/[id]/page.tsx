import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Clock, Swords } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/page-header";
import { MyMatchRow, perspective } from "@/components/match-views";
import { computeRelations, RecordBar, RelationCards, StatsCard } from "@/components/player-stats";
import { EloChart } from "@/components/elo-chart";
import { ProfileHero } from "@/components/profile-hero";
import { WinChance } from "@/components/win-chance";
import { getSession } from "@/lib/data";
import { nowMs } from "@/lib/format";
import { loadProfileData } from "@/lib/profile-data";
import { createClient } from "@/lib/supabase/server";
import type { MatchWithPlayers, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadPlayer(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle<Profile>();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/jugador/[id]">): Promise<Metadata> {
  const player = await loadPlayer((await params).id);
  return { title: player ? player.nickname : "Jugador" };
}

export default async function PlayerPage({ params }: PageProps<"/jugador/[id]">) {
  const { id } = await params;
  const { profile } = await getSession();
  const me = profile!;
  if (id === me.id) redirect("/perfil");

  const player = await loadPlayer(id);
  if (!player) notFound();

  const supabase = await createClient();
  const data = await loadProfileData(supabase, player.id);
  const { rival, partner } = computeRelations(data.matches, player.id);
  const recent = data.matches.slice(0, 10);

  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <Link href="/" className="-mb-1 flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Ranking
      </Link>
      <ProfileHero profile={player} isMe={false} {...data} />
      <HeadToHead player={player} me={me} matches={data.matches} />
      <StatsCard profile={player} matches={data.matches} />
      <EloChart points={data.eloHistory} nowMs={nowMs()} />
      <RelationCards
        rival={rival}
        partner={partner}
        viewerId={me.id}
        emptyRival="Todavía no jugó contra nadie."
        emptyPartner="Todavía no jugó 2 vs 2."
      />

      <section className="mt-2 grid gap-3">
        <SectionTitle icon={Clock}>Últimos partidos</SectionTitle>
        {recent.length === 0 ? (
          <EmptyState>Todavía no tiene partidos confirmados.</EmptyState>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
            {recent.map((m) => (
              <MyMatchRow key={m.id} match={m} playerId={player.id} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Cara a cara entre el jugador y vos, más los partidos que jugaron juntos en 2v2. */
function HeadToHead({ player, me, matches }: { player: Profile; me: Profile; matches: MatchWithPlayers[] }) {
  const meId = me.id;
  let myWins = 0;
  let theirWins = 0;
  let together = 0;
  let togetherWins = 0;
  for (const m of matches) {
    const p = perspective(m, player.id);
    if (p.rivals.some((r) => r.id === meId)) {
      if (p.won) theirWins++;
      else myWins++;
    } else if (p.partner?.id === meId) {
      together++;
      if (p.won) togetherWins++;
    }
  }
  const played = myWins + theirWins;
  const leader = myWins === theirWins ? null : myWins > theirWins ? "Vos" : player.nickname;

  return (
    <Card className="gap-0 py-0">
      <CardContent className="grid gap-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
            <Swords className="size-3.5 text-primary" /> Cara a cara
          </span>
          <Link
            href={`/cargar?rival=${player.id}`}
            className={cn(buttonVariants({ size: "sm" }), "bg-brand rounded-full px-3")}
          >
            <Swords /> Desafiar
          </Link>
        </div>
        {played === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Todavía no jugaron entre ustedes. ¡Es hora de estrenar la rivalidad!
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center text-center">
              <div>
                <p className="text-3xl font-extrabold tabular-nums text-success">{myWins}</p>
                <p className="text-xs text-muted-foreground">Vos</p>
              </div>
              <span className="text-lg font-bold text-muted-foreground">–</span>
              <div>
                <p className="text-3xl font-extrabold tabular-nums text-destructive">{theirWins}</p>
                <p className="truncate text-xs text-muted-foreground">{player.nickname}</p>
              </div>
            </div>
            <RecordBar wins={myWins} losses={theirWins} />
            <p className="text-center text-xs text-muted-foreground">
              {played} {played === 1 ? "partido" : "partidos"} en contra ·{" "}
              {leader ? `${leader} ${leader === "Vos" ? "vas" : "va"} ganando` : "Empatados"}
            </p>
          </>
        )}
        <WinChance
          className="border-t pt-3"
          title="Si juegan hoy"
          myElo={me.elo}
          rivalElo={player.elo}
          rivalLabel={player.nickname}
        />
        {together > 0 && (
          <p className="rounded-xl bg-muted/60 px-3 py-2 text-center text-xs text-muted-foreground">
            Juntos en 2 vs 2: <b className="text-foreground">{together}</b> {together === 1 ? "partido" : "partidos"} ·{" "}
            <span className="font-semibold text-success">{togetherWins}G</span> ·{" "}
            <span className="font-semibold text-destructive">{together - togetherWins}P</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
