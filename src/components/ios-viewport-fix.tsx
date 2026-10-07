"use client";

import { useEffect } from "react";

const isIOS = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) || (/Mac/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

/**
 * En iPhone, al cerrarse el teclado a veces la barra de abajo (position: fixed)
 * queda flotando a mitad de pantalla hasta que se vuelve a scrollear.
 * Un scroll mínimo e invisible obliga a Safari a recalcular la posición.
 */
export function IosViewportFix() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !isIOS()) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const nudge = () => {
      clearTimeout(timer);
      // Se espera a que termine la animación del teclado.
      timer = setTimeout(() => {
        const { scrollX: x, scrollY: y } = window;
        window.scrollTo(x, y > 0 ? y - 1 : y + 1);
        window.scrollTo(x, y);
      }, 350);
    };

    const onFocusOut = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches("input, textarea, select, [contenteditable]")) nudge();
    };
    let lastHeight = vv.height;
    const onResize = () => {
      if (vv.height > lastHeight + 80) nudge(); // el teclado se cerró
      lastHeight = vv.height;
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") nudge();
    };

    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("visibilitychange", onVisible);
    vv.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("visibilitychange", onVisible);
      vv.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
