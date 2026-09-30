"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/page-header";
import { PlayerAvatar } from "@/components/player-avatar";
import { reportMatch } from "@/app/actions";
import { eloDelta } from "@/lib/elo";
import { fullName } from "@/lib/format";
import type { PlayerSummary } from "@/lib/types";

// Mismas reglas que report_match() en la base.
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

export function ReportMatchForm({
  me,
  opponents,
}: {
  me: PlayerSummary;
  opponents: PlayerSummary[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [opponentId, setOpponentId] = useState<string | null>(null);
  const [myScore, setMyScore] = useState("");
  const [theirScore, setTheirScore] = useState("");

  if (opponents.length === 0) {
    return (
      <EmptyState>Todavía no hay otros jugadores registrados. ¡Invitá a tus compañeros!</EmptyState>
    );
  }

  const opponent = opponents.find((o) => o.id === opponentId) ?? null;
  const mine = parseScore(myScore);
  const theirs = parseScore(theirScore);
  const scoresComplete = mine !== null && theirs !== null && !Number.isNaN(mine) && !Number.isNaN(theirs);
  const error = scoresComplete ? scoreError(mine, theirs) : null;
  const canSubmit = Boolean(opponent) && scoresComplete && !error && !pending;
  const iWon = scoresComplete && mine > theirs;

  const items = opponents.map((o) => ({ value: o.id, label: `${o.nickname} — ${fullName(o)}` }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || !opponent) return;
    startTransition(async () => {
      const result = await reportMatch({
        opponentId: opponent.id,
        myScore: mine!,
        opponentScore: theirs!,
      });
      if (result.ok) {
        toast.success(result.message);
        router.push("/mis-partidos");
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={submit} className="grid gap-5">
          <div className="grid gap-1.5">
            <Label>Rival</Label>
            <Select items={items} value={opponentId} onValueChange={(v) => setOpponentId(v as string | null)}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Elegí contra quién jugaste" />
              </SelectTrigger>
              <SelectContent alignItemWithTrigger={false} className="max-h-80">
                {opponents.map((o) => (
                  <SelectItem key={o.id} value={o.id} className="py-2">
                    <PlayerAvatar player={o} size="sm" />
                    <span className="font-medium">{o.nickname}</span>
                    <span className="truncate text-muted-foreground">{fullName(o)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
            <ScoreInput id="my-score" label="Mis puntos" value={myScore} onChange={setMyScore} />
            <span className="pb-3 text-2xl font-bold text-muted-foreground">–</span>
            <ScoreInput
              id="their-score"
              label={opponent ? `Puntos de ${opponent.nickname}` : "Puntos del rival"}
              value={theirScore}
              onChange={setTheirScore}
            />
          </div>

          {error && <p className="-mt-2 text-center text-sm text-destructive">{error}</p>}

          {opponent && (
            <div className="grid gap-2 rounded-xl bg-muted/60 p-4 text-sm">
              {scoresComplete && !error ? (
                <p className="text-center text-base">
                  {iWon ? "🏆 Le ganaste" : "Perdiste"}{" "}
                  <span className="font-bold tabular-nums">
                    {mine}-{theirs}
                  </span>{" "}
                  {iWon ? "a" : "contra"} <span className="font-semibold">{opponent.nickname}</span>
                </p>
              ) : (
                <p className="text-center text-muted-foreground">
                  Tu ELO: <b className="text-foreground">{me.elo}</b> · {opponent.nickname}:{" "}
                  <b className="text-foreground">{opponent.elo}</b>
                </p>
              )}
              <div className="flex justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <TrendingUp className="size-3.5 text-success" />
                  Si ganás: <b className="text-success">+{eloDelta(me.elo, opponent.elo)}</b>
                </span>
                <span className="flex items-center gap-1">
                  <TrendingDown className="size-3.5 text-destructive" />
                  Si perdés: <b className="text-destructive">−{eloDelta(opponent.elo, me.elo)}</b>
                </span>
              </div>
            </div>
          )}

          <Button type="submit" size="lg" className="h-12 text-base" disabled={!canSubmit}>
            {pending ? <Loader2 className="animate-spin" /> : <Send />}
            Enviar resultado
          </Button>
        </form>
      </CardContent>
    </Card>
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
