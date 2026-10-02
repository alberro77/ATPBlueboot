import { Flame } from "lucide-react";
import { ON_FIRE_STREAK } from "@/lib/elo";
import { cn } from "@/lib/utils";

/**
 * Llama con las victorias seguidas. Solo aparece desde ON_FIRE_STREAK y se
 * pone más intensa cuanto más larga es la racha.
 */
export function StreakBadge({ streak, className }: { streak: number; className?: string }) {
  if (streak < ON_FIRE_STREAK) return null;
  const blazing = streak >= ON_FIRE_STREAK + 2;
  return (
    <span
      title={`${streak} victorias seguidas`}
      aria-label={`${streak} victorias seguidas`}
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 align-middle text-[0.7rem] leading-none font-extrabold tabular-nums",
        blazing
          ? "bg-linear-to-r from-orange-500 to-red-500 text-white shadow-sm shadow-orange-500/40"
          : "bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-300",
        className,
      )}
    >
      <Flame className={cn("size-3", blazing ? "fill-yellow-300 text-yellow-200" : "fill-orange-400")} />
      {streak}
    </span>
  );
}
