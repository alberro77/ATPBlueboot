import Link from "next/link";
import { ChevronRight, Flame, Globe, Info, Plus, Swords, Trophy, User, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/page-header";
import { PlayerAvatar } from "@/components/player-avatar";
import { NotificationPrompt } from "@/components/notification-prompt";
import { MatchesProgress, Podium, RankingTable } from "@/components/ranking-table";
import { SegmentedLinks } from "@/components/segmented";
import { StreakBadge } from "@/components/streak-badge";
import { getSession } from "@/lib/data";
import { MIN_MATCHES_TO_RANK, ON_FIRE_STREAK } from "@/lib/elo";
import { createClient } from "@/lib/supabase/server";
import { nowMs, playerHref, reignDays, type Reign } from "@/lib/format";
import { parseScope, SCOPE_LABEL, scopeParam, statsFor } from "@/lib/modes";
import { seasonKeyAt, seasonMonthName } from "@/lib/seasons";
import type { Profile, Scope } from "@/lib/types";

export default async function RankingPage({ searchParams }: PageProps<"/">) {
  const scope = parseScope((await searchParams).ranking);
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

  const { data } = await supabase.from("profiles").select("*");
  // Mismo orden que el ranking de la base: puntaje, victorias y apodo, en el ranking elegido.
  const players = ((data ?? []) as Profile[])
    .map((p) => ({ p, s: statsFor(p, scope) }))
    .sort((a, b) => b.s.elo - a.s.elo || b.s.wins - a.s.wins || a.p.nickname.localeCompare(b.p.nickname));

  const ranked = players.filter(({ s }) => s.played >= MIN_MATCHES_TO_RANK).map(({ p }) => p);
  const unranked = players
    .filter(({ s }) => s.played < MIN_MATCHES_TO_RANK)
    .sort((a, b) => b.s.played - a.s.played || b.s.elo - a.s.elo)
    .map(({ p }) => p);
  const onFire = players
    .filter(({ s }) => s.streak >= ON_FIRE_STREAK)
    .sort((a, b) => b.s.streak - a.s.streak || b.s.elo - a.s.elo)
    .map(({ p }) => p);
  const rankingName = scope === "global" ? "el ranking Global" : `el ranking de ${SCOPE_LABEL[scope]}`;

  return (
    <>
      <PageHeader title={`¡Hola, ${me.nickname}! 👋`} description="Así está la mesa hoy." />

      <NotificationPrompt />

      <div className="mb-4">
        <SegmentedLinks
          options={(["global", "singles", "doubles"] as Scope[]).map((sc) => {
            const param = scopeParam(sc);
            const Icon = sc === "global" ? Globe : sc === "singles" ? User : Users;
            return {
              href: param ? `/?ranking=${param}` : "/",
              active: sc === scope,
              label: (
                <>
                  <Icon className="size-4" /> {SCOPE_LABEL[sc]}
                </>
              ),
            };
          })}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {scope === "global"
            ? "Cuentan todos los partidos, de 1 vs 1 y de 2 vs 2."
            : scope === "singles"
              ? "Solo cuentan los partidos de 1 vs 1."
              : "Solo cuentan los partidos de 2 vs 2."}
        </p>
      </div>

      <MyPositionCard me={me} ranked={ranked} scope={scope} />
      {onFire.length > 0 && <OnFireStrip players={onFire} currentUserId={me.id} scope={scope} />}
      <SeasonLink />

      <Tabs key={scope} defaultValue="oficial">
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
                scope={scope}
                currentUserId={me.id}
                leaderDays={
                  scope === "global" && openReign?.profile_id === ranked[0].id ? reignDays([openReign]) : null
                }
              />
              {ranked.length > 3 && (
                <RankingTable players={ranked.slice(3)} scope={scope} startIndex={3} currentUserId={me.id} ranked />
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
              Todavía nadie tiene {MIN_MATCHES_TO_RANK} partidos confirmados en {rankingName}. ¡Andá a la mesa! 🏓
            </EmptyState>
          )}
        </TabsContent>

        <TabsContent value="sin-clasificar" className="mt-3 grid gap-3">
          <p className="flex items-start gap-2 rounded-xl bg-accent/60 p-3 text-sm text-accent-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Para entrar a {rankingName} hay que jugar al menos {MIN_MATCHES_TO_RANK} partidos confirmados
            {scope === "global" ? " (1 vs 1 o 2 vs 2)" : " de esa modalidad"}.
          </p>
          {unranked.length > 0 ? (
            <RankingTable players={unranked} scope={scope} currentUserId={me.id} ranked={false} />
          ) : (
            <EmptyState icon={Users}>No hay jugadores sin clasificar.</EmptyState>
          )}
        </TabsContent>
      </Tabs>
      <p className="mt-5 text-center text-xs text-muted-foreground">
        Si pasan 7 días sin jugar, se descuentan 10 puntos por semana (en cada ranking por separado).
      </p>
    </>
  );
}

function MyPositionCard({ me, ranked, scope }: { me: Profile; ranked: Profile[]; scope: Scope }) {
  const position = ranked.findIndex((p) => p.id === me.id) + 1;
  const st = statsFor(me, scope);
  return (
    <Link
      href="/perfil"
      className="bg-brand mb-5 flex items-center gap-3 rounded-2xl p-4 text-white shadow-lg shadow-primary/25 transition-transform active:scale-[0.99]"
    >
      <PlayerAvatar player={me} size={48} className="ring-2 ring-white/70" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-white/75">
          Tu posición · {SCOPE_LABEL[scope]} <StreakBadge streak={st.streak} />
        </p>
        {position > 0 ? (
          <p className="text-2xl leading-tight font-extrabold">
            #{position} <span className="text-sm font-medium text-white/75">de {ranked.length}</span>
          </p>
        ) : (
          <div>
            <p className="text-base leading-tight font-bold">Sin clasificar</p>
            <MatchesProgress played={st.played} onBrand className="mt-1" />
          </div>
        )}
      </div>
      <div className="text-right">
        <p className="text-xs font-medium text-white/75">AURA</p>
        <p className="text-2xl leading-tight font-extrabold tabular-nums">{st.elo}</p>
      </div>
    </Link>
  );
}

/** Jugadores con 3 o más victorias seguidas, de mayor a menor racha. */
function OnFireStrip({ players, currentUserId, scope }: { players: Profile[]; currentUserId: string; scope: Scope }) {
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
              <StreakBadge streak={statsFor(p, scope).streak} className="absolute -right-2 -bottom-1 ring-2 ring-orange-50 dark:ring-background" />
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
        <span className="block text-xs text-muted-foreground">¿Quién suma más AURA este mes? Mirá la tabla.</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" />
    </Link>
  );
}
