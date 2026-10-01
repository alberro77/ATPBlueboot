import { Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar, type AvatarSize } from "@/components/player-avatar";
import { formatDate, fullName, signed } from "@/lib/format";
import { MODE_SHORT } from "@/lib/modes";
import type { MatchStatus, MatchWithPlayers, Mode, PlayerSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<MatchStatus, string> = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

export function StatusBadge({ status }: { status: MatchStatus }) {
  return (
    <Badge
      variant={status === "confirmed" ? "secondary" : "outline"}
      className={cn(
        status === "pending" && "border-amber-500/40 text-amber-600 dark:text-amber-400",
        (status === "rejected" || status === "cancelled") && "text-muted-foreground",
      )}
    >
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function ModeBadge({ mode }: { mode: Mode }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "px-1.5 font-semibold",
        mode === "doubles" ? "border-primary/40 bg-accent text-accent-foreground" : "text-muted-foreground",
      )}
    >
      {MODE_SHORT[mode]}
    </Badge>
  );
}

/** Pastilla con el AURA ganada (verde) o perdido (rojo). */
export function DeltaPill({ delta, suffix }: { delta: number; suffix?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
        delta >= 0 ? "bg-success/12 text-success" : "bg-destructive/10 text-destructive",
      )}
    >
      {signed(delta)}
      {suffix}
    </span>
  );
}

export function teamA(m: MatchWithPlayers): PlayerSummary[] {
  return m.reporter_partner ? [m.reporter, m.reporter_partner] : [m.reporter];
}

export function teamB(m: MatchWithPlayers): PlayerSummary[] {
  return m.opponent_partner ? [m.opponent, m.opponent_partner] : [m.opponent];
}

export function teamName(players: PlayerSummary[]) {
  return players.map((p) => p.nickname).join(" & ");
}

/** Marcador de partidos viejos (antes se cargaban los puntos). */
function legacyScore(m: MatchWithPlayers, teamAFirst: boolean) {
  if (m.reporter_score === null || m.opponent_score === null) return null;
  return teamAFirst ? `${m.reporter_score}-${m.opponent_score}` : `${m.opponent_score}-${m.reporter_score}`;
}

/** Un partido visto desde un jugador: su equipo, los rivales, el resultado y el AURA ganada/perdida. */
export function perspective(match: MatchWithPlayers, playerId: string) {
  const onTeamA = match.reporter_id === playerId || match.reporter_partner_id === playerId;
  const won = onTeamA === match.reporter_won;
  const myTeam = onTeamA ? teamA(match) : teamB(match);
  return {
    won,
    partner: myTeam.find((p) => p.id !== playerId) ?? null,
    rivals: onTeamA ? teamB(match) : teamA(match),
    score: legacyScore(match, onTeamA),
    delta: match.elo_delta === null ? null : won ? match.elo_delta : -match.elo_delta,
  };
}

export function TeamAvatars({
  players,
  size = "default",
  className,
}: {
  players: PlayerSummary[];
  size?: AvatarSize;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 -space-x-2.5", className)}>
      {players.map((p) => (
        <PlayerAvatar key={p.id} player={p} size={size} className="ring-2 ring-card" />
      ))}
    </div>
  );
}

/** Fila de "Mis partidos": desde el punto de vista del usuario. */
export function MyMatchRow({
  match,
  playerId,
  action,
}: {
  match: MatchWithPlayers;
  playerId: string;
  action?: React.ReactNode;
}) {
  const p = perspective(match, playerId);
  const confirmed = match.status === "confirmed";
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        aria-hidden
        className={cn(
          "h-10 w-1 shrink-0 rounded-full",
          !confirmed ? "bg-muted-foreground/30" : p.won ? "bg-success" : "bg-destructive",
        )}
      />
      <TeamAvatars players={p.rivals} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-xs font-bold uppercase",
              !confirmed ? "text-muted-foreground" : p.won ? "text-success" : "text-destructive",
            )}
          >
            {p.won ? "Victoria" : "Derrota"}
          </span>
          <span className="truncate text-sm">vs {teamName(p.rivals)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <ModeBadge mode={match.mode} />
          {p.partner && <span>con {p.partner.nickname}</span>}
          <span>{formatDate(match.created_at)}</span>
          {p.score && <span className="tabular-nums">({p.score})</span>}
          {!confirmed && <StatusBadge status={match.status} />}
        </div>
      </div>
      {p.delta !== null && <DeltaPill delta={p.delta} />}
      {action}
    </li>
  );
}

function Side({
  players,
  winner,
  delta,
  align,
}: {
  players: PlayerSummary[];
  winner: boolean;
  delta: number | null;
  align: "left" | "right";
}) {
  const single = players.length === 1 ? players[0] : null;
  return (
    <div className={cn("flex min-w-0 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <TeamAvatars players={players} size="sm" className="hidden sm:flex" />
      <div className="min-w-0">
        <div className={cn("truncate text-sm", winner ? "font-bold" : "text-muted-foreground")}>
          {teamName(players)}
        </div>
        {single && <div className="hidden truncate text-xs text-muted-foreground sm:block">{fullName(single)}</div>}
        {delta !== null && (
          <div className={cn("text-xs font-semibold tabular-nums", delta >= 0 ? "text-success" : "text-destructive")}>
            {signed(delta)}
            {players.length > 1 && " c/u"}
          </div>
        )}
      </div>
    </div>
  );
}

/** Fila neutral para el historial general: ganador · venció a · perdedor. */
export function MatchRow({ match }: { match: MatchWithPlayers }) {
  const [winners, losers] = match.reporter_won ? [teamA(match), teamB(match)] : [teamB(match), teamA(match)];
  const score = legacyScore(match, match.reporter_won);
  const delta = match.elo_delta;

  return (
    <li className="px-4 py-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Side players={winners} winner delta={delta} align="left" />
        <div className="flex flex-col items-center gap-0.5 text-center">
          {score ? (
            <span className="text-base font-bold tabular-nums">{score}</span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Trophy className="size-3.5" /> venció a
            </span>
          )}
          <div className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
            <ModeBadge mode={match.mode} />
            {formatDate(match.resolved_at ?? match.created_at)}
          </div>
        </div>
        <Side players={losers} winner={false} delta={delta === null ? null : -delta} align="right" />
      </div>
    </li>
  );
}
