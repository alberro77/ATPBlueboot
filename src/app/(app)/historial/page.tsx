import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/page-header";
import { MatchRow } from "@/components/match-views";
import { MATCH_FIELDS } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { MatchWithPlayers } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Historial" };

const PAGE_SIZE = 25;

export default async function HistoryPage({ searchParams }: PageProps<"/historial">) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(String(pageParam ?? "1"), 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const { data, count } = await supabase
    .from("matches")
    .select(MATCH_FIELDS, { count: "exact" })
    .eq("status", "confirmed")
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
      {matches.length === 0 ? (
        <EmptyState>Todavía no hay partidos confirmados.</EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {matches.map((m) => (
            <MatchRow key={m.id} match={m} />
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-4 flex items-center justify-between">
          <PageLink page={page - 1} disabled={page <= 1}>
            <ChevronLeft /> Anteriores
          </PageLink>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <PageLink page={page + 1} disabled={page >= totalPages}>
            Siguientes <ChevronRight />
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function PageLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const className = cn(buttonVariants({ variant: "outline" }), disabled && "pointer-events-none opacity-50");
  if (disabled) return <span className={className}>{children}</span>;
  return (
    <Link href={page === 1 ? "/historial" : `/historial?page=${page}`} className={className}>
      {children}
    </Link>
  );
}
