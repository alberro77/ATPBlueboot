import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlayerAvatar } from "@/components/player-avatar";
import { fullName } from "@/lib/format";
import { MIN_MATCHES_TO_RANK } from "@/lib/elo";
import type { Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const PODIUM = [
  "bg-amber-400 text-amber-950",
  "bg-slate-300 text-slate-800",
  "bg-orange-300 text-orange-950",
];

function Position({ index, ranked }: { index: number; ranked: boolean }) {
  if (!ranked) return <span className="text-muted-foreground">–</span>;
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-full text-sm font-bold tabular-nums",
        PODIUM[index] ?? "text-muted-foreground",
      )}
    >
      {index + 1}
    </span>
  );
}

export function RankingTable({
  players,
  currentUserId,
  ranked,
}: {
  players: Profile[];
  currentUserId: string;
  ranked: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Jugador</TableHead>
            <TableHead className="hidden text-center sm:table-cell">PJ</TableHead>
            <TableHead className="text-center">V/D</TableHead>
            <TableHead className="pr-4 text-right">ELO</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {players.map((p, i) => (
            <TableRow key={p.id} className={cn(p.id === currentUserId && "bg-accent/60 hover:bg-accent")}>
              <TableCell className="text-center">
                <Position index={i} ranked={ranked} />
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <PlayerAvatar player={p} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {p.nickname}
                      {p.id === currentUserId && (
                        <span className="ml-1.5 text-xs font-normal text-primary">(vos)</span>
                      )}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {fullName(p)}
                      <span className="sm:hidden"> · {p.matches_played} PJ</span>
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden text-center tabular-nums sm:table-cell">
                {ranked ? p.matches_played : `${p.matches_played}/${MIN_MATCHES_TO_RANK}`}
              </TableCell>
              <TableCell className="text-center tabular-nums">
                <span className="text-success">{p.wins}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-destructive">{p.losses}</span>
              </TableCell>
              <TableCell className="pr-4 text-right text-base font-bold tabular-nums">{p.elo}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
