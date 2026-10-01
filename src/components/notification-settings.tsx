"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { Bell, BellOff, BellRing, Loader2, Send, Swords, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
  updateNotificationPrefs,
} from "@/app/actions";
import { cn } from "@/lib/utils";

// Se limpian espacios, saltos de línea y comillas que se cuelan al pegar la variable en Vercel.
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim().replace(/^["']+|["']+$/g, "").trim();
const noopSubscribe = () => () => {};

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function NotificationSettings({
  initialPrefs,
}: {
  initialPrefs: { matchPending: boolean; challenges: boolean };
}) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window,
    () => true,
  );
  // En iPhone las notificaciones solo funcionan con la app agregada a la pantalla de inicio.
  const needsInstall = useSyncExternalStore(noopSubscribe, () => isIos() && !isStandalone(), () => false);
  const permission = useSyncExternalStore(
    noopSubscribe,
    () => ("Notification" in window ? Notification.permission : "denied"),
    () => "default",
  );

  const [, rerender] = useState(0);
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [busy, startBusy] = useTransition();
  const [testing, startTesting] = useTransition();

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker
      .getRegistration()
      .then((reg) => reg?.pushManager.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => setSubscribed(false));
  }, [supported]);

  function enable() {
    startBusy(async () => {
      // Se anota en qué paso falla para poder mostrar la causa real.
      let step = "pedir permiso";
      try {
        const result = await Notification.requestPermission();
        rerender((n) => n + 1);
        if (result !== "granted") {
          toast.error("Para recibir avisos tenés que permitir las notificaciones en tu navegador.");
          return;
        }
        step = "registrar el servicio en segundo plano";
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;

        step = "leer la clave de notificaciones de la app";
        const serverKey = urlBase64ToUint8Array(PUBLIC_KEY!);
        if (serverKey.length !== 65) {
          throw new Error(
            "La clave NEXT_PUBLIC_VAPID_PUBLIC_KEY cargada en Vercel no es válida (tiene " +
              serverKey.length +
              " bytes y debería tener 65). Revisá que sea la clave pública, completa y sin espacios.",
          );
        }

        step = "conectar con el servicio de notificaciones del navegador";
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: serverKey,
          }));

        step = "guardar este dispositivo";
        const json = sub.toJSON();
        const saved = await savePushSubscription({ endpoint: json.endpoint ?? "", keys: json.keys });
        if (!saved.ok) {
          toast.error("No se pudo guardar este dispositivo.", { description: saved.error });
          return;
        }
        setSubscribed(true);
        toast.success("¡Listo! Vas a recibir avisos en este dispositivo.");
      } catch (e) {
        const err = e as { name?: string; message?: string };
        console.error("Notificaciones: falló al " + step, e);
        toast.error("No se pudieron activar las notificaciones.", {
          description: `Falló al ${step}: ${err.name ?? "Error"}${err.message ? " — " + err.message : ""}`,
          duration: 15000,
        });
      }
    });
  }

  function disable() {
    startBusy(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await removePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setSubscribed(false);
        toast.success("Desactivaste las notificaciones en este dispositivo.");
      } catch {
        toast.error("No se pudieron desactivar.");
      }
    });
  }

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

  const blocked = permission === "denied";
  const on = subscribed === true && !blocked;

  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
          <Bell className="size-4" />
        </span>
        Notificaciones
      </h2>

      {!PUBLIC_KEY ? (
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
