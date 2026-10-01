import type { PlayerSummary } from "./types";

const TIME_ZONE = "America/Argentina/Buenos_Aires";

export function fullName(p: Pick<PlayerSummary, "first_name" | "last_name">) {
  return `${p.first_name} ${p.last_name}`;
}

export function initials(p: Pick<PlayerSummary, "first_name" | "last_name">) {
  return `${p.first_name.charAt(0)}${p.last_name.charAt(0)}`.toUpperCase();
}

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

export function formatDate(iso: string) {
  return dateFormatter.format(new Date(iso));
}

export function signed(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

export function daysAgoIso(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export type Reign = { started_at: string; ended_at: string | null };

/** Días completos acumulados como #1 (el reinado abierto cuenta hasta ahora). */
export function reignDays(reigns: Reign[]) {
  const now = Date.now();
  const ms = reigns.reduce(
    (sum, r) => sum + ((r.ended_at ? Date.parse(r.ended_at) : now) - Date.parse(r.started_at)),
    0,
  );
  return Math.floor(ms / 86_400_000);
}

/** Link al perfil de un jugador (el propio va a /perfil). */
export function playerHref(playerId: string, viewerId: string) {
  return playerId === viewerId ? "/perfil" : `/jugador/${playerId}`;
}

const shortDateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  timeZone: TIME_ZONE,
});

/** "12 sept" */
export function formatShortDate(iso: string | number) {
  return shortDateFormatter.format(new Date(iso));
}

/** Momento actual en ms (para pasarlo desde el servidor a componentes que no pueden llamar a Date.now al renderizar). */
export function nowMs() {
  return Date.now();
}
