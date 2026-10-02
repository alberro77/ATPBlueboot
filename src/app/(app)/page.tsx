import Link from "next/link";
import { Globe, Plus, Swords, User, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/page-header";
import { HowItWorks } from "@/components/how-it-works";
import { NotificationPrompt } from "@/components/notification-prompt";
import { MyPositionCard, OnFireStrip, SeasonLink } from "@/components/home-cards";
import { Podium, RankingTable } from "@/components/ranking-table";
import { SegmentedLinks } from "@/components/segmented";
import { getSession } from "@/lib/data";
import { MIN_MATCHES_TO_RANK, ON_FIRE_STREAK } from "@/lib/elo";
import { createClient } from "@/lib/supabase/server";
import { reignDays, type Reign } from "@/lib/format";
import { parseScope, SCOPE_LABEL, scopeParam, statsFor } from "@/lib/modes";
import type { Profile, Scope } from "@/lib/types";

const SCOPE_ICON = { global: Globe, singles: User, doubles: Users } as const;

export default async function RankingPage({ searchParams }: PageProps<"/">) {
  const scope = parseScope((await searchParams).ranking);
  const { profile } = await getSession();
  const me = profile!;
  const supabase = await createClient();

  // Aplica el decay por inactividad pendiente (idempotente; complementa al cron diario).
  await supabase.rpc("apply_inactivity_decay");

  const [{ data: openReign }, { data }] = await Promise.all([
    supabase
      .from("top_reigns")
      .select("profile_id, started_at, ended_at")
      .is("ended_at", null)
      .maybeSingle<Reign & { profile_id: string }>(),
    supabase.from("profiles").select("*"),
  ]);

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

  return (
    <>
      <NotificationPrompt />

      <div className="mb-3 flex items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">Ranking</h1>
        <HowItWorks />
      </div>

      <div className="mb-4 [&>nav]:w-full">
        <SegmentedLinks
          options={(["global", "singles", "doubles"] as Scope[]).map((sc) => {
            const param = scopeParam(sc);
            const Icon = SCOPE_ICON[sc];
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
      </div>

      <MyPositionCard me={me} ranked={ranked} scope={scope} />
      {onFire.length > 0 && <OnFireStrip players={onFire} currentUserId={me.id} scope={scope} />}
      <SeasonLink />

      <Tabs key={scope} defaultValue="oficial">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="oficial" className="px-4">
            Clasificados
          </TabsTrigger>
          <TabsTrigger value="sin-clasificar" className="px-4">
            Sin clasificar
            {unranked.length > 0 && (
              <span className="rounded-full bg-muted-foreground/15 px-1.5 text-xs tabular-nums">{unranked.length}</span>
            )}
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
              title="Nadie clasificado todavía"
              action={
                <Link href="/cargar" className={buttonVariants()}>
                  <Plus /> Cargar partido
                </Link>
              }
            >
              Se clasifica con {MIN_MATCHES_TO_RANK} partidos.
            </EmptyState>
          )}
        </TabsContent>

        <TabsContent value="sin-clasificar" className="mt-3 grid gap-3">
          {unranked.length > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">Se clasifica con {MIN_MATCHES_TO_RANK} partidos.</p>
              <RankingTable players={unranked} scope={scope} currentUserId={me.id} ranked={false} />
            </>
          ) : (
            <EmptyState icon={Users} title="Todos clasificados" />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
