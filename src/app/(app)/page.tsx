import { Info, User, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/page-header";
import { RankingTable } from "@/components/ranking-table";
import { SegmentedLinks } from "@/components/segmented";
import { getSession } from "@/lib/data";
import { MIN_MATCHES_TO_RANK } from "@/lib/elo";
import { MODE_LABEL, parseMode, statsFor } from "@/lib/modes";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function RankingPage({ searchParams }: PageProps<"/">) {
  const mode = parseMode((await searchParams).modo) ?? "singles";
  const { user } = await getSession();
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

  return (
    <>
      <PageHeader title="Tabla de posiciones" description="Ranking ELO de la oficina." />

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

      <Tabs key={mode} defaultValue="oficial">
        <TabsList className="h-10 w-full sm:w-auto">
          <TabsTrigger value="oficial" className="px-4">
            Ranking oficial
          </TabsTrigger>
          <TabsTrigger value="sin-clasificar" className="px-4">
            Sin clasificar ({unranked.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="oficial" className="mt-2">
          {ranked.length > 0 ? (
            <RankingTable players={ranked} mode={mode} currentUserId={user!.id} ranked />
          ) : (
            <EmptyState>
              Todavía nadie tiene {MIN_MATCHES_TO_RANK} partidos confirmados en{" "}
              {mode === "singles" ? "singles" : "dobles"}. ¡Andá a la mesa! 🏓
            </EmptyState>
          )}
        </TabsContent>

        <TabsContent value="sin-clasificar" className="mt-2 grid gap-3">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Para entrar al ranking oficial de {mode === "singles" ? "singles" : "dobles"} hay que jugar al menos{" "}
            {MIN_MATCHES_TO_RANK} partidos confirmados en esa modalidad.
          </p>
          {unranked.length > 0 ? (
            <RankingTable players={unranked} mode={mode} currentUserId={user!.id} ranked={false} />
          ) : (
            <EmptyState>No hay jugadores sin clasificar.</EmptyState>
          )}
        </TabsContent>
      </Tabs>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Singles y dobles tienen ELO independiente. Inactividad: después de 7 días sin jugar en una modalidad se
        descuentan 10 puntos por semana en esa modalidad.
      </p>
    </>
  );
}
