"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import { formatShortDate, signed } from "@/lib/format";
import type { Mode } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Un cambio de AURA: partido (1v1/2v2) o penalización por inactividad. */
export type EloPoint = {
  t: string;
  elo: number;
  delta: number;
  kind: "start" | "match" | "decay";
  mode: Mode | null;
};

const RANGES = [
  { key: "1m", label: "1 mes", days: 30 },
  { key: "3m", label: "3 meses", days: 90 },
  { key: "all", label: "Todo", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const HEIGHT = 190;
const PAD = { top: 16, right: 52, bottom: 26, left: 40 };

function describe(p: EloPoint) {
  if (p.kind === "start") return "Inicio";
  if (p.kind === "decay") return "Inactividad";
  return p.mode === "doubles" ? "Partido 2v2" : "Partido 1v1";
}

/** Ticks "lindos" (múltiplos de 10/25/50/100) que cubren [min, max]. */
function niceTicks(min: number, max: number) {
  const span = Math.max(max - min, 20);
  const step = [10, 25, 50, 100, 200].find((s) => span / s <= 4) ?? 500;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);
  return { lo, hi, ticks };
}

export function EloChart({ points, nowMs, title = "Evolución del AURA" }: { points: EloPoint[]; nowMs: number; title?: string }) {
  const [range, setRange] = useState<RangeKey>("all");
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    const days = RANGES.find((r) => r.key === range)!.days;
    if (days === null) return points;
    const from = nowMs - days * 86_400_000;
    const inRange = points.filter((p) => Date.parse(p.t) >= from);
    // Arranca desde el valor que tenía al inicio del período.
    const before = points.filter((p) => Date.parse(p.t) < from).at(-1);
    return before ? [{ ...before, t: new Date(from).toISOString(), kind: "start" as const, delta: 0 }, ...inRange] : inRange;
  }, [points, range, nowMs]);

  if (points.length < 2) {
    return (
      <section className="grid gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <TrendingUp className="size-4 text-primary" /> {title}
        </h2>
        <div className="rounded-2xl border border-dashed border-primary/25 bg-card/60 px-6 py-8 text-center text-sm text-muted-foreground">
          Cuando haya partidos confirmados, acá vas a ver cómo sube (o baja) el AURA. 📈
        </div>
      </section>
    );
  }

  const innerW = Math.max(width - PAD.left - PAD.right, 10);
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const times = data.map((p) => Date.parse(p.t));
  const t0 = times[0];
  const t1 = Math.max(times.at(-1)!, t0 + 1);
  const elos = data.map((p) => p.elo);
  const { lo, hi, ticks } = niceTicks(Math.min(...elos), Math.max(...elos));
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo || 1)) * innerH;

  const coords = data.map((p, i) => ({ px: x(times[i]), py: y(p.elo) }));
  const line = coords.map((c, i) => `${i ? "L" : "M"}${c.px.toFixed(1)},${c.py.toFixed(1)}`).join(" ");
  const area = `${line} L${coords.at(-1)!.px.toFixed(1)},${PAD.top + innerH} L${coords[0].px.toFixed(1)},${PAD.top + innerH} Z`;
  const last = data.at(-1)!;
  const change = last.elo - data[0].elo;
  const shown = active !== null && data[active] ? active : null;

  function nearest(clientX: number, rect: DOMRect) {
    const px = clientX - rect.left;
    let best = 0;
    coords.forEach((c, i) => {
      if (Math.abs(c.px - px) < Math.abs(coords[best].px - px)) best = i;
    });
    return best;
  }

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold">
          <TrendingUp className="size-4 text-primary" /> {title}
        </h2>
        <div role="radiogroup" aria-label="Período" className="flex rounded-full bg-muted p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={range === r.key}
              onClick={() => {
                setRange(r.key);
                setActive(null);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors",
                range === r.key && "bg-card text-foreground shadow-sm",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-3 shadow-sm">
        <p className="mb-1 px-1 text-sm text-muted-foreground">
          <span className="text-2xl font-extrabold text-foreground">{last.elo}</span>{" "}
          <span className={cn("font-semibold", change > 0 ? "text-success" : change < 0 ? "text-destructive" : "")}>
            {change === 0 ? "sin cambios" : `${signed(change)}`}
          </span>{" "}
          en el período
        </p>

        <div ref={wrapRef} className="relative">
          {width > 0 && (
            <svg
              width={width}
              height={HEIGHT}
              role="img"
              aria-label={`${title}: de ${data[0].elo} a ${last.elo}. Usá las flechas para recorrer los puntos.`}
              tabIndex={0}
              className="touch-pan-y outline-none focus-visible:rounded-lg focus-visible:ring-3 focus-visible:ring-ring/40"
              onPointerMove={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
              onPointerDown={(e) => setActive(nearest(e.clientX, e.currentTarget.getBoundingClientRect()))}
              onPointerLeave={() => setActive(null)}
              onBlur={() => setActive(null)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  const dir = e.key === "ArrowLeft" ? -1 : 1;
                  setActive((a) => Math.min(data.length - 1, Math.max(0, (a ?? data.length - 1) + (a === null ? 0 : dir))));
                }
                if (e.key === "Escape") setActive(null);
              }}
            >
              {/* Grilla recesiva y ticks del eje Y. */}
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={PAD.left} x2={PAD.left + innerW} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth={1} />
                  <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                    {v}
                  </text>
                </g>
              ))}
              {/* Fechas de inicio y fin del período. */}
              <text x={PAD.left} y={HEIGHT - 6} className="fill-muted-foreground text-[10px]">
                {formatShortDate(times[0])}
              </text>
              <text x={PAD.left + innerW} y={HEIGHT - 6} textAnchor="end" className="fill-muted-foreground text-[10px]">
                {formatShortDate(times.at(-1)!)}
              </text>

              <path d={area} fill="var(--chart-1)" opacity={0.1} />
              <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

              {/* Valor final con etiqueta directa. */}
              <circle cx={coords.at(-1)!.px} cy={coords.at(-1)!.py} r={4} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={2} />
              <text
                x={coords.at(-1)!.px + 8}
                y={coords.at(-1)!.py}
                dy="0.32em"
                className="fill-foreground text-[11px] font-bold tabular-nums"
              >
                {last.elo}
              </text>

              {shown !== null && (
                <g pointerEvents="none">
                  <line
                    x1={coords[shown].px}
                    x2={coords[shown].px}
                    y1={PAD.top}
                    y2={PAD.top + innerH}
                    className="stroke-muted-foreground/50"
                    strokeWidth={1}
                  />
                  <circle cx={coords[shown].px} cy={coords[shown].py} r={5} fill="var(--chart-1)" stroke="var(--card)" strokeWidth={2} />
                </g>
              )}
            </svg>
          )}

          {shown !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl border bg-popover px-3 py-2 text-xs whitespace-nowrap shadow-lg"
              style={{ left: Math.min(Math.max(coords[shown].px, 72), width - 72) }}
            >
              <p className="text-base font-extrabold tabular-nums">{data[shown].elo}</p>
              <p className="text-muted-foreground">{formatShortDate(data[shown].t)}</p>
              {data[shown].kind !== "start" && (
                <p className="mt-0.5 flex items-center gap-1.5">
                  <span aria-hidden className="h-0.5 w-3 rounded-full bg-chart-1" />
                  {describe(data[shown])}{" "}
                  <b className={data[shown].delta >= 0 ? "text-success" : "text-destructive"}>
                    {signed(data[shown].delta)}
                  </b>
                </p>
              )}
            </div>
          )}
        </div>

        <details className="mt-1 px-1 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver datos</summary>
          <table className="mt-2 w-full tabular-nums">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 text-left font-medium">Fecha</th>
                <th className="py-1 text-left font-medium">Motivo</th>
                <th className="py-1 text-right font-medium">Cambio</th>
                <th className="py-1 text-right font-medium">AURA</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().slice(0, 30).map((p, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1">{formatShortDate(p.t)}</td>
                  <td className="py-1">{describe(p)}</td>
                  <td className="py-1 text-right">{p.kind === "start" ? "–" : signed(p.delta)}</td>
                  <td className="py-1 text-right font-semibold">{p.elo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </div>
    </section>
  );
}
