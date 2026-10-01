"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, ThumbsDown, Trophy, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/page-header";
import { PlayerAvatar } from "@/components/player-avatar";
import { PlayerSheet } from "@/components/player-picker";
import { SegmentedButtons } from "@/components/segmented";
import { reportDoublesMatch, reportMatch } from "@/app/actions";
import { eloDelta, teamElo } from "@/lib/elo";
import type { Mode, PlayerSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type SlotKey = "partner" | "rival1" | "rival2";

const SLOT_LABEL: Record<SlotKey, string> = {
  partner: "Compañero",
  rival1: "Rival",
  rival2: "Rival",
};

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
}: {
  me: PlayerSummary;
  players: PlayerSummary[];
  recentIds: string[];
  initialMode: Mode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sending, setSending] = useState<"won" | "lost" | null>(null);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [slots, setSlots] = useState<Record<SlotKey, string | null>>({ partner: null, rival1: null, rival2: null });
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
  const gain = ready ? eloDelta(teamElo(myTeam as PlayerSummary[]), teamElo(rivals as PlayerSummary[])) : null;
  const loss = ready ? eloDelta(teamElo(rivals as PlayerSummary[]), teamElo(myTeam as PlayerSummary[])) : null;

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

  function submit(won: boolean) {
    if (!ready || pending) return;
    setSending(won ? "won" : "lost");
    startTransition(async () => {
      const result = doubles
        ? await reportDoublesMatch({
            partnerId: slots.partner!,
            opponentId: slots.rival1!,
            opponentPartnerId: slots.rival2!,
            weWon: won,
          })
        : await reportMatch({ opponentId: slots.rival1!, iWon: won });
      if (result.ok) {
        toast.success(won ? "¡Bien ahí! 🏆" : "¡La próxima es tuya! 💪", { description: result.message });
        router.push("/mis-partidos");
      } else {
        toast.error(result.error);
        setSending(null);
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

      {/* Resultado: tocar envía. */}
      <section className={cn("grid gap-3 transition-opacity", !ready && "opacity-50")}>
        <p className="text-center text-base font-bold">{ready ? "¿Cómo salió?" : "Completá los jugadores"}</p>
        <div className="grid grid-cols-2 gap-3">
          <ResultButton
            variant="won"
            label={doubles ? "Ganamos" : "Gané"}
            points={gain}
            disabled={!ready || pending}
            loading={sending === "won"}
            onClick={() => submit(true)}
          />
          <ResultButton
            variant="lost"
            label={doubles ? "Perdimos" : "Perdí"}
            points={loss}
            disabled={!ready || pending}
            loading={sending === "lost"}
            onClick={() => submit(false)}
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {doubles ? "Uno de los rivales" : "Tu rival"} lo confirma y recién ahí suma al ranking.
        </p>
      </section>

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
  loading,
  onClick,
}: {
  variant: "won" | "lost";
  label: string;
  points: number | null;
  disabled: boolean;
  loading: boolean;
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
      {loading ? <Loader2 className="size-7 animate-spin" /> : <Icon className="size-7" />}
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
