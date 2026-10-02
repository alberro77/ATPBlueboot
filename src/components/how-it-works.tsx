"use client";

import { useState } from "react";
import { CalendarDays, CheckCheck, Clock, Globe, Info, Sparkles, Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const RULES = [
  { icon: Sparkles, title: "AURA", text: "Tu puntaje. Arrancás en 1000. Ganarle a alguien mejor suma más." },
  { icon: Globe, title: "3 rankings", text: "Global cuenta todo. 1 vs 1 y 2 vs 2, cada uno por separado." },
  { icon: CheckCheck, title: "Confirmación", text: "Tu rival confirma el partido y recién ahí suma." },
  { icon: Trophy, title: "Clasificar", text: "Entrás al ranking con 3 partidos." },
  { icon: Clock, title: "Inactividad", text: "Después de 7 días sin jugar, −10 por semana." },
  { icon: CalendarDays, title: "Temporadas", text: "Cada mes gana quien más AURA suma." },
];

/** Botón ⓘ que abre las reglas del juego en un panel. Reemplaza los textos explicativos sueltos. */
export function HowItWorks() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cómo funciona"
        className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
      >
        <Info className="size-5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-auto bottom-0 left-0 max-w-none translate-x-0 translate-y-0 gap-4 rounded-t-3xl rounded-b-none pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-sm sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
          <div className="mx-auto -mt-1 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
          <DialogHeader>
            <DialogTitle className="text-lg">Cómo funciona</DialogTitle>
          </DialogHeader>
          <ul className="grid gap-3">
            {RULES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 text-sm">
                  <span className="block font-semibold">{title}</span>
                  <span className="block text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
