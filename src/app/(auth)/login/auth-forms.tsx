"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Field, FormMessage, ProfileFields } from "@/components/form-bits";
import { signIn, signUp } from "../actions";

export function AuthForms({ linkError }: { linkError: boolean }) {
  const [loginState, loginAction, loginPending] = useActionState(
    signIn,
    linkError ? { ok: false, error: "El link expiró o no es válido. Iniciá sesión o pedí uno nuevo." } : null,
  );
  const [signupState, signupAction, signupPending] = useActionState(signUp, null);

  return (
    <Card>
      <CardContent>
        <Tabs defaultValue="login">
          <TabsList className="mb-4 h-10 w-full">
            <TabsTrigger value="login">Ingresar</TabsTrigger>
            <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form action={loginAction} className="grid gap-4">
              <Field label="Email" name="email" type="email" required autoComplete="email" />
              <Field label="Contraseña" name="password" type="password" required autoComplete="current-password" />
              <FormMessage state={loginState} />
              <Button type="submit" size="lg" className="h-10" disabled={loginPending}>
                {loginPending && <Loader2 className="animate-spin" />}
                Ingresar
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            {signupState?.ok ? (
              <FormMessage state={signupState} />
            ) : (
              <form action={signupAction} className="grid gap-4">
                <ProfileFields />
                <Field label="Email" name="email" type="email" required autoComplete="email" />
                <Field
                  label="Contraseña"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  hint="Mínimo 6 caracteres."
                />
                <FormMessage state={signupState} />
                <Button type="submit" size="lg" className="h-10" disabled={signupPending}>
                  {signupPending && <Loader2 className="animate-spin" />}
                  Crear cuenta
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
