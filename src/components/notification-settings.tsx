"use client";

import { useState, useTransition } from "react";
import { Bell, BellRing, Loader2, Send, Swords, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendTestPush, updateNotificationPrefs } from "@/app/actions";
import { usePush } from "@/lib/use-push";
import { cn } from "@/lib/utils";

export function NotificationSettings({
  initialPrefs,
}: {
  initialPrefs: { matchPending: boolean; challenges: boolean };
}) {
  const { keyConfigured, supported, needsInstall, blocked, subscribed, busy, enable, disable } = usePush();
  const [prefs, setPrefs] = useState(initialPrefs);
  const [testing, startTesting] = useTransition();

  function togglePref(key: "matchPending" | "challenges") {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    updateNotificationPrefs(next).then((r) => {
      if (!r.ok) {
        setPrefs(prefs);
        toast.error(r.error);
      }
    });
  }

  function test() {
    startTesting(async () => {
      const r = await sendTestPush();
      if (r.ok) toast.success(r.message);
      else toast.error(r.error);
    });
  }

  const on = subscribed === true && !blocked;

  return (
    <section className="grid gap-2 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            on ? "bg-success/15 text-success" : "bg-accent text-primary",
          )}
        >
          {on ? <BellRing className="size-4" /> : <Bell className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">Notificaciones</h2>
          {on && <p className="text-xs text-muted-foreground">Activadas en este dispositivo</p>}
        </div>
        {keyConfigured && supported && !needsInstall && !blocked && subscribed !== null && (
          <Button size="sm" variant={on ? "ghost" : "default"} disabled={busy} onClick={on ? disable : enable}>
            {busy && <Loader2 className="animate-spin" />}
            {on ? "Desactivar" : "Activar"}
          </Button>
        )}
      </div>

      {!keyConfigured ? (
        <Notice>No disponibles por ahora.</Notice>
      ) : !supported ? (
        <Notice>Tu navegador no las permite.</Notice>
      ) : needsInstall ? (
        <Notice>
          En iPhone, primero agregá la app a inicio: <b>Compartir → Agregar a inicio</b>.
        </Notice>
      ) : blocked ? (
        <Notice>Están bloqueadas. Habilitalas desde la configuración del navegador.</Notice>
      ) : null}

      <div className="grid">
        <Switch
          icon={Inbox}
          title="Partidos para confirmar"
          checked={prefs.matchPending}
          onChange={() => togglePref("matchPending")}
        />
        <Switch icon={Swords} title="Desafíos" checked={prefs.challenges} onChange={() => togglePref("challenges")} />
      </div>

      {on && (
        <button
          type="button"
          disabled={testing}
          onClick={test}
          className="flex items-center gap-1.5 justify-self-start rounded-lg px-2 py-1.5 text-xs font-semibold text-primary hover:bg-accent disabled:opacity-50"
        >
          {testing ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          Probar
        </button>
      )}
    </section>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">{children}</p>;
}

function Switch({
  icon: Icon,
  title,
  checked,
  onChange,
}: {
  icon: typeof Bell;
  title: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex items-center gap-3 rounded-xl p-2 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/40"
    >
      <Icon className="size-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}
