import Link from "next/link";
import { Crown, Flame, Handshake, Medal, Swords, Trophy, Zap, Activity } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { TeamAvatars, teamName } from "@/components/match-views";
import { MIN_MATCHES_TO_RANK } from "@/lib/elo";
import { formatShortDate, playerHref, signed } from "@/lib/format";
import type { SeasonPlayer, SeasonSummary } from "@/lib/seasons";
import type { PlayerSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

function name(p: PlayerSummary, viewerId: string) {
  return p.id === viewerId ? "Vos" : p.nickname;
}

function ChangePill({ change, className }: { change: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
        change > 0 ? "bg-success/15 text-success" : change < 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
        className,
      )}
    >
      {change === 0 ? "±0" : signed(change)} AURA
    </span>
  );
}

export function SeasonHero({ summary, status }: { summary: SeasonSummary; status: string }) {
  const players = summary.standings.length;
  return (
    <section className="bg-brand relative overflow-hidden rounded-3xl px-5 pt-5 pb-6 text-white shadow-lg shadow-primary/25">
      <Trophy className="absolute -top-4 -right-4 size-32 rotate-12 text-white/10" aria-hidden />
      <p className="text-xs font-semibold tracking-widest text-white/70 uppercase">Temporada</p>
      <h1 className="text-3xl font-extrabold">{summary.label}</h1>
      <p className="mt-0.5 text-sm text-white/80">{status}</p>
      <div className="mt-4 flex gap-6">
        <Stat value={summary.totalMatches} label="partidos" />
        <Stat value={players} label="jugadores" />
        <Stat value={summary.doublesMatches} label="de 2 vs 2" />
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-2xl leading-none font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-white/75">{label}</p>
    </div>
  );
}

/** Top 3 de la temporada por AURA ganada (solo con 3+ partidos en el mes). */
export function SeasonPodium({ summary, viewerId }: { summary: SeasonSummary; viewerId: string }) {
  const qualified = summary.standings.filter((p) => p.games >= MIN_MATCHES_TO_RANK).slice(0, 3);
  if (qualified.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-primary/25 bg-card/60 p-5 text-center text-sm text-muted-foreground">
        Todavía nadie jugó {MIN_MATCHES_TO_RANK} partidos este mes. El campeón es quien más AURA gane con al menos{" "}
        {MIN_MATCHES_TO_RANK} partidos.
      </p>
    );
  }
  const slots = [1, 0, 2].map((i) => ({ i, p: qualified[i] }));
  const medal = ["bg-amber-400 text-amber-950", "bg-slate-300 text-slate-800", "bg-orange-300 text-orange-950"];
  const ring = ["ring-amber-400", "ring-slate-300", "ring-orange-300"];
  return (
    <section className="grid gap-2">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <Trophy className="size-4 text-amber-500" /> Campeón del mes
      </h2>
      <div className="grid grid-cols-3 items-end gap-2 rounded-2xl border bg-card px-2 pt-5 pb-4 shadow-sm">
        {slots.map(({ i, p }) =>
          p ? (
            <Link prefetch={false} key={p.player.id} href={playerHref(p.player.id, viewerId)} className="flex min-w-0 flex-col items-center text-center">
              {i === 0 && <Crown className="mb-1 size-6 fill-amber-400 text-amber-500" />}
              <div className="relative">
                <PlayerAvatar player={p.player} size={i === 0 ? 68 : 52} className={cn("ring-4", ring[i])} />
                <span className={cn("absolute -bottom-2 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full text-xs font-black ring-2 ring-card", medal[i])}>
                  {i + 1}
                </span>
              </div>
              <p className="mt-3 w-full truncate text-sm font-bold">{name(p.player, viewerId)}</p>
              <ChangePill change={p.change} className="mt-1" />
              <p className="mt-1 text-[0.7rem] text-muted-foreground tabular-nums">
                {p.wins}G · {p.losses}P
              </p>
            </Link>
          ) : (
            <div key={i} />
          ),
        )}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Gana quien más AURA suma en el mes (mínimo {MIN_MATCHES_TO_RANK} partidos). El AURA no se resetea.
      </p>
    </section>
  );
}

function Highlight({
  icon: Icon,
  tone,
  title,
  children,
  className,
}: {
  icon: typeof Trophy;
  tone: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-sm", className)}>
      <span className="flex items-center gap-1.5 text-[0.7rem] font-bold text-muted-foreground uppercase">
        <span className={cn("flex size-6 items-center justify-center rounded-lg", tone)}>
          <Icon className="size-3.5" />
        </span>
        {title}
      </span>
      {children}
    </div>
  );
}

function PlayerLine({ player, viewerId, detail }: { player: PlayerSummary; viewerId: string; detail: React.ReactNode }) {
  return (
    <Link prefetch={false} href={playerHref(player.id, viewerId)} className="flex min-w-0 items-center gap-2">
      <PlayerAvatar player={player} size={36} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{name(player, viewerId)}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </Link>
  );
}

/** Lo más interesante de la temporada. */
export function SeasonHighlights({ summary, viewerId }: { summary: SeasonSummary; viewerId: string }) {
  const { topAtClose, mostActive, bestStreak, upset, rivalry, duo } = summary;
  return (
    <section className="grid gap-2">
      <h2 className="text-base font-bold">Lo más destacado</h2>
      <div className="grid grid-cols-2 gap-2">
        {topAtClose && (
          <Highlight icon={Crown} tone="bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300" title="#1 al cierre">
            <PlayerLine player={topAtClose.player} viewerId={viewerId} detail={`${topAtClose.elo} AURA`} />
          </Highlight>
        )}
        {mostActive && (
          <Highlight icon={Activity} tone="bg-accent text-primary" title="Más activo">
            <PlayerLine player={mostActive.player} viewerId={viewerId} detail={`${mostActive.games} partidos`} />
          </Highlight>
        )}
        {bestStreak && (
          <Highlight icon={Flame} tone="bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400" title="Mejor racha">
            <PlayerLine player={bestStreak.player} viewerId={viewerId} detail={`${bestStreak.bestStreak} victorias seguidas`} />
          </Highlight>
        )}
        {duo && (
          <Highlight icon={Handshake} tone="bg-accent text-primary" title="Dupla del mes">
            <div className="flex min-w-0 items-center gap-2">
              <TeamAvatars players={duo.players} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{teamName(duo.players)}</span>
                <span className="block text-xs text-muted-foreground">
                  {duo.wins} de {duo.games} ganados
                </span>
              </span>
            </div>
          </Highlight>
        )}
        {upset && (
          <Highlight icon={Zap} tone="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" title="La gran sorpresa" className="col-span-2">
            <div className="flex items-center gap-3">
              <TeamAvatars players={upset.winners} />
              <p className="min-w-0 text-sm">
                <b>{upset.winners.map((p) => name(p, viewerId)).join(" & ")}</b> le ganó a{" "}
                <b>{upset.losers.map((p) => name(p, viewerId)).join(" & ")}</b> con solo{" "}
                <b className="text-violet-600 dark:text-violet-300">{Math.round(upset.chance * 100)}%</b> de chances.
                <span className="block text-xs text-muted-foreground">{formatShortDate(upset.date)}</span>
              </p>
            </div>
          </Highlight>
        )}
        {rivalry && (
          <Highlight icon={Swords} tone="bg-destructive/10 text-destructive" title="Rivalidad del mes" className="col-span-2">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
              <PlayerSide player={rivalry.a} wins={rivalry.aWins} viewerId={viewerId} />
              <span className="text-xs font-bold text-muted-foreground">{rivalry.games} partidos</span>
              <PlayerSide player={rivalry.b} wins={rivalry.games - rivalry.aWins} viewerId={viewerId} />
            </div>
          </Highlight>
        )}
      </div>
    </section>
  );
}

function PlayerSide({ player, wins, viewerId }: { player: PlayerSummary; wins: number; viewerId: string }) {
  return (
    <Link prefetch={false} href={playerHref(player.id, viewerId)} className="flex min-w-0 flex-col items-center gap-1">
      <PlayerAvatar player={player} size={40} />
      <span className="w-full truncate text-xs font-semibold">{name(player, viewerId)}</span>
      <span className="text-xl leading-none font-extrabold tabular-nums">{wins}</span>
    </Link>
  );
}

/** Resumen personal de la temporada. */
export function MySeason({ summary, viewerId }: { summary: SeasonSummary; viewerId: string }) {
  const index = summary.standings.findIndex((p) => p.player.id === viewerId);
  const me: SeasonPlayer | undefined = summary.standings[index];
  return (
    <section className="rounded-2xl border border-primary/30 bg-accent/50 p-4">
      <h2 className="mb-2 text-sm font-bold">Tu temporada</h2>
      {me ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span>
            Puesto <b className="text-lg">#{index + 1}</b>
            <span className="text-muted-foreground"> de {summary.standings.length}</span>
          </span>
          <span>
            <b>{me.games}</b> partidos · <span className="font-semibold text-success">{me.wins}G</span> ·{" "}
            <span className="font-semibold text-destructive">{me.losses}P</span>
          </span>
          <ChangePill change={me.change} />
          {me.bestStreak >= 2 && (
            <span className="flex items-center gap-1 text-xs font-semibold text-orange-500">
              <Flame className="size-3.5 fill-orange-400" /> racha de {me.bestStreak}
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No jugaste partidos en esta temporada.</p>
      )}
    </section>
  );
}

/** Tabla del mes ordenada por AURA ganada. */
export function SeasonTable({ summary, viewerId }: { summary: SeasonSummary; viewerId: string }) {
  if (summary.standings.length === 0) return null;
  return (
    <section className="grid gap-2">
      <h2 className="text-base font-bold">Tabla de la temporada</h2>
      <ol className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
        {summary.standings.map((p, i) => {
          const qualified = p.games >= MIN_MATCHES_TO_RANK;
          return (
            <li key={p.player.id}>
              <Link prefetch={false}
                href={playerHref(p.player.id, viewerId)}
                className={cn("flex items-center gap-3 px-3 py-2.5", p.player.id === viewerId && "bg-accent/50")}
              >
                <span className="flex w-6 justify-center text-sm font-bold text-muted-foreground tabular-nums">
                  {i < 3 && qualified ? (
                    <Medal className={cn("size-4", ["text-amber-500", "text-slate-400", "text-orange-400"][i])} />
                  ) : (
                    i + 1
                  )}
                </span>
                <PlayerAvatar player={p.player} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{name(p.player, viewerId)}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">
                    {p.games} PJ · {p.wins}G · {p.losses}P{!qualified && " · no clasifica"}
                  </span>
                </span>
                <ChangePill change={p.change} />
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
