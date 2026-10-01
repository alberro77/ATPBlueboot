import Link from "next/link";
import { Crown, Medal } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { StreakBadge } from "@/components/streak-badge";
import { fullName, playerHref } from "@/lib/format";
import { MIN_MATCHES_TO_RANK } from "@/lib/elo";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const MEDAL = [
  { ring: "ring-amber-400", chip: "bg-amber-400 text-amber-950", block: "from-amber-300/60 to-amber-100/20 dark:from-amber-400/25 dark:to-transparent h-24" },
  { ring: "ring-slate-300", chip: "bg-slate-300 text-slate-800", block: "from-slate-300/60 to-slate-100/20 dark:from-slate-300/20 dark:to-transparent h-16" },
  { ring: "ring-orange-300", chip: "bg-orange-300 text-orange-950", block: "from-orange-300/60 to-orange-100/20 dark:from-orange-300/20 dark:to-transparent h-12" },
];

/** Top 3 en formato podio: 2º · 1º · 3º. */
export function Podium({
  players,
  currentUserId,
  leaderDays = null,
}: {
  players: Profile[];
  currentUserId: string;
  /** Días que lleva el #1 en la cima (null si no hay registro). */
  leaderDays?: number | null;
}) {
  const slots = [1, 0, 2].map((i) => ({ index: i, player: players[i] }));
  return (
    <div className="mb-4 grid grid-cols-3 items-end gap-2 rounded-2xl border bg-card px-2 pt-5 shadow-sm">
      {slots.map(({ index, player }) => {
        if (!player) return <div key={index} />;
        const medal = MEDAL[index];
        return (
          <Link prefetch={false}
            key={player.id}
            href={playerHref(player.id, currentUserId)}
            className="flex min-w-0 flex-col items-center text-center transition-transform active:scale-[0.97]"
          >
            {index === 0 && <Crown className="mb-1 size-6 fill-amber-400 text-amber-500" />}
            <div className="relative">
              <PlayerAvatar
                player={player}
                size={index === 0 ? 72 : 56}
                className={cn("ring-4", medal.ring)}
              />
              <span
                className={cn(
                  "absolute -bottom-2.5 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full text-xs font-black ring-2 ring-card",
                  medal.chip,
                )}
              >
                {index + 1}
              </span>
              <StreakBadge streak={player.win_streak} className="absolute -top-1 -right-3 ring-2 ring-card" />
            </div>
            <div className="mt-3 w-full truncate px-1 text-sm font-bold">
              {player.nickname}
              {player.id === currentUserId && <span className="text-primary"> ·vos</span>}
            </div>
            <div className="text-lg leading-tight font-extrabold tabular-nums text-primary">{player.elo}</div>
            <div className="text-[0.7rem] text-muted-foreground tabular-nums">
              {player.wins}V · {player.losses}D
            </div>
            {index === 0 && leaderDays !== null && (
              <div className="mt-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.65rem] font-bold text-amber-700 dark:bg-amber-400/15 dark:text-amber-300">
                {leaderDays < 1 ? "👑 Nuevo #1" : `👑 ${leaderDays} ${leaderDays === 1 ? "día" : "días"} en la cima`}
              </div>
            )}
            <div className={cn("mt-2 w-full rounded-t-xl bg-linear-to-b", medal.block)} />
          </Link>
        );
      })}
    </div>
  );
}

export function RankingTable({
  players,
  currentUserId,
  ranked,
  startIndex = 0,
}: {
  players: Profile[];
  currentUserId: string;
  ranked: boolean;
  startIndex?: number;
}) {
  return (
    <ol className="grid gap-2">
      {players.map((p, i) => {
        const position = startIndex + i + 1;
        const isMe = p.id === currentUserId;
        return (
          <li key={p.id}>
            <Link prefetch={false}
              href={playerHref(p.id, currentUserId)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm shadow-primary/5 transition-all hover:border-primary/40 hover:shadow-md active:scale-[0.99]",
                isMe && "border-primary/50 bg-accent/50",
              )}
            >
              <span className="flex w-7 shrink-0 justify-center">
                {ranked ? (
                  position <= 3 ? (
                    <Medal className={cn("size-5", ["text-amber-500", "text-slate-400", "text-orange-400"][position - 1])} />
                  ) : (
                    <span className="text-sm font-bold text-muted-foreground tabular-nums">{position}</span>
                  )
                ) : (
                  <span className="text-muted-foreground">–</span>
                )}
              </span>
              <PlayerAvatar player={p} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-bold">{p.nickname}</span>
                  {isMe && (
                    <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[0.6rem] leading-none font-bold text-primary-foreground uppercase">
                      Vos
                    </span>
                  )}
                  <StreakBadge streak={p.win_streak} />
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {fullName(p)} · {p.matches_played} PJ
                </div>
                {!ranked && <MatchesProgress played={p.matches_played} className="mt-1" />}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg leading-tight font-extrabold tabular-nums">{p.elo}</div>
                <div className="text-[0.7rem] font-semibold tabular-nums">
                  <span className="text-success">{p.wins}G</span>
                  <span className="text-muted-foreground"> · </span>
                  <span className="text-destructive">{p.losses}P</span>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

/** Progreso hacia los partidos mínimos para clasificar. */
export function MatchesProgress({
  played,
  className,
  onBrand = false,
}: {
  played: number;
  className?: string;
  /** Colores para usar sobre el fondo azul de marca. */
  onBrand?: boolean;
}) {
  const filled = onBrand ? "bg-white" : "bg-primary";
  const empty = onBrand ? "bg-white/25" : "bg-muted-foreground/20";
  return (
    <div className={cn("flex items-center gap-1.5", className)} title={`${played}/${MIN_MATCHES_TO_RANK} partidos`}>
      <div className="flex gap-0.5">
        {Array.from({ length: MIN_MATCHES_TO_RANK }, (_, i) => (
          <span key={i} className={cn("h-1.5 w-4 rounded-full", i < played ? filled : empty)} />
        ))}
      </div>
      <span className={cn("text-[0.7rem] tabular-nums", onBrand ? "text-white/80" : "text-muted-foreground")}>
        {played}/{MIN_MATCHES_TO_RANK}
      </span>
    </div>
  );
}
