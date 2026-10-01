"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Send, ThumbsDown, Trophy, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/page-header";
import { PlayerAvatar } from "@/components/player-avatar";
import { PlayerSheet } from "@/components/player-picker";
import { SegmentedButtons } from "@/components/segmented";
import { WinChance } from "@/components/win-chance";
import { reportSeries } from "@/app/actions";
import { eloDelta, seriesDelta, teamElo } from "@/lib/elo";
import type { Mode, PlayerSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type SlotKey = "partner" | "rival1" | "rival2";

const SLOT_LABEL: Record<SlotKey, string> = {
  partner: "Compañero",
  rival1: "Rival",
  rival2: "Rival",
};

const MAX_SERIES = 20;

const SHEET_TITLE: Record<SlotKey, string> = {
  partner: "¿Con quién jugaste?",
  rival1: "¿Contra quién jugaste?",
  rival2: "¿Quién más jugó en contra?",
};

export function ReportMatchForm({
  me,
  players,
  recentIds,
  initialMode,
  initialRivalId = null,
}: {
  me: PlayerSummary;
  players: PlayerSummary[];
  recentIds: string[];
  initialMode: Mode;
  /** Rival preseleccionado (botón "Desafiar" del perfil). */
  initialRivalId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [results, setResults] = useState<boolean[]>([]);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [slots, setSlots] = useState<Record<SlotKey, string | null>>(() => ({
    partner: null,
    rival1: players.some((p) => p.id === initialRivalId) ? initialRivalId : null,
    rival2: null,
  }));
  const [sheetSlot, setSheetSlot] = useState<SlotKey | null>(null);

  const doubles = mode === "doubles";
  const order: SlotKey[] = doubles ? ["partner", "rival1", "rival2"] : ["rival1"];
  const byId = (id: string | null) => players.find((p) => p.id === id) ?? null;
  const nextEmpty = order.find((k) => !slots[k]) ?? null;

  if (players.length < (doubles ? 3 : 1)) {
    return (
      <div className="grid gap-5">
        <ModeToggle mode={mode} onChange={setMode} />
        <EmptyState icon={UsersRound} title="Faltan jugadores">
          {doubles
            ? "Para jugar 2 vs 2 hacen falta al menos 4 jugadores registrados."
            : "Todavía no hay otros jugadores registrados. ¡Invitá a tus compañeros!"}
        </EmptyState>
      </div>
    );
  }

  const partner = doubles ? byId(slots.partner) : null;
  const rivals = (doubles ? [slots.rival1, slots.rival2] : [slots.rival1]).map(byId);
  const ready = order.every((k) => slots[k]);
  const myTeam = doubles ? [me, partner] : [me];
  const myElo = ready ? teamElo(myTeam as PlayerSummary[]) : 0;
  const rivalElo = ready ? teamElo(rivals as PlayerSummary[]) : 0;
  // Lo que se gana / pierde en el próximo partido de la serie.
  const afterSoFar = seriesDelta(myElo, rivalElo, results);
  const gain = ready ? eloDelta(myElo + afterSoFar, rivalElo - afterSoFar) : null;
  const loss = ready ? eloDelta(rivalElo - afterSoFar, myElo + afterSoFar) : null;
  const wins = results.filter(Boolean).length;

  const taken = new Set(order.map((k) => slots[k]).filter(Boolean));
  const availableFor = (slot: SlotKey) => players.filter((p) => p.id === slots[slot] || !taken.has(p.id));
  const quickPicks = nextEmpty
    ? recentIds.map(byId).filter((p): p is PlayerSummary => Boolean(p) && !taken.has(p!.id)).slice(0, 6)
    : [];

  function setSlot(slot: SlotKey, id: string) {
    setSlots((s) => ({ ...s, [slot]: id }));
  }

  function changeMode(next: Mode) {
    setMode(next);
    if (next === "singles") setSlots((s) => ({ partner: null, rival1: s.rival1, rival2: null }));
  }

  function addResult(won: boolean) {
    if (!ready || results.length >= MAX_SERIES) return;
    setResults((r) => [...r, won]);
    navigator.vibrate?.(15);
  }

  function submit() {
    if (!ready || pending || results.length === 0) return;
    startTransition(async () => {
      const result = await reportSeries({
        mode,
        partnerId: doubles ? slots.partner : null,
        opponentId: slots.rival1!,
        opponentPartnerId: doubles ? slots.rival2 : null,
        results,
      });
      if (result.ok) {
        const title =
          wins * 2 > results.length ? "¡Bien ahí! 🏆" : wins * 2 === results.length ? "¡Parejo! 🤝" : "¡La próxima es tuya! 💪";
        toast.success(title, { description: result.message });
        router.push("/mis-partidos");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-5">
      <ModeToggle mode={mode} onChange={changeMode} />

      {/* El partido: tu equipo contra los rivales. */}
      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-3xl border bg-card p-4 shadow-sm">
        <div className="grid justify-items-center gap-3">
          <p className="text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
            {doubles ? "Tu equipo" : "Vos"}
          </p>
          <FilledSlot player={me} />
          {doubles && (
            <Slot
              label={SLOT_LABEL.partner}
              player={partner}
              highlight={nextEmpty === "partner"}
              onClick={() => setSheetSlot("partner")}
            />
          )}
        </div>
        <span className="bg-brand flex size-10 items-center justify-center rounded-full text-xs font-black text-white shadow-md shadow-primary/30">
          VS
        </span>
        <div className="grid justify-items-center gap-3">
          <p className="text-[0.7rem] font-bold tracking-wider text-muted-foreground uppercase">
            {doubles ? "Rivales" : "Rival"}
          </p>
          {(doubles ? (["rival1", "rival2"] as const) : (["rival1"] as const)).map((key, i) => (
            <Slot
              key={key}
              label={SLOT_LABEL[key]}
              player={rivals[i]}
              highlight={nextEmpty === key}
              onClick={() => setSheetSlot(key)}
            />
          ))}
        </div>
      </div>

      {/* Atajo: tocá a alguien con quien jugaste hace poco para completar el próximo lugar. */}
      {nextEmpty && quickPicks.length > 0 && (
        <section className="grid gap-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {nextEmpty === "partner" ? "¿Tu compañero? Jugaste hace poco con:" : "¿Tu rival? Jugaste hace poco con:"}
          </p>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {quickPicks.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSlot(nextEmpty, p.id)}
                className="flex shrink-0 items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 text-sm font-medium shadow-xs transition-colors hover:border-primary/50 hover:bg-accent active:scale-95"
              >
                <PlayerAvatar player={p} size="sm" />
                {p.nickname}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSheetSlot(nextEmpty)}
              className="flex shrink-0 items-center gap-1 rounded-full border border-dashed px-3 text-sm font-medium text-primary hover:bg-accent"
            >
              <Plus className="size-4" /> Otro
            </button>
          </div>
        </section>
      )}

      {/* La probabilidad de ganar se muestra solo en 1 vs 1, con el ELO de cada jugador. */}
      {ready && !doubles && (
        <WinChance
          className="rounded-2xl border bg-card p-4 shadow-sm"
          title={results.length === 0 ? "Chances de ganar" : "Chances en el próximo"}
          myElo={myElo + afterSoFar}
          rivalElo={rivalElo - afterSoFar}
          rivalLabel={rivals[0]!.nickname}
        />
      )}

      {/* Resultados: un toque por partido, en el orden en que se jugaron. */}
      <section className={cn("grid gap-3 transition-opacity", !ready && "opacity-50")}>
        <div className="text-center">
          <p className="text-base font-bold">
            {!ready ? "Completá los jugadores" : results.length === 0 ? "¿Cómo salió?" : "¿Jugaron otro?"}
          </p>
          {ready && <p className="text-xs text-muted-foreground">Tocá una vez por cada partido, en orden.</p>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ResultButton
            variant="won"
            label={doubles ? "Ganamos" : "Gané"}
            points={gain}
            disabled={!ready || pending || results.length >= MAX_SERIES}
            onClick={() => addResult(true)}
          />
          <ResultButton
            variant="lost"
            label={doubles ? "Perdimos" : "Perdí"}
            points={loss}
            disabled={!ready || pending || results.length >= MAX_SERIES}
            onClick={() => addResult(false)}
          />
        </div>
      </section>

      {results.length > 0 && (
        <SeriesSummary
          results={results}
          total={afterSoFar}
          onRemove={(i) => setResults((r) => r.filter((_, j) => j !== i))}
          onClear={() => setResults([])}
        />
      )}

      <div className="sticky bottom-24 z-30 md:bottom-4">
        <button
          type="button"
          onClick={submit}
          disabled={!ready || pending || results.length === 0}
          className="bg-brand flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold text-white shadow-xl shadow-primary/30 transition-all active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {pending ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
          {results.length <= 1 ? "Enviar resultado" : `Enviar ${results.length} partidos`}
        </button>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {doubles ? "Uno de los rivales" : "Tu rival"} {results.length > 1 ? "los confirma todos juntos" : "lo confirma"} y
          recién ahí suma al ranking.
        </p>
      </div>

      {sheetSlot && (
        <PlayerSheet
          open
          onOpenChange={(open) => !open && setSheetSlot(null)}
          title={SHEET_TITLE[sheetSlot]}
          players={availableFor(sheetSlot)}
          recentIds={recentIds}
          selectedId={slots[sheetSlot]}
          onPick={(id) => setSlot(sheetSlot, id)}
        />
      )}
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <SegmentedButtons
      value={mode}
      onChange={onChange}
      options={[
        { value: "singles", label: "1 vs 1" },
        { value: "doubles", label: "2 vs 2" },
      ]}
    />
  );
}

function FilledSlot({ player }: { player: PlayerSummary }) {
  return (
    <div className="flex w-24 flex-col items-center gap-1.5">
      <PlayerAvatar player={player} size={60} className="ring-2 ring-primary/30" />
      <span className="w-full truncate text-center text-sm font-semibold">{player.nickname}</span>
    </div>
  );
}

function Slot({
  label,
  player,
  highlight,
  onClick,
}: {
  label: string;
  player: PlayerSummary | null;
  highlight: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={player ? `Cambiar ${label.toLowerCase()}: ${player.nickname}` : `Elegir ${label.toLowerCase()}`}
      className="flex w-24 flex-col items-center gap-1.5 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-95"
    >
      {player ? (
        <PlayerAvatar player={player} size={60} className="ring-2 ring-primary/30" />
      ) : (
        <span
          className={cn(
            "flex size-15 items-center justify-center rounded-full border-2 border-dashed text-primary transition-colors",
            highlight ? "animate-pulse border-primary bg-accent" : "border-primary/40",
          )}
        >
          <Plus className="size-6" />
        </span>
      )}
      <span
        className={cn(
          "w-full truncate text-center text-sm",
          player ? "font-semibold" : "font-medium text-primary",
        )}
      >
        {player ? player.nickname : label}
      </span>
    </button>
  );
}

function ResultButton({
  variant,
  label,
  points,
  disabled,
  onClick,
}: {
  variant: "won" | "lost";
  label: string;
  points: number | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const won = variant === "won";
  const Icon = won ? Trophy : ThumbsDown;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-28 flex-col items-center justify-center gap-1 rounded-3xl text-white shadow-lg transition-all outline-none focus-visible:ring-4 active:scale-[0.97] disabled:shadow-none",
        won
          ? "bg-linear-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/30 focus-visible:ring-emerald-500/40"
          : "bg-linear-to-br from-slate-500 to-slate-600 shadow-slate-500/25 focus-visible:ring-slate-500/40",
      )}
    >
      <Icon className="size-7" />
      <span className="text-xl font-extrabold">{label}</span>
      {points !== null && (
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-bold tabular-nums">
          {won ? "+" : "−"}
          {points} ELO
        </span>
      )}
    </button>
  );
}

function SeriesSummary({
  results,
  total,
  onRemove,
  onClear,
}: {
  results: boolean[];
  total: number;
  onRemove: (index: number) => void;
  onClear: () => void;
}) {
  const wins = results.filter(Boolean).length;
  return (
    <section className="grid gap-3 rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm">
          <b>{results.length === 1 ? "1 partido" : `${results.length} partidos`}</b>
          <span className="text-muted-foreground">
            {" "}
            · <span className="font-semibold text-success">{wins} {wins === 1 ? "ganado" : "ganados"}</span> ·{" "}
            <span className="font-semibold text-destructive">
              {results.length - wins} {results.length - wins === 1 ? "perdido" : "perdidos"}
            </span>
          </span>
        </p>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
            total >= 0 ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive",
          )}
        >
          ≈ {total >= 0 ? "+" : "−"}
          {Math.abs(total)} ELO
        </span>
      </div>
      <ol className="flex flex-wrap gap-x-2 gap-y-5 pb-3" aria-label="Resultados en orden">
        {results.map((won, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={`Quitar partido ${i + 1} (${won ? "ganado" : "perdido"})`}
              className={cn(
                "relative flex size-10 items-center justify-center rounded-xl text-sm font-extrabold text-white transition-transform active:scale-90",
                won ? "bg-emerald-500" : "bg-slate-500",
              )}
            >
              {won ? "G" : "P"}
              <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-card text-foreground shadow ring-1 ring-border">
                <X className="size-2.5" />
              </span>
              <span className="absolute -bottom-4 text-[0.6rem] font-medium text-muted-foreground">{i + 1}</span>
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onClear}
        className="justify-self-start text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        Borrar todo
      </button>
    </section>
  );
}
