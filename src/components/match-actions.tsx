"use client";

import { useTransition } from "react";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cancelMatch, confirmMatch, rejectMatch } from "@/app/actions";
import type { ActionResult } from "@/lib/types";

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

export function ConfirmRejectButtons({ matchId }: { matchId: string }) {
  const { pending, run } = useMatchAction();
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="outline"
        size="lg"
        className="h-11 text-destructive hover:text-destructive"
        disabled={pending}
        onClick={() => run(() => rejectMatch(matchId))}
      >
        <X />
        Rechazar
      </Button>
      <Button size="lg" className="h-11" disabled={pending} onClick={() => run(() => confirmMatch(matchId))}>
        {pending ? <Loader2 className="animate-spin" /> : <Check />}
        Confirmar
      </Button>
    </div>
  );
}

export function CancelButton({ matchId }: { matchId: string }) {
  const { pending, run } = useMatchAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      disabled={pending}
      onClick={() => run(() => cancelMatch(matchId))}
    >
      {pending ? <Loader2 className="animate-spin" /> : <X />}
      Cancelar
    </Button>
  );
}
