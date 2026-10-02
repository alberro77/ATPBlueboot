"use client";

import { useTransition } from "react";
import { Loader2, Swords } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendChallenge } from "@/app/actions";
import { cn } from "@/lib/utils";

/** Desafía al jugador: le llega una notificación (si la tiene activa) y queda en su "Mis partidos". */
export function ChallengeButton({ targetId, nickname }: { targetId: string; nickname: string }) {
  const [pending, startTransition] = useTransition();

  function challenge() {
    startTransition(async () => {
      const r = await sendChallenge(targetId);
      if (r.ok) toast.success(`¡Desafío enviado a ${nickname}! 🏓`);
      else toast.error(r.error);
    });
  }

  return (
    <Button size="sm" className={cn("bg-brand rounded-full px-3")} disabled={pending} onClick={challenge}>
      {pending ? <Loader2 className="animate-spin" /> : <Swords />}
      Desafiar
    </Button>
  );
}
