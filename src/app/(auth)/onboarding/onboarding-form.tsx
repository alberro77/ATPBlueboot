"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage, ProfileFields } from "@/components/form-bits";
import { createProfile, signOut } from "../actions";

export function OnboardingForm({
  defaults,
}: {
  defaults: { first_name: string; last_name: string; nickname: string };
}) {
  const [state, action, pending] = useActionState(createProfile, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Completá tu perfil</CardTitle>
        <CardDescription>Necesitamos tu nombre y un apodo para el ranking.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <ProfileFields defaults={defaults} withAvatar />
          <FormMessage state={state} />
          <Button type="submit" size="lg" className="h-10" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Empezar a jugar
          </Button>
        </form>
        <form action={signOut} className="mt-3 text-center">
          <Button type="submit" variant="link" size="sm" className="text-muted-foreground">
            Cerrar sesión
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
