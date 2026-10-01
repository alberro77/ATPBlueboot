"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Send, User, Users, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/page-header";
import { PlayerPicker } from "@/components/player-picker";
import { WinnerPicker, type Side } from "@/components/winner-picker";
import { reportDoublesMatch, reportMatch } from "@/app/actions";
import { eloDelta } from "@/lib/elo";
import type { Mode, PlayerSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const avg = (a: number, b: number) => (a + b) / 2;

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
  const [mode, setMode] = useState<Mode>(initialMode);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [rival1Id, setRival1Id] = useState<string | null>(null);
  const [rival2Id, setRival2Id] = useState<string | null>(null);
  const [winner, setWinner] = useState<Side | null>(null);

  const doubles = mode === "doubles";
  const byId = (id: string | null) => players.find((p) => p.id === id) ?? null;
  const partner = doubles ? byId(partnerId) : null;
  const rival1 = byId(rival1Id);
  const rival2 = doubles ? byId(rival2Id) : null;
  const playersReady = doubles ? Boolean(partner && rival1 && rival2) : Boolean(rival1);
  const canSubmit = playersReady && winner !== null && !pending;

  // Cada selector excluye a los jugadores ya elegidos en los otros.
  const taken = new Set([partnerId, rival1Id, rival2Id].filter(Boolean));
  const available = (current: string | null) => players.filter((p) => p.id === current || !taken.has(p.id));

  function changeMode(next: Mode) {
    setMode(next);
    setWinner(null);
    if (next === "singles") {
      setPartnerId(null);
      setRival2Id(null);
    }
  }

  if (players.length < (doubles ? 3 : 1)) {
    return (
      <div className="grid gap-5">
        <ModeSelector mode={mode} onChange={changeMode} />
        <EmptyState icon={UsersRound} title="Faltan jugadores">
          {doubles
            ? "Para jugar dobles hacen falta al menos 4 jugadores registrados."
            : "Todavía no hay otros jugadores registrados. ¡Invitá a tus compañeros!"}
        </EmptyState>
      </div>
    );
  }

  // ELO de cada lado (en dobles: promedio del equipo con el ELO de dobles).
  const myTeam = doubles ? [me, partner].filter((p): p is PlayerSummary => Boolean(p)) : [me];
  const rivalTeam = [rival1, rival2].filter((p): p is PlayerSummary => Boolean(p));
  const myElo = doubles ? (partner ? avg(me.elo_doubles, partner.elo_doubles) : null) : me.elo;
  const rivalElo = doubles ? (rival1 && rival2 ? avg(rival1.elo_doubles, rival2.elo_doubles) : null) : (rival1?.elo ?? null);
  const eloReady = playersReady && myElo !== null && rivalElo !== null;
  const rivalsName = rivalTeam.map((p) => p.nickname).join(" & ");

  function submit() {
    if (!canSubmit) return;
    const iWon = winner === "mine";
    startTransition(async () => {
      const result = doubles
        ? await reportDoublesMatch({
            partnerId: partner!.id,
            opponentId: rival1!.id,
            opponentPartnerId: rival2!.id,
            weWon: iWon,
          })
        : await reportMatch({ opponentId: rival1!.id, iWon });
      if (result.ok) {
        toast.success(result.message);
        router.push("/mis-partidos");
      } else {
        toast.error(result.error);
      }
    });
  }

  const summary =
    eloReady && winner
      ? winner === "mine"
        ? `${doubles ? "Le ganaron" : "Le ganaste"} a ${rivalsName}`
        : `${doubles ? "Perdieron" : "Perdiste"} contra ${rivalsName}`
      : null;
  const summaryDelta =
    eloReady && winner ? (winner === "mine" ? eloDelta(myElo!, rivalElo!) : -eloDelta(rivalElo!, myElo!)) : null;

  return (
    <div className="grid gap-6">
      <Step n={1} title="Modalidad">
        <ModeSelector mode={mode} onChange={changeMode} />
      </Step>

      <Step n={2} title={doubles ? "Jugadores" : "¿Contra quién jugaste?"}>
        {doubles ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Tu equipo</p>
              <PlayerPicker
                label="Tu compañero"
                placeholder="Elegir compañero"
                players={available(partnerId)}
                value={partnerId}
                onChange={setPartnerId}
                recentIds={recentIds}
                eloKey="elo_doubles"
              />
            </div>
            <div className="grid gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Equipo rival</p>
              <PlayerPicker
                label="Rival 1"
                placeholder="Elegir rival"
                players={available(rival1Id)}
                value={rival1Id}
                onChange={setRival1Id}
                recentIds={recentIds}
                eloKey="elo_doubles"
              />
              <PlayerPicker
                label="Rival 2"
                placeholder="Elegir rival"
                players={available(rival2Id)}
                value={rival2Id}
                onChange={setRival2Id}
                recentIds={recentIds}
                eloKey="elo_doubles"
              />
            </div>
          </div>
        ) : (
          <PlayerPicker
            label="Rival"
            placeholder="Elegir rival"
            players={players}
            value={rival1Id}
            onChange={setRival1Id}
            recentIds={recentIds}
            eloKey="elo"
          />
        )}
      </Step>

      <Step n={3} title="¿Quién ganó?" disabled={!eloReady}>
        {eloReady ? (
          <WinnerPicker
            mine={{
              label: doubles ? `Vos & ${partner!.nickname}` : "Vos",
              players: myTeam,
              deltaIfWin: eloDelta(myElo!, rivalElo!),
            }}
            theirs={{ label: rivalsName, players: rivalTeam, deltaIfWin: eloDelta(rivalElo!, myElo!) }}
            value={winner}
            onChange={setWinner}
          />
        ) : (
          <p className="rounded-xl bg-muted/70 p-4 text-center text-sm text-muted-foreground">
            {doubles ? "Elegí a tu compañero y a los dos rivales." : "Primero elegí a tu rival."}
          </p>
        )}
        {doubles && eloReady && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Se usa el promedio de ELO de dobles de cada equipo; los dos integrantes suman o restan lo mismo.
          </p>
        )}
      </Step>

      <div className="sticky bottom-24 z-30 md:bottom-4">
        <div className="rounded-2xl border bg-card/95 p-3 shadow-xl shadow-primary/10 backdrop-blur">
          {summary && (
            <p className="mb-2 flex items-center justify-center gap-2 text-sm">
              <span className="truncate font-medium">{summary}</span>
              {summaryDelta !== null && (
                <span
                  className={cn(
                    "rounded-full px-2 text-xs font-bold tabular-nums",
                    summaryDelta >= 0 ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive",
                  )}
                >
                  {summaryDelta >= 0 ? "+" : "−"}
                  {Math.abs(summaryDelta)} ELO
                </span>
              )}
            </p>
          )}
          <Button size="lg" className="bg-brand h-12 w-full text-base shadow-md" disabled={!canSubmit} onClick={submit}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />}
            Enviar resultado
          </Button>
          <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
            {doubles ? "Cualquiera de los dos rivales" : "Tu rival"} lo confirma desde{" "}
            <Link href="/mis-partidos" className="font-medium text-primary underline-offset-2 hover:underline">
              Mis partidos
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  disabled = false,
  children,
}: {
  n: number;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("grid gap-3 transition-opacity", disabled && "opacity-60")}>
      <h2 className="flex items-center gap-2.5 text-base font-bold">
        <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ModeSelector({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const options = [
    { value: "singles" as const, title: "1 vs 1", subtitle: "Singles", icon: User },
    { value: "doubles" as const, title: "2 vs 2", subtitle: "Dobles", icon: Users },
  ];
  return (
    <div role="radiogroup" aria-label="Modalidad" className="grid grid-cols-2 gap-3">
      {options.map(({ value, title, subtitle, icon: Icon }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(value)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border-2 bg-card p-3 text-left transition-all outline-none focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.98]",
              active ? "border-primary bg-accent shadow-md shadow-primary/10" : "hover:border-primary/40",
            )}
          >
            <span
              className={cn(
                "flex size-10 items-center justify-center rounded-xl transition-colors",
                active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-5" />
            </span>
            <span>
              <span className="block text-base leading-tight font-extrabold">{title}</span>
              <span className="block text-xs text-muted-foreground">{subtitle}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
