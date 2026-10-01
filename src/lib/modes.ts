import type { Mode } from "./types";

export const MODE_LABEL: Record<Mode, string> = {
  singles: "1 vs 1",
  doubles: "2 vs 2",
};

export const MODE_SHORT: Record<Mode, string> = {
  singles: "1v1",
  doubles: "2v2",
};

/** Valor del query param `?modo=` en la URL. */
export function parseMode(value: string | string[] | undefined): Mode | null {
  if (value === "2v2") return "doubles";
  if (value === "1v1") return "singles";
  return null;
}
