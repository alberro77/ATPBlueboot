import Link from "next/link";
import { Flame, Handshake, Swords, User, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/player-avatar";
import { perspective } from "@/components/match-views";
import { MIN_MATCHES_TO_RANK, ON_FIRE_STREAK } from "@/lib/elo";
import { fullName, playerHref, signed } from "@/lib/format";
import type { MatchWithPlayers, Mode, PlayerSummary, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

function byDateDesc(a: MatchWithPlayers, b: MatchWithPlayers) {
  return b.created_at.localeCompare(a.created_at);
}

/** Últimos 5 resultados confirmados. */
function lastResults(matches: MatchWithPlayers[], playerId: string) {
  return matches
    .filter((m) => m.status === "confirmed")
    .sort(byDateDesc)
    .slice(0, 5)
    .map((m) => perspective(m, playerId).won);
}

export function StatsCard({ profile, matches }: { profile: Profile; matches: MatchWithPlayers[] }) {
  const last = lastResults(matches, profile.id);
  const onFire = profile.win_streak >= ON_FIRE_STREAK;
  const winRate = profile.matches_played > 0 ? Math.round((profile.wins / profile.matches_played) * 100) : null;
  const stats = [
    { label: "Jugados", value: profile.matches_played },
    { label: "Ganados", value: profile.wins, className: "text-success" },
    { label: "Perdidos", value: profile.losses, className: "text-destructive" },
    { label: "Efectividad", value: winRate === null ? "–" : `${winRate}%` },
  ];

  return (
    <Card className="gap-0 py-0">
      <CardContent className="grid grid-cols-4 divide-x px-0 py-4 text-center">
        {stats.map((s) => (
          <div key={s.label} className="px-1">
            <div className={cn("text-xl leading-none font-extrabold tabular-nums", s.className)}>{s.value}</div>
            <div className="mt-1.5 text-[0.7rem] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </CardContent>
      {last.length > 0 && (
        <div className="flex items-center justify-between border-t px-4 py-3">
          <div className="flex items-center gap-1.5" aria-label="Últimos resultados">
            <span className="mr-1 text-xs text-muted-foreground">Últimos</span>
            {last.map((won, i) => (
              <span
                key={i}
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-[0.65rem] font-bold text-white",
                  won ? "bg-emerald-700" : "bg-red-600",
                )}
              >
                {won ? "V" : "D"}
              </span>
            ))}
          </div>
          <div className="text-right text-xs leading-tight">
            <p
              className={cn(
                "flex items-center justify-end gap-1 font-bold",
                onFire ? "text-orange-500" : profile.win_streak > 0 ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <Flame className={cn("size-4", onFire && "fill-orange-400")} />
              {profile.win_streak > 0 ? `${profile.win_streak} al hilo` : "Sin racha"}
            </p>
            <p className="text-muted-foreground">Mejor racha: {profile.best_win_streak}</p>
          </div>
        </div>
      )}
      {profile.matches_played < MIN_MATCHES_TO_RANK && (
        <p className="border-t px-4 py-3 text-center text-xs text-muted-foreground">
          Te faltan {MIN_MATCHES_TO_RANK - profile.matches_played} partido(s) para entrar al ranking oficial.
        </p>
      )}
    </Card>
  );
}

type Relation = { player: PlayerSummary; games: number; wins: number; losses: number };

/**
 * Clásico rival: con quien más jugaste en contra en 1 vs 1.
 * Compañero: con quien más jugaste del mismo lado en 2v2.
 * Ante un empate gana el más reciente.
 */
export function computeRelations(matches: MatchWithPlayers[], playerId: string) {
  const rivals = new Map<string, Relation>();
  const partners = new Map<string, Relation>();
  const add = (map: Map<string, Relation>, player: PlayerSummary, won: boolean) => {
    const r = map.get(player.id) ?? { player, games: 0, wins: 0, losses: 0 };
    r.games++;
    if (won) r.wins++;
    else r.losses++;
    map.set(player.id, r);
  };

  for (const m of [...matches].filter((m) => m.status === "confirmed").sort(byDateDesc)) {
    const p = perspective(m, playerId);
    if (m.mode === "singles") add(rivals, p.rivals[0], p.won);
    if (p.partner) add(partners, p.partner, p.won);
  }

  const top = (map: Map<string, Relation>) =>
    [...map.values()].reduce<Relation | null>((best, r) => (!best || r.games > best.games ? r : best), null);
  return { rival: top(rivals), partner: top(partners) };
}

export function RelationCards({
  rival,
  partner,
  viewerId,
  emptyRival = "Todavía no jugaste un 1 vs 1.",
  emptyPartner = "Jugá un 2 vs 2 para tener compañero.",
}: {
  rival: Relation | null;
  partner: Relation | null;
  viewerId: string;
  emptyRival?: string;
  emptyPartner?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <RelationCard
        icon={Swords}
        title="Clásico rival"
        relation={rival}
        detail={(r) => `${r.games} ${r.games === 1 ? "partido" : "partidos"} 1 vs 1`}
        empty={emptyRival}
        viewerId={viewerId}
      />
      <RelationCard
        icon={Handshake}
        title="Compañero"
        relation={partner}
        detail={(r) => `${r.games} ${r.games === 1 ? "partido" : "partidos"} juntos`}
        empty={emptyPartner}
        viewerId={viewerId}
      />
    </div>
  );
}

function RelationCard({
  icon: Icon,
  title,
  relation,
  detail,
  empty,
  viewerId,
}: {
  icon: typeof Swords;
  title: string;
  relation: Relation | null;
  detail: (r: Relation) => string;
  empty: string;
  viewerId: string;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="flex flex-col items-center gap-2 px-3 py-4 text-center">
        <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
          <Icon className="size-3.5 text-primary" /> {title}
        </span>
        {relation ? (
          <>
            <Link prefetch={false}
              href={playerHref(relation.player.id, viewerId)}
              className="flex w-full min-w-0 flex-col items-center gap-2 rounded-xl transition-opacity hover:opacity-80"
            >
              <PlayerAvatar player={relation.player} size={56} className="ring-2 ring-primary/25" />
              <div className="w-full min-w-0">
                <p className="truncate font-bold">
                  {relation.player.id === viewerId ? "Vos" : relation.player.nickname}
                </p>
                <p className="truncate text-[0.7rem] text-muted-foreground">{fullName(relation.player)}</p>
              </div>
            </Link>
            <p className="text-xs text-muted-foreground">{detail(relation)}</p>
            <RecordBar wins={relation.wins} losses={relation.losses} />
          </>
        ) : (
          <p className="py-6 text-xs text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

/** Barra de victorias (verde) contra derrotas (rojo). */
export function RecordBar({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses;
  return (
    <div className="w-full">
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        <div className="bg-success" style={{ width: `${(wins / total) * 100}%` }} />
        <div className="bg-destructive" style={{ width: `${(losses / total) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[0.7rem] font-semibold tabular-nums">
        <span className="text-success">{wins}V</span>
        <span className="text-destructive">{losses}D</span>
      </div>
    </div>
  );
}

export type ModeRecord = {
  games: number;
  wins: number;
  losses: number;
  /** Victorias seguidas actuales y mejor racha en la modalidad. */
  streak: number;
  bestStreak: number;
  /** Últimos 5 resultados, del más nuevo al más viejo (true = victoria). */
  last: boolean[];
  /** AURA neta ganada (+) o perdida (−) en partidos de esta modalidad. */
  eloChange: number;
};

/** Récord y estadísticas del jugador en una modalidad (1 vs 1 o 2 vs 2). */
export function computeModeRecord(matches: MatchWithPlayers[], playerId: string, mode: Mode): ModeRecord {
  const list = matches
    .filter((m) => m.status === "confirmed" && m.mode === mode)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  let wins = 0;
  let streak = 0;
  let best = 0;
  let eloChange = 0;
  const results: boolean[] = [];
  for (const m of list) {
    const p = perspective(m, playerId);
    results.push(p.won);
    eloChange += p.delta ?? 0;
    if (p.won) {
      wins++;
      streak++;
      best = Math.max(best, streak);
    } else {
      streak = 0;
    }
  }
  return {
    games: list.length,
    wins,
    losses: list.length - wins,
    streak,
    bestStreak: best,
    last: results.slice(-5).reverse(),
    eloChange,
  };
}

/** Récord y estadísticas separadas por modalidad. */
export function ModeStatsCards({ matches, playerId }: { matches: MatchWithPlayers[]; playerId: string }) {
  return (
    <section className="grid gap-2">
      <h2 className="text-base font-bold">Récord por modalidad</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard mode="singles" record={computeModeRecord(matches, playerId, "singles")} />
        <ModeCard mode="doubles" record={computeModeRecord(matches, playerId, "doubles")} />
      </div>
    </section>
  );
}

function ModeCard({ mode, record: r }: { mode: Mode; record: ModeRecord }) {
  const winRate = r.games > 0 ? Math.round((r.wins / r.games) * 100) : null;
  return (
    <Card className="gap-0 py-0">
      <CardContent className="grid gap-3 px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground uppercase">
            {mode === "singles" ? <User className="size-3.5 text-primary" /> : <Users className="size-3.5 text-primary" />}
            {mode === "singles" ? "1 vs 1" : "2 vs 2"}
          </span>
          {r.games > 0 && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                r.eloChange > 0
                  ? "bg-success/15 text-success"
                  : r.eloChange < 0
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {r.eloChange === 0 ? "±0" : signed(r.eloChange)} AURA
            </span>
          )}
        </div>

        {r.games === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {mode === "singles" ? "Todavía no jugó 1 vs 1." : "Todavía no jugó 2 vs 2."}
          </p>
        ) : (
          <>
            <div className="flex items-end justify-between">
              <p className="text-3xl leading-none font-extrabold tabular-nums">
                <span className="text-success">{r.wins}</span>
                <span className="text-muted-foreground"> - </span>
                <span className="text-destructive">{r.losses}</span>
              </p>
              <p className="text-sm font-semibold tabular-nums">
                {winRate}% <span className="font-normal text-muted-foreground">efectividad</span>
              </p>
            </div>
            <RecordBar wins={r.wins} losses={r.losses} />
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniStat label="Jugados" value={r.games} />
              <MiniStat label="Racha actual" value={r.streak} fire={r.streak >= ON_FIRE_STREAK} />
              <MiniStat label="Mejor racha" value={r.bestStreak} />
            </div>
            <div className="flex items-center gap-1.5 border-t pt-3" aria-label="Últimos resultados">
              <span className="mr-1 text-xs text-muted-foreground">Últimos</span>
              {r.last.map((won, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[0.65rem] font-bold text-white",
                    won ? "bg-emerald-700" : "bg-red-600",
                  )}
                >
                  {won ? "V" : "D"}
                </span>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, fire = false }: { label: string; value: number; fire?: boolean }) {
  return (
    <div className="rounded-xl bg-muted/60 px-1 py-2">
      <p
        className={cn(
          "flex items-center justify-center gap-0.5 text-lg leading-none font-extrabold tabular-nums",
          fire && "text-orange-500",
        )}
      >
        {fire && <Flame className="size-4 fill-orange-400" />}
        {value}
      </p>
      <p className="mt-1 text-[0.65rem] text-muted-foreground">{label}</p>
    </div>
  );
}
