import { Info } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, PageHeader } from "@/components/page-header";
import { RankingTable } from "@/components/ranking-table";
import { getSession } from "@/lib/data";
import { MIN_MATCHES_TO_RANK } from "@/lib/elo";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function RankingPage() {
  const { user } = await getSession();
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
      <PageHeader title="Tabla de posiciones" description="Ranking ELO de la oficina." />
      <Tabs defaultValue="oficial">
        <TabsList className="h-10 w-full sm:w-auto">
          <TabsTrigger value="oficial" className="px-4">
            Ranking oficial
          </TabsTrigger>
          <TabsTrigger value="evaluacion" className="px-4">
            En evaluación ({unranked.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="oficial" className="mt-2">
          {ranked.length > 0 ? (
            <RankingTable players={ranked} currentUserId={user!.id} ranked />
          ) : (
            <EmptyState>
              Todavía nadie tiene {MIN_MATCHES_TO_RANK} partidos confirmados. ¡Andá a la mesa! 🏓
            </EmptyState>
          )}
        </TabsContent>

        <TabsContent value="evaluacion" className="mt-2 grid gap-3">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            Para entrar al ranking oficial hay que jugar al menos {MIN_MATCHES_TO_RANK} partidos confirmados.
          </p>
          {unranked.length > 0 ? (
            <RankingTable players={unranked} currentUserId={user!.id} ranked={false} />
          ) : (
            <EmptyState>No hay jugadores en evaluación.</EmptyState>
          )}
        </TabsContent>
      </Tabs>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Inactividad: después de 14 días sin jugar se descuentan 10 puntos por semana.
      </p>
    </>
  );
}
