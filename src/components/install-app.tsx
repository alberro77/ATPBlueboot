"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlueBootIcon } from "@/components/brand/logo";
import { setInstallBannerVisible } from "@/lib/prompt-slot";

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

  const visible = !(installed || dismissed || closed || (!prompt && !ios));
  useEffect(() => {
    setInstallBannerVisible(visible);
    return () => setInstallBannerVisible(false);
  }, [visible]);

  if (!visible) return null;

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
    <div className="mb-4 flex items-center gap-3 rounded-2xl bg-accent py-2 pr-1.5 pl-2.5 text-accent-foreground">
      <BlueBootIcon className="size-8 shrink-0" />
      <p className="min-w-0 flex-1 text-sm leading-tight">
        {prompt ? (
          <b>Instalá la app</b>
        ) : (
          <>
            <b>Instalá la app:</b> <Share className="inline size-3.5 align-text-top" /> → Agregar a inicio
          </>
        )}
      </p>
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
