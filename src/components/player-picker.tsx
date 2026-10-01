"use client";

import { useState } from "react";
import { Clock, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/player-avatar";
import { fullName } from "@/lib/format";
import type { PlayerSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Panel para elegir un jugador: en el celular sube desde abajo. Buscador por
 * apodo, nombre o apellido (sin importar acentos) y los recientes primero.
 */
export function PlayerSheet({
  open,
  onOpenChange,
  title,
  players,
  recentIds = [],
  selectedId,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  players: PlayerSummary[];
  recentIds?: string[];
  selectedId?: string | null;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const q = normalize(query.trim());
  const matches = q
    ? players.filter((p) => normalize(`${p.nickname} ${p.first_name} ${p.last_name}`).includes(q))
    : players;
  const recent = q
    ? []
    : recentIds.map((id) => players.find((p) => p.id === id)).filter((p): p is PlayerSummary => Boolean(p));

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) setQuery("");
  }

  function pick(id: string) {
    onPick(id);
    close(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="top-auto bottom-0 left-0 max-h-[85dvh] max-w-none translate-x-0 translate-y-0 grid-rows-[auto_auto_1fr] gap-3 rounded-t-3xl rounded-b-none pb-[max(1rem,env(safe-area-inset-bottom))] sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl">
        <div className="mx-auto -mt-1 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden" aria-hidden />
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por apodo o nombre"
            className="h-11 rounded-xl pl-9 text-base md:text-sm"
          />
        </div>
        <div className="-mx-4 min-h-0 overflow-y-auto px-4">
          {recent.length > 0 && (
            <section className="mb-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                <Clock className="size-3.5" /> Jugaste hace poco
              </h3>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {recent.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p.id)}
                    className="flex w-16 shrink-0 flex-col items-center gap-1 rounded-xl p-1 text-center hover:bg-accent"
                  >
                    <PlayerAvatar player={p} size={48} />
                    <span className="w-full truncate text-xs font-medium">{p.nickname}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          <h3 className="mb-1 text-xs font-semibold text-muted-foreground uppercase">
            {q ? `Resultados (${matches.length})` : "Todos"}
          </h3>
          {matches.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No encontramos a nadie con “{query}”.</p>
          ) : (
            <ul className="grid gap-1 pb-2">
              {matches.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pick(p.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-accent",
                      p.id === selectedId && "bg-accent",
                    )}
                  >
                    <PlayerAvatar player={p} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.nickname}</span>
                      <span className="block truncate text-xs text-muted-foreground">{fullName(p)}</span>
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">{p.elo}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
