"use client";

import { useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  cancelBatch,
  cancelMatch,
  confirmBatch,
  confirmMatch,
  rejectBatch,
  rejectMatch,
} from "@/app/actions";
import type { ActionResult } from "@/lib/types";

/** Un partido suelto o una serie completa (partidos con el mismo batch_id). */
export type MatchTarget = { matchId: string; batchId?: never } | { batchId: string; matchId?: never };

function useMatchAction() {
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  return { pending, run };
}

export function ConfirmRejectButtons({ target, count = 1 }: { target: MatchTarget; count?: number }) {
  const { pending, run } = useMatchAction();
  const confirm = () => (target.batchId ? confirmBatch(target.batchId) : confirmMatch(target.matchId!));
  const reject = () => (target.batchId ? rejectBatch(target.batchId) : rejectMatch(target.matchId!));
  return (
    <div className="grid grid-cols-[auto_1fr] gap-2">
      <Button
        variant="outline"
        size="lg"
        className="h-12 px-4 text-destructive hover:text-destructive"
        disabled={pending}
        onClick={() => run(reject)}
      >
        <X />
        Rechazar
      </Button>
      <Button size="lg" className="bg-brand h-12 text-base" disabled={pending} onClick={() => run(confirm)}>
        {pending ? <Loader2 className="animate-spin" /> : <Check />}
        {count > 1 ? `Confirmar los ${count}` : "Confirmar"}
      </Button>
    </div>
  );
}

export function CancelButton({ target }: { target: MatchTarget }) {
  const { pending, run } = useMatchAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      disabled={pending}
      onClick={() => run(() => (target.batchId ? cancelBatch(target.batchId) : cancelMatch(target.matchId!)))}
    >
      {pending ? <Loader2 className="animate-spin" /> : <X />}
      Cancelar
    </Button>
  );
}
