import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Crown, Trophy } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/page-header";
import { PlayerAvatar } from "@/components/player-avatar";
import { nowMs, signed } from "@/lib/format";
import { firstSeasonKey, loadSeason } from "@/lib/season-data";
import { seasonKeyAt, seasonRange, shiftSeason, type SeasonSummary } from "@/lib/seasons";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Temporadas" };

const MAX_SEASONS = 12;

export default async function SeasonsPage() {
  const now = nowMs();
  const current = seasonKeyAt(now);
  const supabase = await createClient();
  const first = (await firstSeasonKey(supabase)) ?? current;

  const keys: string[] = [];
  for (let k = current; k >= first && keys.length < MAX_SEASONS; k = shiftSeason(k, -1)) keys.push(k);
  const seasons = await Promise.all(keys.map((k) => loadSeason(supabase, k)));
  const [live, ...past] = seasons;
  const daysLeft = Math.ceil((Date.parse(seasonRange(current).end) - now) / 86_400_000);

  return (
    <div className="mx-auto grid max-w-lg gap-5">
      <PageHeader
        title="Temporadas"
        description="Cada mes es una temporada. El ELO sigue de largo; el campeón es quien más ELO suma en el mes."
      />

      <Link
        href={`/temporadas/${live.key}`}
        className="bg-brand relative overflow-hidden rounded-3xl p-5 text-white shadow-lg shadow-primary/25 transition-transform active:scale-[0.99]"
      >
        <Trophy className="absolute -right-3 -bottom-4 size-28 -rotate-12 text-white/10" aria-hidden />
        <p className="text-xs font-semibold tracking-widest text-white/70 uppercase">En curso</p>
        <p className="text-2xl font-extrabold">{live.label}</p>
        <p className="text-sm text-white/80">
          {live.totalMatches} partidos · {daysLeft === 1 ? "termina mañana" : `quedan ${daysLeft} días`}
        </p>
        {live.champion ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/15 p-3">
            <PlayerAvatar player={live.champion.player} size={44} className="ring-2 ring-white/70" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white/75">Va ganando</p>
              <p className="truncate font-bold">{live.champion.player.nickname}</p>
            </div>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-primary tabular-nums">
              {signed(live.champion.change)} ELO
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-white/80">Todavía nadie jugó 3 partidos este mes. ¡Arrancá vos!</p>
        )}
        <span className="mt-3 flex items-center gap-1 text-sm font-semibold">
          Ver tabla del mes <ChevronRight className="size-4" />
        </span>
      </Link>

      <section className="grid gap-2">
        <h2 className="text-base font-bold">Temporadas anteriores</h2>
        {past.length === 0 ? (
          <EmptyState icon={Trophy} title="Esta es la primera temporada">
            Cuando termine el mes, acá va a quedar el registro con el campeón y lo más destacado.
          </EmptyState>
        ) : (
          <ol className="grid gap-2">
            {past.map((s) => (
              <li key={s.key}>
                <PastSeason summary={s} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function PastSeason({ summary }: { summary: SeasonSummary }) {
  const champ = summary.champion;
  return (
    <Link
      href={`/temporadas/${summary.key}`}
      className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm transition-all hover:border-primary/40 active:scale-[0.99]"
    >
      {champ ? (
        <div className="relative">
          <PlayerAvatar player={champ.player} size={48} className="ring-2 ring-amber-400" />
          <Crown className="absolute -top-2.5 -right-1.5 size-5 rotate-12 fill-amber-400 text-amber-500" />
        </div>
      ) : (
        <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Trophy className="size-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-bold">{summary.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {champ ? (
            <>
              Campeón: <b className="text-foreground">{champ.player.nickname}</b> ({signed(champ.change)})
            </>
          ) : (
            "Sin campeón"
          )}{" "}
          · {summary.totalMatches} partidos
        </p>
      </div>
      <ChevronRight className="size-5 text-muted-foreground" />
    </Link>
  );
}
