"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlueBootIcon } from "@/components/brand/logo";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed";
const noopSubscribe = () => () => {};

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone/iPad: no existe el prompt de instalación, hay que explicar "Agregar a inicio". */
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/**
 * Registra el service worker y muestra un aviso para instalar la app en el celular.
 * Android/Chrome: botón "Instalar". iOS/Safari: instrucciones para "Agregar a inicio".
 */
export function InstallApp() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [closed, setClosed] = useState(false);
  const dismissed = useSyncExternalStore(noopSubscribe, readDismissed, () => true);
  const installed = useSyncExternalStore(noopSubscribe, isStandalone, () => true);
  const ios = useSyncExternalStore(noopSubscribe, isIos, () => false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setPrompt(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed || closed || (!prompt && !ios)) return null;

  function close() {
    setClosed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    if (outcome === "accepted") setClosed(true);
  }

  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl border border-primary/30 bg-accent p-3 text-accent-foreground">
      <BlueBootIcon className="size-10 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Instalá la app en tu celular</p>
        {prompt ? (
          <p className="text-xs opacity-80">Abrila desde la pantalla de inicio, a pantalla completa.</p>
        ) : (
          <p className="text-xs opacity-80">
            Tocá <Share className="inline size-3.5 align-text-top" /> <b>Compartir</b> y después{" "}
            <b>Agregar a inicio</b>.
          </p>
        )}
      </div>
      {prompt && (
        <Button size="sm" onClick={install}>
          <Download />
          Instalar
        </Button>
      )}
      <Button variant="ghost" size="icon-sm" aria-label="Cerrar" onClick={close}>
        <X />
      </Button>
    </div>
  );
}
