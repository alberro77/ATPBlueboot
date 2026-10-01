"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, Crown, Flame, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { buttonVariants } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/player-avatar";
import { signed } from "@/lib/format";
import { SEASON_SEEN_COOKIE, type SeasonSummary } from "@/lib/seasons";
import { cn } from "@/lib/utils";

/** Se muestra una vez (por dispositivo) al empezar el mes: resumen de la temporada que terminó. */
export function SeasonRecap({ summary, viewerId }: { summary: SeasonSummary; viewerId: string }) {
  const [open, setOpen] = useState(true);
  const month = summary.label.split(" ")[0].toLowerCase();
  const myIndex = summary.standings.findIndex((p) => p.player.id === viewerId);
  const me = summary.standings[myIndex];
  const champ = summary.champion;

  function dismiss() {
    document.cookie = `${SEASON_SEEN_COOKIE}=${summary.key}; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
  }

  const chips = [
    summary.topAtClose && {
      icon: Crown,
      tone: "text-amber-500",
      text: `#1 al cierre: ${summary.topAtClose.player.id === viewerId ? "vos" : summary.topAtClose.player.nickname}`,
    },
    summary.mostActive && {
      icon: Activity,
      tone: "text-primary",
      text: `Más activo: ${summary.mostActive.player.nickname} (${summary.mostActive.games})`,
    },
    summary.bestStreak && {
      icon: Flame,
      tone: "text-orange-500",
      text: `Mejor racha: ${summary.bestStreak.player.nickname} (${summary.bestStreak.bestStreak})`,
    },
    summary.upset && {
      icon: Zap,
      tone: "text-violet-500",
      text: `Sorpresa: ${summary.upset.winners.map((p) => p.nickname).join(" & ")} con ${Math.round(summary.upset.chance * 100)}%`,
    },
  ].filter(Boolean) as { icon: typeof Crown; tone: string; text: string }[];

  return (
    <Dialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden p-0 sm:max-w-sm">
        <div className="bg-brand px-5 pt-6 pb-5 text-center text-white">
          <p className="text-xs font-semibold tracking-widest text-white/75 uppercase">Fin de temporada</p>
          <DialogTitle className="text-2xl font-extrabold text-white">¡Terminó {month}! 🏆</DialogTitle>
          <DialogDescription className="text-sm text-white/80">
            {summary.totalMatches} partidos entre {summary.standings.length} jugadores
          </DialogDescription>
          {champ ? (
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <div className="relative">
                <PlayerAvatar player={champ.player} size={76} className="ring-4 ring-amber-300" />
                <Crown className="absolute -top-4 left-1/2 size-7 -translate-x-1/2 fill-amber-300 text-amber-200" />
              </div>
              <p className="text-lg font-extrabold">{champ.player.id === viewerId ? "¡Sos el campeón!" : champ.player.nickname}</p>
              <p className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold">
                Campeón del mes · {signed(champ.change)} ELO
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/80">Nadie llegó a 3 partidos, así que no hubo campeón.</p>
          )}
        </div>

        <div className="grid gap-3 p-5">
          <div className="rounded-xl bg-accent/60 p-3 text-center text-sm">
            {me ? (
              <>
                Terminaste <b>#{myIndex + 1}</b> · {me.games} partidos ·{" "}
                <b className={cn(me.change > 0 ? "text-success" : me.change < 0 ? "text-destructive" : "")}>
                  {me.change === 0 ? "±0" : signed(me.change)} ELO
                </b>
              </>
            ) : (
              <span className="text-muted-foreground">No jugaste esta temporada. ¡Este mes es tu revancha!</span>
            )}
          </div>
          {chips.length > 0 && (
            <ul className="grid gap-1.5 text-sm">
              {chips.map(({ icon: Icon, tone, text }) => (
                <li key={text} className="flex items-center gap-2">
                  <Icon className={cn("size-4 shrink-0", tone)} />
                  <span className="truncate">{text}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/temporadas/${summary.key}`} onClick={dismiss} className={cn(buttonVariants({ size: "lg" }), "bg-brand w-full")}>
            Ver resumen completo
          </Link>
          <button type="button" onClick={dismiss} className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Cerrar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
