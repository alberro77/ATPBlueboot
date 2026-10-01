import Link from "next/link";
import { ChevronRight, Flame, Info, Plus, Swords, Trophy, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/page-header";
import { PlayerAvatar } from "@/components/player-avatar";
import { NotificationPrompt } from "@/components/notification-prompt";
import { MatchesProgress, Podium, RankingTable } from "@/components/ranking-table";
import { StreakBadge } from "@/components/streak-badge";
import { getSession } from "@/lib/data";
import { MIN_MATCHES_TO_RANK, ON_FIRE_STREAK } from "@/lib/elo";
import { createClient } from "@/lib/supabase/server";
import { nowMs, playerHref, reignDays, type Reign } from "@/lib/format";
import { seasonKeyAt, seasonMonthName } from "@/lib/seasons";
import type { Profile } from "@/lib/types";

export default async function RankingPage() {
  const { profile } = await getSession();
  const me = profile!;
  const supabase = await createClient();

  // Aplica el decay por inactividad pendiente (idempotente; complementa al cron diario).
  await supabase.rpc("apply_inactivity_decay");

  const { data: openReign } = await supabase
    .from("top_reigns")
    .select("profile_id, started_at, ended_at")
    .is("ended_at", null)
    .maybeSingle<Reign & { profile_id: string }>();

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
  const onFire = players
    .filter((p) => p.win_streak >= ON_FIRE_STREAK)
    .sort((a, b) => b.win_streak - a.win_streak || b.elo - a.elo);

  return (
    <>
      <PageHeader title={`¡Hola, ${me.nickname}! 👋`} description="Así está la mesa hoy. 1 vs 1 y 2 vs 2 suman al mismo ELO." />

      <NotificationPrompt />
      <MyPositionCard me={me} ranked={ranked} />
      {onFire.length > 0 && <OnFireStrip players={onFire} currentUserId={me.id} />}
      <SeasonLink />

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
              <Podium
                players={ranked.slice(0, 3)}
                currentUserId={me.id}
                leaderDays={openReign?.profile_id === ranked[0].id ? reignDays([openReign]) : null}
              />
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
        <p className="flex items-center gap-1.5 text-xs font-medium text-white/75">
          Tu posición <StreakBadge streak={me.win_streak} />
        </p>
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

/** Jugadores con 3 o más victorias seguidas, de mayor a menor racha. */
function OnFireStrip({ players, currentUserId }: { players: Profile[]; currentUserId: string }) {
  return (
    <section className="mb-5 rounded-2xl border border-orange-300/50 bg-linear-to-br from-orange-50 to-amber-50 p-4 dark:border-orange-500/25 dark:from-orange-500/10 dark:to-amber-500/5">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-extrabold text-orange-600 dark:text-orange-400">
        <Flame className="size-4 fill-orange-400" /> On fire
        <span className="font-medium text-orange-600/70 dark:text-orange-400/70">· victorias seguidas</span>
      </h2>
      <ul className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-1">
        {players.map((p) => (
          <li key={p.id} className="shrink-0">
            <Link prefetch={false}
              href={playerHref(p.id, currentUserId)}
              className="flex w-16 flex-col items-center gap-1.5 text-center transition-transform active:scale-95"
            >
            <div className="relative">
              <PlayerAvatar player={p} size={52} className="ring-2 ring-orange-400" />
              <StreakBadge streak={p.win_streak} className="absolute -right-2 -bottom-1 ring-2 ring-orange-50 dark:ring-background" />
            </div>
            <span className="w-full truncate text-xs font-semibold">
              {p.id === currentUserId ? "Vos" : p.nickname}
            </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Acceso a la temporada (mes) en curso. */
function SeasonLink() {
  const key = seasonKeyAt(nowMs());
  return (
    <Link prefetch={false}
      href={`/temporadas/${key}`}
      className="mb-5 flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm transition-all hover:border-primary/40 active:scale-[0.99]"
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300">
        <Trophy className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">Temporada de {seasonMonthName(key)}</span>
        <span className="block text-xs text-muted-foreground">¿Quién suma más ELO este mes? Mirá la tabla.</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" />
    </Link>
  );
}
