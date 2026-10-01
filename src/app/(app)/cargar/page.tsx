import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getSession, involving, PLAYER_FIELDS } from "@/lib/data";
import { parseMode } from "@/lib/modes";
import { createClient } from "@/lib/supabase/server";
import type { Match, PlayerSummary } from "@/lib/types";
import { ReportMatchForm } from "./report-match-form";

export const metadata: Metadata = { title: "Cargar partido" };

type RecentMatch = Pick<Match, "reporter_id" | "reporter_partner_id" | "opponent_id" | "opponent_partner_id">;

export default async function ReportMatchPage({ searchParams }: PageProps<"/cargar">) {
  const { modo, rival } = await searchParams;
  const initialMode = parseMode(modo) ?? "singles";
  const { profile } = await getSession();
  const me = profile!;
  const supabase = await createClient();

  const [{ data: players }, { data: recentMatches }] = await Promise.all([
    supabase.from("profiles").select(PLAYER_FIELDS).neq("id", me.id).order("nickname"),
    supabase
      .from("matches")
      .select("reporter_id, reporter_partner_id, opponent_id, opponent_partner_id")
      .or(involving(me.id))
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  // Jugadores con los que jugaste últimamente (para elegirlos con un toque).
  const recentIds = [
    ...new Set(
      ((recentMatches ?? []) as RecentMatch[])
        .flatMap((m) => [m.opponent_id, m.opponent_partner_id, m.reporter_id, m.reporter_partner_id])
        .filter((id): id is string => Boolean(id) && id !== me.id),
    ),
  ].slice(0, 8);

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Cargar partido" description="¿Con quién jugaste y cómo salió?" />
      <ReportMatchForm
        me={me}
        players={(players ?? []) as PlayerSummary[]}
        recentIds={recentIds}
        initialMode={initialMode}
        initialRivalId={typeof rival === "string" ? rival : null}
      />
    </div>
  );
}
