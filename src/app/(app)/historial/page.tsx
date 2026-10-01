import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/page-header";
import { MatchRow } from "@/components/match-views";
import { SegmentedLinks } from "@/components/segmented";
import { MATCH_FIELDS } from "@/lib/data";
import { MODE_SHORT, parseMode } from "@/lib/modes";
import { createClient } from "@/lib/supabase/server";
import type { MatchWithPlayers, Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Historial" };

const PAGE_SIZE = 25;

function historyHref(mode: Mode | null, page = 1) {
  const params = new URLSearchParams();
  if (mode) params.set("modo", MODE_SHORT[mode]);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/historial?${qs}` : "/historial";
}

export default async function HistoryPage({ searchParams }: PageProps<"/historial">) {
  const { page: pageParam, modo } = await searchParams;
  const mode = parseMode(modo);
  const page = Math.max(1, Number.parseInt(String(pageParam ?? "1"), 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("matches")
    .select(MATCH_FIELDS, { count: "exact" })
    .eq("status", "confirmed");
  if (mode) query = query.eq("mode", mode);
  const { data, count } = await query
    .order("resolved_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  const matches = (data ?? []) as unknown as MatchWithPlayers[];
  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Historial general"
        description={`${total} partido${total === 1 ? "" : "s"} confirmado${total === 1 ? "" : "s"} en la empresa.`}
      />
      <div className="mb-4">
        <SegmentedLinks
          options={[
            { href: historyHref(null), label: "Todos", active: mode === null },
            { href: historyHref("singles"), label: "1v1", active: mode === "singles" },
            { href: historyHref("doubles"), label: "2v2", active: mode === "doubles" },
          ]}
        />
      </div>
      {matches.length === 0 ? (
        <EmptyState icon={Trophy} title="Todavía no hay partidos">Cuando se confirme el primero, aparece acá.</EmptyState>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
          {matches.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between">
          <PageLink href={historyHref(mode, page - 1)} disabled={page <= 1}>
            <ChevronLeft /> Anteriores
          </PageLink>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <PageLink href={historyHref(mode, page + 1)} disabled={page >= totalPages}>
            Siguientes <ChevronRight />
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className = cn(buttonVariants({ variant: "outline" }), disabled && "pointer-events-none opacity-50");
  if (disabled) return <span className={className}>{children}</span>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
