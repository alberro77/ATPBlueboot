"use client";

import { Trophy } from "lucide-react";
import { TeamAvatars } from "@/components/match-views";
import type { PlayerSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export type Side = "mine" | "theirs";

type Team = { label: string; players: PlayerSummary[]; deltaIfWin: number };

/** Dos tarjetas grandes para tocar: el lado ganador se marca con el trofeo. */
export function WinnerPicker({
  mine,
  theirs,
  value,
  onChange,
}: {
  mine: Team;
  theirs: Team;
  value: Side | null;
  onChange: (side: Side) => void;
}) {
  // Puntos que se transfieren según quién ganó (el perdedor resta lo mismo).
  const transfer = value === null ? null : (value === "mine" ? mine : theirs).deltaIfWin;
  return (
    <div role="radiogroup" aria-label="¿Quién ganó?" className="relative grid grid-cols-2 gap-3">
      <TeamCard side="mine" team={mine} value={value} transfer={transfer} onChange={onChange} />
      <TeamCard side="theirs" team={theirs} value={value} transfer={transfer} onChange={onChange} />
      <span className="pointer-events-none absolute top-1/2 left-1/2 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-background bg-foreground text-[0.7rem] font-black text-background">
        VS
      </span>
    </div>
  );
}

function TeamCard({
  side,
  team,
  value,
  transfer,
  onChange,
}: {
  side: Side;
  team: Team;
  value: Side | null;
  transfer: number | null;
  onChange: (side: Side) => void;
}) {
  const selected = value === side;
  const lost = value !== null && !selected;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={() => onChange(side)}
      className={cn(
        "relative flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border-2 bg-card p-3 text-center transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.98]",
        selected && "border-primary bg-accent shadow-lg shadow-primary/15",
        lost && "opacity-55",
        !value && "hover:border-primary/50",
      )}
    >
      <span
        className={cn(
          "absolute top-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-bold uppercase transition-all",
          selected ? "bg-amber-400 text-amber-950" : "scale-90 opacity-0",
        )}
      >
        <Trophy className="size-3" /> Ganó
      </span>
      <TeamAvatars players={team.players} size={52} className="mt-4" />
      <span className="line-clamp-2 text-sm leading-tight font-bold">{team.label}</span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
          selected ? "bg-success/15 text-success" : lost ? "bg-destructive/10 text-destructive" : "text-muted-foreground",
        )}
      >
        {transfer === null ? `+${team.deltaIfWin} si gana` : selected ? `+${transfer} ELO` : `−${transfer} ELO`}
      </span>
    </button>
  );
}
