import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { MySeason, SeasonHero, SeasonHighlights, SeasonPodium, SeasonTable } from "@/components/season-view";
import { getSession } from "@/lib/data";
import { nowMs } from "@/lib/format";
import { firstSeasonKey, loadSeason } from "@/lib/season-data";
import { isSeasonKey, seasonKeyAt, seasonLabel, seasonRange, shiftSeason } from "@/lib/seasons";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/temporadas/[mes]">): Promise<Metadata> {
  const { mes } = await params;
  return { title: isSeasonKey(mes) ? `Temporada ${seasonLabel(mes)}` : "Temporada" };
}

export default async function SeasonPage({ params }: PageProps<"/temporadas/[mes]">) {
  const { mes } = await params;
  const now = nowMs();
  const current = seasonKeyAt(now);
  if (!isSeasonKey(mes) || mes > current) notFound();

  const { profile } = await getSession();
  const supabase = await createClient();
  const [summary, first] = await Promise.all([loadSeason(supabase, mes), firstSeasonKey(supabase)]);

  const isCurrent = mes === current;
  const daysLeft = Math.ceil((Date.parse(seasonRange(mes).end) - now) / 86_400_000);
  const status = isCurrent
    ? `En curso · ${daysLeft === 1 ? "termina mañana" : `quedan ${daysLeft} días`}`
    : "Temporada finalizada";
  const prev = shiftSeason(mes, -1);
  const next = shiftSeason(mes, 1);
  const hasPrev = first !== null && prev >= first;
  const hasNext = next <= current;

  return (
    <div className="mx-auto grid max-w-lg gap-5">
      <Link href="/temporadas" className="-mb-2 flex w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Temporadas
      </Link>
      <SeasonHero summary={summary} status={status} />
      <MySeason summary={summary} viewerId={profile!.id} />
      <SeasonPodium summary={summary} viewerId={profile!.id} />
      <SeasonHighlights summary={summary} viewerId={profile!.id} />
      <SeasonTable summary={summary} viewerId={profile!.id} />

      <nav className="flex items-center justify-between">
        <SeasonLink href={hasPrev ? `/temporadas/${prev}` : null}>
          <ChevronLeft /> {seasonLabel(prev)}
        </SeasonLink>
        <SeasonLink href={hasNext ? `/temporadas/${next}` : null}>
          {seasonLabel(next)} <ChevronRight />
        </SeasonLink>
      </nav>
    </div>
  );
}

function SeasonLink({ href, children }: { href: string | null; children: React.ReactNode }) {
  const className = cn(buttonVariants({ variant: "outline", size: "sm" }), !href && "pointer-events-none opacity-40");
  if (!href) return <span className={className}>{children}</span>;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
