"use client";

import { useActionState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FormMessage, ProfileFields } from "@/components/form-bits";
import { PlayerAvatar } from "@/components/player-avatar";
import { updateProfile } from "@/app/actions";
import { signOut } from "@/app/(auth)/actions";
import type { Profile } from "@/lib/types";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action, pending] = useActionState(updateProfile, null);

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent>
          <div className="mb-5 flex items-center gap-4">
            <PlayerAvatar player={profile} size={64} />
            <div>
              <div className="text-lg font-bold">{profile.nickname}</div>
              <div className="text-sm text-muted-foreground">
                1v1: {profile.elo} ELO · {profile.wins}V / {profile.losses}D
              </div>
              <div className="text-sm text-muted-foreground">
                2v2: {profile.elo_doubles} ELO · {profile.doubles_wins}V / {profile.doubles_losses}D
              </div>
            </div>
          </div>
          <form action={action} className="grid gap-4">
            <ProfileFields defaults={profile} avatarUserId={profile.id} />
            <FormMessage state={state} />
            <Button type="submit" size="lg" className="h-10" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />}
              Guardar cambios
            </Button>
          </form>
        </CardContent>
      </Card>
      <form action={signOut}>
        <Button type="submit" variant="outline" size="lg" className="h-10 w-full">
          <LogOut />
          Cerrar sesión
        </Button>
      </form>
    </div>
  );
}
