"use client";

import { BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePush } from "@/lib/use-push";

/**
 * Aviso del home para activar las notificaciones. Se muestra mientras este
 * dispositivo no las tenga activadas y se puedan activar (no si el navegador
 * las bloqueó, no las soporta o falta instalar la app en iPhone).
 */
export function NotificationPrompt() {
  const { keyConfigured, supported, needsInstall, blocked, subscribed, busy, enable } = usePush();

  // Mientras se averigua el estado (null) no se muestra nada, para evitar parpadeos.
  if (!keyConfigured || !supported || needsInstall || blocked || subscribed !== false) return null;

  return (
    <section className="mb-5 flex items-center gap-3 rounded-2xl border border-primary/30 bg-accent p-3 text-accent-foreground shadow-sm">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <BellRing className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">Activá las notificaciones</p>
        <p className="text-xs opacity-80">Enterate al instante cuando te cargan un partido o te desafían.</p>
      </div>
      <Button size="sm" className="shrink-0" disabled={busy} onClick={enable}>
        {busy && <Loader2 className="animate-spin" />}
        Activar
      </Button>
    </section>
  );
}
