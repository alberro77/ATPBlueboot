import Link from "next/link";
import { ChevronRight, Flame, Trophy } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { MatchesProgress } from "@/components/ranking-table";
import { StreakBadge } from "@/components/streak-badge";
import { nowMs, playerHref } from "@/lib/format";
import { statsFor } from "@/lib/modes";
import { seasonKeyAt, seasonMonthName, seasonRange } from "@/lib/seasons";
import type { Profile, Scope } from "@/lib/types";

export function MyPositionCard({ me, ranked, scope }: { me: Profile; ranked: Profile[]; scope: Scope }) {
  const position = ranked.findIndex((p) => p.id === me.id) + 1;
  const st = statsFor(me, scope);
  return (
    <Link
      href="/perfil"
      className="bg-brand mb-4 flex items-center gap-3 rounded-2xl p-4 text-white shadow-lg shadow-primary/25 transition-transform active:scale-[0.99]"
    >
      <PlayerAvatar player={me} size={48} className="ring-2 ring-white/70" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-white/75">
          Tu posición <StreakBadge streak={st.streak} />
        </p>
        {position > 0 ? (
          <p className="text-2xl leading-tight font-extrabold">
            #{position} <span className="text-sm font-medium text-white/75">de {ranked.length}</span>
          </p>
        ) : (
          <div>
            <p className="text-base leading-tight font-bold">Sin clasificar</p>
            <MatchesProgress played={st.played} onBrand className="mt-1" />
          </div>
        )}
      </div>
      <div className="text-right">
        <p className="text-xs font-medium text-white/75">AURA</p>
        <p className="text-2xl leading-tight font-extrabold tabular-nums">{st.elo}</p>
      </div>
    </Link>
  );
}

/** Jugadores con 3 o más victorias seguidas, de mayor a menor racha. */
export function OnFireStrip({ players, currentUserId, scope }: { players: Profile[]; currentUserId: string; scope: Scope }) {
  return (
    <section className="mb-4 flex items-center gap-3 rounded-2xl border border-orange-300/50 bg-linear-to-br from-orange-50 to-amber-50 py-2 pl-3 dark:border-orange-500/25 dark:from-orange-500/10 dark:to-amber-500/5">
      <h2 className="flex shrink-0 flex-col items-center text-[0.65rem] leading-tight font-extrabold text-orange-600 uppercase dark:text-orange-400">
        <Flame className="size-5 fill-orange-400" /> On fire
      </h2>
      <ul className="flex min-w-0 gap-2.5 overflow-x-auto pt-1 pr-3 pb-0.5">
        {players.map((p) => (
          <li key={p.id} className="shrink-0">
            <Link
              prefetch={false}
              href={playerHref(p.id, currentUserId)}
              className="flex w-12 flex-col items-center gap-0.5 text-center transition-transform active:scale-95"
            >
              <div className="relative">
                <PlayerAvatar player={p} size={38} className="ring-2 ring-orange-400" />
                <StreakBadge
                  streak={statsFor(p, scope).streak}
                  className="absolute -right-2.5 -bottom-1 ring-2 ring-orange-50 dark:ring-background"
                />
              </div>
              <span className="w-full truncate text-[0.7rem] font-semibold">
                {p.id === currentUserId ? "Vos" : p.nickname}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Acceso a la temporada (mes) en curso, en una sola línea. */
export function SeasonLink() {
  const now = nowMs();
  const key = seasonKeyAt(now);
  const daysLeft = Math.ceil((Date.parse(seasonRange(key).end) - now) / 86_400_000);
  return (
    <Link
      prefetch={false}
      href={`/temporadas/${key}`}
      className="mb-4 flex items-center gap-2.5 rounded-2xl border bg-card px-3 py-2.5 text-sm shadow-sm transition-colors hover:border-primary/40"
    >
      <Trophy className="size-4 shrink-0 text-amber-500" />
      <span className="min-w-0 flex-1 truncate font-semibold">Temporada de {seasonMonthName(key)}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {daysLeft <= 1 ? "termina hoy" : `quedan ${daysLeft} días`}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
