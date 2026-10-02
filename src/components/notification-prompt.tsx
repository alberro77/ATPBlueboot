"use client";

import { useState, useSyncExternalStore } from "react";
import { BellRing, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallBannerVisible } from "@/lib/prompt-slot";
import { usePush } from "@/lib/use-push";

const SNOOZE_KEY = "pp-notif-prompt-until";
const SNOOZE_MS = 14 * 86_400_000;
const noopSubscribe = () => () => {};

function snoozed() {
  try {
    return Date.now() < Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
  } catch {
    return false;
  }
}

/** Aviso compacto para activar notificaciones. Se puede cerrar (vuelve en 2 semanas). */
export function NotificationPrompt() {
  const { keyConfigured, supported, needsInstall, blocked, subscribed, busy, enable } = usePush();
  const isSnoozed = useSyncExternalStore(noopSubscribe, snoozed, () => true);
  // Un aviso a la vez: si se está ofreciendo instalar la app, este espera.
  const waitInstall = useInstallBannerVisible();
  const [closed, setClosed] = useState(false);

  if (closed || isSnoozed || waitInstall) return null;
  // Mientras se averigua el estado (null) no se muestra nada, para evitar parpadeos.
  if (!keyConfigured || !supported || needsInstall || blocked || subscribed !== false) return null;

  function close() {
    setClosed(true);
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {}
  }

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl bg-accent py-2 pr-1.5 pl-2.5 text-accent-foreground">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <BellRing className="size-4" />
      </span>
      <p className="min-w-0 flex-1 text-sm leading-tight">
        <b>Activá los avisos</b> de partidos y desafíos
      </p>
      <Button size="sm" disabled={busy} onClick={enable}>
        {busy && <Loader2 className="animate-spin" />}
        Activar
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Ahora no" onClick={close}>
        <X />
      </Button>
    </div>
  );
}
