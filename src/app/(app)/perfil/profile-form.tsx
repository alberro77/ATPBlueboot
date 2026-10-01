"use client";

import { useActionState } from "react";
import { ChevronDown, Loader2, LogOut, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage, ProfileFields } from "@/components/form-bits";
import { updateProfile } from "@/app/actions";
import { signOut } from "@/app/(auth)/actions";
import type { Profile } from "@/lib/types";

/** Datos editables del perfil, plegados para no distraer. */
export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, null);

  return (
    <div className="grid gap-3">
      <details className="group rounded-2xl border bg-card shadow-sm" open={state !== null && !state.ok}>
        <summary className="flex cursor-pointer list-none items-center gap-3 p-4 font-semibold [&::-webkit-details-marker]:hidden">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-primary">
            <Pencil className="size-4" />
          </span>
          Editar mis datos y foto
          <ChevronDown className="ml-auto size-5 text-muted-foreground transition-transform group-open:rotate-180" />
        </summary>
        <form action={action} className="grid gap-4 border-t p-4">
          <ProfileFields defaults={profile} avatarUserId={profile.id} />
          <FormMessage state={state} />
          <Button type="submit" size="lg" className="h-11" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Guardar cambios
          </Button>
        </form>
      </details>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="lg" className="h-11 w-full text-muted-foreground">
          <LogOut />
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
