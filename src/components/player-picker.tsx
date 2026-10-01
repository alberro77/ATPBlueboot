"use client";

import { useState } from "react";
import { ChevronRight, Clock, Search, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/player-avatar";
import { fullName } from "@/lib/format";
import type { PlayerSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Selector de jugador amigable para el celular: una tarjeta que abre un panel
 * con buscador (por apodo, nombre o apellido) y los rivales recientes primero.
 */
export function PlayerPicker({
  label,
  placeholder,
  players,
  value,
  onChange,
  recentIds = [],
  eloKey,
}: {
  label: string;
  placeholder: string;
  players: PlayerSummary[];
  value: string | null;
  onChange: (id: string) => void;
  recentIds?: string[];
  eloKey: "elo" | "elo_doubles";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = players.find((p) => p.id === value) ?? null;

  const q = normalize(query.trim());
  const matches = q
    ? players.filter((p) => normalize(`${p.nickname} ${p.first_name} ${p.last_name}`).includes(q))
    : players;
  const recent = q
    ? []
    : recentIds.map((id) => players.find((p) => p.id === id)).filter((p): p is PlayerSummary => Boolean(p));

  function pick(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <DialogTrigger
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border-2 bg-card p-3 text-left transition-all outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/40 active:scale-[0.99]",
          selected ? "border-primary/40" : "border-dashed",
        )}
      >
        {selected ? (
          <PlayerAvatar player={selected} size={44} />
        ) : (
          <span className="flex size-11 items-center justify-center rounded-full bg-accent text-primary">
            <UserPlus className="size-5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-muted-foreground">{label}</span>
          {selected ? (
            <>
              <span className="block truncate font-semibold">{selected.nickname}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {fullName(selected)} · {selected[eloKey]} ELO
              </span>
            </>
          ) : (
            <span className="block font-semibold text-primary">{placeholder}</span>
          )}
        </span>
        <ChevronRight className="size-5 text-muted-foreground" />
      </DialogTrigger>

      <DialogContent className="top-auto bottom-0 left-0 max-h-[85dvh] max-w-none translate-x-0 translate-y-0 grid-rows-[auto_auto_1fr] gap-3 rounded-t-2xl rounded-b-none pb-[max(1rem,env(safe-area-inset-bottom))] sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base">{label}</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por apodo o nombre"
            className="h-11 pl-9 text-base md:text-sm"
          />
        </div>
        <div className="-mx-4 min-h-0 overflow-y-auto px-4">
          {recent.length > 0 && (
            <section className="mb-3">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase">
                <Clock className="size-3.5" /> Recientes
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-1">
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
                      p.id === value && "bg-accent",
                    )}
                  >
                    <PlayerAvatar player={p} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.nickname}</span>
                      <span className="block truncate text-xs text-muted-foreground">{fullName(p)}</span>
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">{p[eloKey]}</span>
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
