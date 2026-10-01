import Link from "next/link";
import { Info, Plus, Swords, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/page-header";
import { PlayerAvatar } from "@/components/player-avatar";
import { MatchesProgress, Podium, RankingTable } from "@/components/ranking-table";
import { getSession } from "@/lib/data";
import { MIN_MATCHES_TO_RANK } from "@/lib/elo";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function RankingPage() {
  const { profile } = await getSession();
  const me = profile!;
  const supabase = await createClient();

  // Aplica el decay por inactividad pendiente (idempotente; complementa al cron diario).
  await supabase.rpc("apply_inactivity_decay");

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .order("elo", { ascending: false })
    .order("wins", { ascending: false })
    .order("nickname");
  const players = (data ?? []) as Profile[];

  const ranked = players.filter((p) => p.matches_played >= MIN_MATCHES_TO_RANK);
  const unranked = players
    .filter((p) => p.matches_played < MIN_MATCHES_TO_RANK)
    .sort((a, b) => b.matches_played - a.matches_played || b.elo - a.elo);

  return (
    <>
      <PageHeader title="Ranking" description="1 vs 1 y 2 vs 2 suman al mismo ELO." />

      <MyPositionCard me={me} ranked={ranked} />

      <Tabs defaultValue="oficial">
        <TabsList className="h-10 w-full sm:w-auto">
          <TabsTrigger value="oficial" className="px-4">
            Ranking oficial
          </TabsTrigger>
          <TabsTrigger value="sin-clasificar" className="px-4">
            Sin clasificar ({unranked.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="oficial" className="mt-3">
          {ranked.length > 0 ? (
            <>
              <Podium players={ranked.slice(0, 3)} currentUserId={me.id} />
              {ranked.length > 3 && (
                <RankingTable players={ranked.slice(3)} startIndex={3} currentUserId={me.id} ranked />
              )}
            </>
          ) : (
            <EmptyState
              icon={Swords}
              title="El ranking está vacío"
              action={
                <Link href="/cargar" className={buttonVariants()}>
                  <Plus /> Cargar partido
                </Link>
              }
            >
              Todavía nadie tiene {MIN_MATCHES_TO_RANK} partidos confirmados. ¡Andá a la mesa! 🏓
            </EmptyState>
          )}
        </TabsContent>

        <TabsContent value="sin-clasificar" className="mt-3 grid gap-3">
          <p className="flex items-start gap-2 rounded-xl bg-accent/60 p-3 text-sm text-accent-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Para entrar al ranking oficial hay que jugar al menos {MIN_MATCHES_TO_RANK} partidos confirmados (1 vs 1 o 2
            vs 2).
          </p>
          {unranked.length > 0 ? (
            <RankingTable players={unranked} currentUserId={me.id} ranked={false} />
          ) : (
            <EmptyState icon={Users}>No hay jugadores sin clasificar.</EmptyState>
          )}
        </TabsContent>
      </Tabs>
      <p className="mt-5 text-center text-xs text-muted-foreground">
        Si pasan 7 días sin jugar, se descuentan 10 puntos por semana.
      </p>
    </>
  );
}

function MyPositionCard({ me, ranked }: { me: Profile; ranked: Profile[] }) {
  const position = ranked.findIndex((p) => p.id === me.id) + 1;
  return (
    <Link
      href="/perfil"
      className="bg-brand mb-5 flex items-center gap-3 rounded-2xl p-4 text-white shadow-lg shadow-primary/25 transition-transform active:scale-[0.99]"
    >
      <PlayerAvatar player={me} size={48} className="ring-2 ring-white/70" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white/75">Tu posición</p>
        {position > 0 ? (
          <p className="text-2xl leading-tight font-extrabold">
            #{position} <span className="text-sm font-medium text-white/75">de {ranked.length}</span>
          </p>
        ) : (
          <div>
            <p className="text-base leading-tight font-bold">Sin clasificar</p>
            <MatchesProgress played={me.matches_played} onBrand className="mt-1" />
          </div>
        )}
      </div>
      <div className="text-right">
        <p className="text-xs font-medium text-white/75">ELO</p>
        <p className="text-2xl leading-tight font-extrabold tabular-nums">{me.elo}</p>
      </div>
    </Link>
  );
}
