import { Percent } from "lucide-react";
import { winProbability } from "@/lib/elo";
import { cn } from "@/lib/utils";

/**
 * Probabilidad de ganar según el AURA (la misma fórmula del ranking).
 * Barra partida: tu lado en azul, el rival en gris, con el % de cada uno.
 */
export function WinChance({
  myElo,
  rivalElo,
  myLabel = "Vos",
  rivalLabel,
  title = "Chances de ganar",
  team = false,
  className,
}: {
  myElo: number;
  rivalElo: number;
  myLabel?: string;
  rivalLabel: string;
  title?: string;
  /** Texto en plural (2v2). */
  team?: boolean;
  className?: string;
}) {
  const mine = Math.round(winProbability(myElo, rivalElo) * 100);
  const theirs = 100 - mine;
  const verdict =
    mine >= 65
      ? team
        ? "Son favoritos 💪"
        : "Sos favorito 💪"
      : mine <= 35
        ? "Viene difícil… ¡a dar la sorpresa! 🎯"
        : "Partido parejo 🤝";

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 font-semibold text-muted-foreground">
          <Percent className="size-3.5" /> {title}
        </span>
        <span className="font-medium text-muted-foreground">{verdict}</span>
      </div>
      <div className="flex h-3 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`${myLabel} ${mine}%, ${rivalLabel} ${theirs}%`}>
        <div className="rounded-l-full bg-primary transition-[width] duration-500" style={{ width: `${mine}%` }} />
        <div className="rounded-r-full bg-muted-foreground/25 transition-[width] duration-500" style={{ width: `${theirs}%` }} />
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="min-w-0 truncate">
          <b className="tabular-nums">{mine}%</b> <span className="text-muted-foreground">{myLabel}</span>
        </span>
        <span className="min-w-0 truncate text-right">
          <span className="text-muted-foreground">{rivalLabel}</span> <b className="tabular-nums">{theirs}%</b>
        </span>
      </div>
    </div>
  );
}
