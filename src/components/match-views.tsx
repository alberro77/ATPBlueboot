import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/player-avatar";
import { formatDate, fullName, signed } from "@/lib/format";
import type { MatchStatus, MatchWithPlayers, PlayerSummary } from "@/lib/types";
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

/** Un partido visto desde un jugador: rival, resultado y ELO ganado/perdido. */
export function perspective(match: MatchWithPlayers, playerId: string) {
  const isReporter = match.reporter_id === playerId;
  const won = match.winner_id === playerId;
  return {
    won,
    rival: isReporter ? match.opponent : match.reporter,
    myScore: isReporter ? match.reporter_score : match.opponent_score,
    rivalScore: isReporter ? match.opponent_score : match.reporter_score,
    delta: match.elo_delta === null ? null : won ? match.elo_delta : -match.elo_delta,
  };
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
      <PlayerAvatar player={p.rival} />
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
          <span className="truncate text-sm">vs {p.rival.nickname}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {formatDate(match.created_at)}
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
  player,
  score,
  winner,
  delta,
  align,
}: {
  player: PlayerSummary;
  score: number;
  winner: boolean;
  delta: number | null;
  align: "left" | "right";
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", align === "right" && "flex-row-reverse text-right")}>
      <PlayerAvatar player={player} size="sm" className="hidden sm:flex" />
      <div className="min-w-0">
        <div className={cn("truncate text-sm", winner ? "font-bold" : "text-muted-foreground")}>
          {player.nickname}
        </div>
        <div className="hidden truncate text-xs text-muted-foreground sm:block">{fullName(player)}</div>
        {delta !== null && (
          <div className={cn("text-xs font-semibold tabular-nums", delta >= 0 ? "text-success" : "text-destructive")}>
            {signed(delta)}
          </div>
        )}
      </div>
      <span className="sr-only">{score} puntos</span>
    </div>
  );
}

/** Fila neutral para el historial general: jugador izquierdo · marcador · jugador derecho. */
export function MatchRow({ match }: { match: MatchWithPlayers }) {
  const winnerIsReporter = match.winner_id === match.reporter_id;
  const [left, right] = winnerIsReporter
    ? [
        { player: match.reporter, score: match.reporter_score },
        { player: match.opponent, score: match.opponent_score },
      ]
    : [
        { player: match.opponent, score: match.opponent_score },
        { player: match.reporter, score: match.reporter_score },
      ];
  const delta = match.elo_delta;

  return (
    <li className="px-4 py-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Side player={left.player} score={left.score} winner delta={delta} align="left" />
        <div className="text-center">
          <div className="text-lg font-bold tabular-nums">
            {left.score}
            <span className="mx-1 text-muted-foreground">-</span>
            {right.score}
          </div>
          <div className="text-[0.7rem] text-muted-foreground">
            {formatDate(match.resolved_at ?? match.created_at)}
          </div>
        </div>
        <Side player={right.player} score={right.score} winner={false} delta={delta === null ? null : -delta} align="right" />
      </div>
    </li>
  );
}
