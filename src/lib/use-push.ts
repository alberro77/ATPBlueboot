"use client";

import { useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { removePushSubscription, savePushSubscription } from "@/app/actions";

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

/** Estado de las notificaciones push en este dispositivo y las acciones para activarlas o desactivarlas. */
export function usePush() {
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
  // null = todavía no se sabe.
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [busy, startBusy] = useTransition();

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
          (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey }));

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

  return {
    /** El servidor tiene configurada la clave pública. */
    keyConfigured: Boolean(PUBLIC_KEY),
    supported,
    needsInstall,
    /** El usuario bloqueó las notificaciones en el navegador. */
    blocked: permission === "denied",
    subscribed,
    busy,
    enable,
    disable,
  };
}
