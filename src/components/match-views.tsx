import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/player-avatar";
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
      className={cn("px-1.5 font-semibold", mode === "doubles" && "border-primary/40 text-primary")}
    >
      {MODE_SHORT[mode]}
    </Badge>
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

/** Un partido visto desde un jugador: su equipo, los rivales, el resultado y el ELO ganado/perdido. */
export function perspective(match: MatchWithPlayers, playerId: string) {
  const onTeamA = match.reporter_id === playerId || match.reporter_partner_id === playerId;
  const teamAWon = match.reporter_score > match.opponent_score;
  const won = onTeamA === teamAWon;
  const myTeam = onTeamA ? teamA(match) : teamB(match);
  return {
    won,
    partner: myTeam.find((p) => p.id !== playerId) ?? null,
    rivals: onTeamA ? teamB(match) : teamA(match),
    myScore: onTeamA ? match.reporter_score : match.opponent_score,
    rivalScore: onTeamA ? match.opponent_score : match.reporter_score,
    delta: match.elo_delta === null ? null : won ? match.elo_delta : -match.elo_delta,
  };
}

export function TeamAvatars({ players, size = "default" }: { players: PlayerSummary[]; size?: "sm" | "default" | "lg" }) {
  return (
    <div className="flex shrink-0 -space-x-2">
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
      <TeamAvatars players={p.rivals} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
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
          {!confirmed && <StatusBadge status={match.status} />}
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold tabular-nums">
          {p.myScore}-{p.rivalScore}
        </div>
        {p.delta !== null && (
          <div className={cn("text-xs font-semibold tabular-nums", p.delta >= 0 ? "text-success" : "text-destructive")}>
            {signed(p.delta)} ELO
          </div>
        )}
      </div>
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
      <div className="hidden sm:flex">
        <TeamAvatars players={players} size="sm" />
      </div>
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

/** Fila neutral para el historial general: ganador · marcador · perdedor. */
export function MatchRow({ match }: { match: MatchWithPlayers }) {
  const teamAWon = match.reporter_score > match.opponent_score;
  const [winners, losers] = teamAWon ? [teamA(match), teamB(match)] : [teamB(match), teamA(match)];
  const [winScore, loseScore] = teamAWon
    ? [match.reporter_score, match.opponent_score]
    : [match.opponent_score, match.reporter_score];
  const delta = match.elo_delta;

  return (
    <li className="px-4 py-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Side players={winners} winner delta={delta} align="left" />
        <div className="text-center">
          <div className="text-lg font-bold tabular-nums">
            {winScore}
            <span className="mx-1 text-muted-foreground">-</span>
            {loseScore}
          </div>
          <div className="flex items-center justify-center gap-1 text-[0.7rem] text-muted-foreground">
            <ModeBadge mode={match.mode} />
            {formatDate(match.resolved_at ?? match.created_at)}
          </div>
        </div>
        <Side players={losers} winner={false} delta={delta === null ? null : -delta} align="right" />
      </div>
    </li>
  );
}
