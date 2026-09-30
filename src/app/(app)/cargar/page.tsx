import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getSession, PLAYER_FIELDS } from "@/lib/data";
import { parseMode } from "@/lib/modes";
import { createClient } from "@/lib/supabase/server";
import type { PlayerSummary } from "@/lib/types";
import { ReportMatchForm } from "./report-match-form";

export const metadata: Metadata = { title: "Cargar partido" };

export default async function ReportMatchPage({ searchParams }: PageProps<"/cargar">) {
  const initialMode = parseMode((await searchParams).modo) ?? "singles";
  const { profile } = await getSession();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select(PLAYER_FIELDS)
    .neq("id", profile!.id)
    .order("nickname");

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Cargar partido"
        description="El equipo rival tiene que confirmarlo para que cuente en el ranking."
      />
      <ReportMatchForm me={profile!} players={(data ?? []) as PlayerSummary[]} initialMode={initialMode} />
    </div>
  );
}
