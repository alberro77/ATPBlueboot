"use client";

import { useSyncExternalStore } from "react";

// Estado compartido: si el aviso de instalar está en pantalla, el de notificaciones espera
// (se muestra un solo aviso a la vez).
let installVisible = false;
const listeners = new Set<() => void>();

export function setInstallBannerVisible(visible: boolean) {
  if (installVisible === visible) return;
  installVisible = visible;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallBannerVisible() {
  return useSyncExternalStore(subscribe, () => installVisible, () => false);
}
