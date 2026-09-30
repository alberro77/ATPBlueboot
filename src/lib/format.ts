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
