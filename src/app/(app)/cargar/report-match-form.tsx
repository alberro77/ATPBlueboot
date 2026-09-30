"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, TrendingDown, TrendingUp, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/page-header";
import { PlayerAvatar } from "@/components/player-avatar";
import { SegmentedButtons } from "@/components/segmented";
import { reportDoublesMatch, reportMatch } from "@/app/actions";
import { eloDelta } from "@/lib/elo";
import { fullName } from "@/lib/format";
import { MODE_LABEL } from "@/lib/modes";
import type { Mode, PlayerSummary } from "@/lib/types";

// Mismas reglas que private.validate_score() en la base.
function scoreError(mine: number, theirs: number) {
  const hi = Math.max(mine, theirs);
  const lo = Math.min(mine, theirs);
  if (hi === lo) return "No puede haber empate.";
  if (hi < 11) return "El ganador tiene que llegar al menos a 11 puntos.";
  if (hi - lo < 2) return "Se gana por 2 puntos de diferencia.";
  if (hi > 99) return "Puntaje fuera de rango.";
  return null;
}

function parseScore(value: string) {
  return value === "" ? null : Number.parseInt(value, 10);
}

const avg = (a: number, b: number) => (a + b) / 2;

export function ReportMatchForm({
  me,
  players,
  initialMode,
}: {
  me: PlayerSummary;
  players: PlayerSummary[];
  initialMode: Mode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [rival1Id, setRival1Id] = useState<string | null>(null);
  const [rival2Id, setRival2Id] = useState<string | null>(null);
  const [myScore, setMyScore] = useState("");
  const [theirScore, setTheirScore] = useState("");

  const doubles = mode === "doubles";
  const byId = (id: string | null) => players.find((p) => p.id === id) ?? null;
  const partner = doubles ? byId(partnerId) : null;
  const rival1 = byId(rival1Id);
  const rival2 = doubles ? byId(rival2Id) : null;

  if (players.length < (doubles ? 3 : 1)) {
    return (
      <div className="grid gap-5">
        <ModeSelector mode={mode} onChange={setMode} />
        <EmptyState>
          {doubles
            ? "Para jugar dobles hacen falta al menos 4 jugadores registrados."
            : "Todavía no hay otros jugadores registrados. ¡Invitá a tus compañeros!"}
        </EmptyState>
      </div>
    );
  }

  const playersReady = doubles ? Boolean(partner && rival1 && rival2) : Boolean(rival1);
  const mine = parseScore(myScore);
  const theirs = parseScore(theirScore);
  const scoresComplete = mine !== null && theirs !== null && !Number.isNaN(mine) && !Number.isNaN(theirs);
  const error = scoresComplete ? scoreError(mine, theirs) : null;
  const canSubmit = playersReady && scoresComplete && !error && !pending;
  const iWon = scoresComplete && mine > theirs;

  // ELO de cada lado (en dobles: promedio del equipo con el ELO de dobles).
  const myElo = doubles ? (partner ? avg(me.elo_doubles, partner.elo_doubles) : null) : me.elo;
  const rivalElo = doubles
    ? rival1 && rival2
      ? avg(rival1.elo_doubles, rival2.elo_doubles)
      : null
    : (rival1?.elo ?? null);
  const rivalsName = doubles ? [rival1, rival2].filter(Boolean).map((p) => p!.nickname).join(" & ") : rival1?.nickname;

  // Cada selector excluye a los jugadores ya elegidos en los otros.
  const taken = new Set([partnerId, rival1Id, rival2Id].filter(Boolean));
  const available = (current: string | null) => players.filter((p) => p.id === current || !taken.has(p.id));

  function changeMode(next: Mode) {
    setMode(next);
    if (next === "singles") {
      setPartnerId(null);
      setRival2Id(null);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    startTransition(async () => {
      const result = doubles
        ? await reportDoublesMatch({
            partnerId: partner!.id,
            opponentId: rival1!.id,
            opponentPartnerId: rival2!.id,
            myScore: mine!,
            opponentScore: theirs!,
          })
        : await reportMatch({ opponentId: rival1!.id, myScore: mine!, opponentScore: theirs! });
      if (result.ok) {
        toast.success(result.message);
        router.push("/mis-partidos");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-4">
      <ModeSelector mode={mode} onChange={changeMode} />
      <Card>
        <CardContent>
          <form onSubmit={submit} className="grid gap-5">
            {doubles ? (
              <>
                <fieldset className="grid gap-2">
                  <legend className="mb-1.5 text-sm font-semibold">Tu equipo</legend>
                  <PlayerSelect
                    label="Compañero"
                    placeholder="Elegí a tu compañero"
                    players={available(partnerId)}
                    value={partnerId}
                    onChange={setPartnerId}
                    eloKey="elo_doubles"
                  />
                </fieldset>
                <fieldset className="grid gap-2">
                  <legend className="mb-1.5 text-sm font-semibold">Equipo rival</legend>
                  <PlayerSelect
                    label="Rival 1"
                    placeholder="Elegí al primer rival"
                    players={available(rival1Id)}
                    value={rival1Id}
                    onChange={setRival1Id}
                    eloKey="elo_doubles"
                  />
                  <PlayerSelect
                    label="Rival 2"
                    placeholder="Elegí al segundo rival"
                    players={available(rival2Id)}
                    value={rival2Id}
                    onChange={setRival2Id}
                    eloKey="elo_doubles"
                  />
                </fieldset>
              </>
            ) : (
              <PlayerSelect
                label="Rival"
                placeholder="Elegí contra quién jugaste"
                players={players}
                value={rival1Id}
                onChange={setRival1Id}
                eloKey="elo"
              />
            )}

            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
              <ScoreInput
                id="my-score"
                label={doubles ? "Nuestro equipo" : "Mis puntos"}
                value={myScore}
                onChange={setMyScore}
              />
              <span className="pb-3 text-2xl font-bold text-muted-foreground">–</span>
              <ScoreInput
                id="their-score"
                label={doubles ? "Equipo rival" : rival1 ? `Puntos de ${rival1.nickname}` : "Puntos del rival"}
                value={theirScore}
                onChange={setTheirScore}
              />
            </div>

            {error && <p className="-mt-2 text-center text-sm text-destructive">{error}</p>}

            {myElo !== null && rivalElo !== null && (
              <div className="grid gap-2 rounded-xl bg-muted/60 p-4 text-sm">
                {scoresComplete && !error ? (
                  <p className="text-center text-base">
                    {iWon ? (doubles ? "🏆 Le ganaron" : "🏆 Le ganaste") : doubles ? "Perdieron" : "Perdiste"}{" "}
                    <span className="font-bold tabular-nums">
                      {mine}-{theirs}
                    </span>{" "}
                    {iWon ? "a" : "contra"} <span className="font-semibold">{rivalsName}</span>
                  </p>
                ) : (
                  <p className="text-center text-muted-foreground">
                    {doubles ? "Tu equipo" : "Tu ELO"}: <b className="text-foreground">{Math.round(myElo)}</b> ·{" "}
                    {doubles ? "Rivales" : rival1!.nickname}: <b className="text-foreground">{Math.round(rivalElo)}</b>
                    {doubles && <span className="block text-xs">(promedio de ELO de dobles)</span>}
                  </p>
                )}
                <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="size-3.5 text-success" />
                    Si ganás: <b className="text-success">+{eloDelta(myElo, rivalElo)}</b>
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingDown className="size-3.5 text-destructive" />
                    Si perdés: <b className="text-destructive">−{eloDelta(rivalElo, myElo)}</b>
                  </span>
                </div>
                {doubles && <p className="text-center text-xs text-muted-foreground">Cada integrante suma o resta lo mismo.</p>}
              </div>
            )}

            <Button type="submit" size="lg" className="h-12 text-base" disabled={!canSubmit}>
              {pending ? <Loader2 className="animate-spin" /> : <Send />}
              Enviar resultado
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function ModeSelector({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <SegmentedButtons
      value={mode}
      onChange={onChange}
      options={[
        {
          value: "singles",
          label: (
            <>
              <User className="size-4" /> {MODE_LABEL.singles}
            </>
          ),
        },
        {
          value: "doubles",
          label: (
            <>
              <Users className="size-4" /> {MODE_LABEL.doubles}
            </>
          ),
        },
      ]}
    />
  );
}

function PlayerSelect({
  label,
  placeholder,
  players,
  value,
  onChange,
  eloKey,
}: {
  label: string;
  placeholder: string;
  players: PlayerSummary[];
  value: string | null;
  onChange: (id: string | null) => void;
  eloKey: "elo" | "elo_doubles";
}) {
  const items = players.map((o) => ({ value: o.id, label: `${o.nickname} — ${fullName(o)}` }));
  return (
    <div className="grid gap-1.5">
      <Label className="text-muted-foreground">{label}</Label>
      <Select items={items} value={value} onValueChange={(v) => onChange(v as string | null)}>
        <SelectTrigger className="h-11 w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false} className="max-h-80">
          {players.map((o) => (
            <SelectItem key={o.id} value={o.id} className="py-2">
              <PlayerAvatar player={o} size="sm" />
              <span className="font-medium">{o.nickname}</span>
              <span className="truncate text-muted-foreground">{fullName(o)}</span>
              <span className="ml-auto pl-2 text-xs tabular-nums text-muted-foreground">{o[eloKey]}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ScoreInput({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="truncate">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        required
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 2))}
        className="h-14 text-center text-3xl font-bold tabular-nums md:text-3xl"
      />
    </div>
  );
}
