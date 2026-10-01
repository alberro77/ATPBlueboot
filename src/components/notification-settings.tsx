"use client";

import { useState, useTransition } from "react";
import { Bell, BellOff, BellRing, Loader2, Send, Swords, Inbox } from "lucide-react";
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
    <section className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
          <Bell className="size-4" />
        </span>
        Notificaciones
      </h2>

      {!keyConfigured ? (
        <Notice>Las notificaciones todavía no están configuradas en esta versión de la app.</Notice>
      ) : !supported ? (
        <Notice>Tu navegador no permite notificaciones. Probá desde Chrome, Edge, Firefox o Safari actualizados.</Notice>
      ) : needsInstall ? (
        <Notice>
          En iPhone, primero agregá la app a la pantalla de inicio (<b>Compartir → Agregar a inicio</b>) y abrila desde
          ahí. Después podés activar las notificaciones.
        </Notice>
      ) : blocked ? (
        <Notice>
          Bloqueaste las notificaciones para este sitio. Para volver a activarlas, habilitalas desde la configuración
          del navegador o de la app.
        </Notice>
      ) : (
        <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              on ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
            )}
          >
            {on ? <BellRing className="size-5" /> : <BellOff className="size-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{on ? "Activadas en este dispositivo" : "Desactivadas en este dispositivo"}</p>
            <p className="text-xs text-muted-foreground">
              {on ? "Te avisamos aunque no tengas la app abierta." : "Activalas para enterarte al instante."}
            </p>
          </div>
          {subscribed !== null && (
            <Button size="sm" variant={on ? "outline" : "default"} disabled={busy} onClick={on ? disable : enable}>
              {busy && <Loader2 className="animate-spin" />}
              {on ? "Desactivar" : "Activar"}
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase">Qué avisos querés recibir</p>
        <Switch
          icon={Inbox}
          title="Partidos para confirmar"
          description="Cuando alguien carga un partido contra vos."
          checked={prefs.matchPending}
          onChange={() => togglePref("matchPending")}
        />
        <Switch
          icon={Swords}
          title="Desafíos"
          description="Cuando alguien te desafía a jugar."
          checked={prefs.challenges}
          onChange={() => togglePref("challenges")}
        />
        <p className="text-xs text-muted-foreground">
          Estos ajustes valen para todos tus dispositivos. Igual vas a ver todo en la app, en Mis partidos.
        </p>
      </div>

      {on && (
        <Button variant="outline" size="sm" className="justify-self-start" disabled={testing} onClick={test}>
          {testing ? <Loader2 className="animate-spin" /> : <Send />}
          Enviar notificación de prueba
        </Button>
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
  description,
  checked,
  onChange,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
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
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
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
