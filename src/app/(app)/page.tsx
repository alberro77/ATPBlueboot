import Link from "next/link";
import { Info, Plus, Swords, User, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/page-header";
import { PlayerAvatar } from "@/components/player-avatar";
import { MatchesProgress, Podium, RankingTable } from "@/components/ranking-table";
import { SegmentedLinks } from "@/components/segmented";
import { getSession } from "@/lib/data";
import { MIN_MATCHES_TO_RANK } from "@/lib/elo";
import { MODE_LABEL, parseMode, statsFor } from "@/lib/modes";
import { createClient } from "@/lib/supabase/server";
import type { Mode, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export default async function RankingPage({ searchParams }: PageProps<"/">) {
  const mode = parseMode((await searchParams).modo) ?? "singles";
  const { profile } = await getSession();
  const me = profile!;
  const supabase = await createClient();

  // Aplica el decay por inactividad pendiente (idempotente; complementa al cron diario).
  await supabase.rpc("apply_inactivity_decay");

  const { data } = await supabase.from("profiles").select("*");
  const players = ((data ?? []) as Profile[])
    .map((p) => ({ p, s: statsFor(p, mode) }))
    .sort((a, b) => b.s.elo - a.s.elo || b.s.wins - a.s.wins || a.p.nickname.localeCompare(b.p.nickname));

  const ranked = players.filter(({ s }) => s.played >= MIN_MATCHES_TO_RANK).map(({ p }) => p);
  const unranked = players
    .filter(({ s }) => s.played < MIN_MATCHES_TO_RANK)
    .sort((a, b) => b.s.played - a.s.played || b.s.elo - a.s.elo)
    .map(({ p }) => p);
  const modeName = mode === "singles" ? "singles" : "dobles";
  const cargarHref = mode === "doubles" ? "/cargar?modo=2v2" : "/cargar";

  return (
    <>
      <PageHeader title="Ranking" description="¿Quién manda en la mesa de BlueBoot?" />

      <div className="mb-4">
        <SegmentedLinks
          options={[
            {
              href: "/",
              label: (
                <>
                  <User className="size-4" /> {MODE_LABEL.singles}
                </>
              ),
              active: mode === "singles",
            },
            {
              href: "/?modo=2v2",
              label: (
                <>
                  <Users className="size-4" /> {MODE_LABEL.doubles}
                </>
              ),
              active: mode === "doubles",
            },
          ]}
        />
      </div>

      <MyPositionCard me={me} mode={mode} ranked={ranked} cargarHref={cargarHref} />

      <Tabs key={mode} defaultValue="oficial">
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
              <Podium players={ranked.slice(0, 3)} mode={mode} currentUserId={me.id} />
              {ranked.length > 3 && (
                <RankingTable players={ranked.slice(3)} startIndex={3} mode={mode} currentUserId={me.id} ranked />
              )}
            </>
          ) : (
            <EmptyState
              icon={Swords}
              title="El ranking está vacío"
              action={
                <Link href={cargarHref} className={buttonVariants()}>
                  <Plus /> Cargar partido
                </Link>
              }
            >
              Todavía nadie tiene {MIN_MATCHES_TO_RANK} partidos confirmados en {modeName}. ¡Andá a la mesa! 🏓
            </EmptyState>
          )}
        </TabsContent>

        <TabsContent value="sin-clasificar" className="mt-3 grid gap-3">
          <p className="flex items-start gap-2 rounded-xl bg-accent/60 p-3 text-sm text-accent-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Para entrar al ranking oficial de {modeName} hay que jugar al menos {MIN_MATCHES_TO_RANK} partidos
            confirmados en esa modalidad.
          </p>
          {unranked.length > 0 ? (
            <RankingTable players={unranked} mode={mode} currentUserId={me.id} ranked={false} />
          ) : (
            <EmptyState icon={Users}>No hay jugadores sin clasificar.</EmptyState>
          )}
        </TabsContent>
      </Tabs>
      <p className="mt-5 text-center text-xs text-muted-foreground">
        Singles y dobles tienen ELO independiente. Inactividad: después de 7 días sin jugar en una modalidad se
        descuentan 10 puntos por semana en esa modalidad.
      </p>
    </>
  );
}

function MyPositionCard({
  me,
  mode,
  ranked,
  cargarHref,
}: {
  me: Profile;
  mode: Mode;
  ranked: Profile[];
  cargarHref: string;
}) {
  const s = statsFor(me, mode);
  const position = ranked.findIndex((p) => p.id === me.id) + 1;
  return (
    <div className="bg-brand mb-5 flex items-center gap-3 rounded-2xl p-4 text-white shadow-lg shadow-primary/25">
      <PlayerAvatar player={me} size={48} className="ring-2 ring-white/70" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white/75">Tu posición en {mode === "singles" ? "1v1" : "2v2"}</p>
        {position > 0 ? (
          <p className="text-2xl leading-tight font-extrabold">
            #{position} <span className="text-sm font-medium text-white/75">de {ranked.length}</span>
          </p>
        ) : (
          <div>
            <p className="text-base leading-tight font-bold">Sin clasificar</p>
            <MatchesProgress played={s.played} onBrand className="mt-1" />
          </div>
        )}
      </div>
      <div className="text-right">
        <p className="text-xs font-medium text-white/75">ELO</p>
        <p className="text-2xl leading-tight font-extrabold tabular-nums">{s.elo}</p>
      </div>
      <Link
        href={cargarHref}
        aria-label="Cargar partido"
        className={cn(
          "hidden size-11 items-center justify-center rounded-full bg-white text-primary shadow-md transition-transform hover:scale-105 sm:flex",
        )}
      >
        <Plus className="size-5" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
