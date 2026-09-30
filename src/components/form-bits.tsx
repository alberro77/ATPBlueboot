import { CircleAlert, CircleCheck } from "lucide-react";
import { AvatarUpload } from "@/components/avatar-upload";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/types";

export function FormMessage({ state }: { state: ActionResult | null }) {
  if (!state) return null;
  if (!state.ok) {
    return (
      <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
        <CircleAlert className="mt-0.5 size-4 shrink-0" />
        {state.error}
      </p>
    );
  }
  if (!state.message) return null;
  return (
    <p role="status" className="flex items-start gap-2 rounded-lg bg-success/10 p-3 text-sm text-success">
      <CircleCheck className="mt-0.5 size-4 shrink-0" />
      {state.message}
    </p>
  );
}

export function Field({
  label,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={props.name}>{label}</Label>
      <Input id={props.name} className="h-10" {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type ProfileDefaults = {
  first_name?: string;
  last_name?: string;
  nickname?: string;
  avatar_url?: string | null;
};

export function ProfileFields({
  defaults = {},
  avatarUserId,
}: {
  defaults?: ProfileDefaults;
  /** Si se pasa, muestra el selector de foto (requiere sesión iniciada). */
  avatarUserId?: string;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre" name="first_name" required maxLength={50} autoComplete="given-name" defaultValue={defaults.first_name} />
        <Field label="Apellido" name="last_name" required maxLength={50} autoComplete="family-name" defaultValue={defaults.last_name} />
      </div>
      <Field
        label="Apodo"
        name="nickname"
        required
        minLength={2}
        maxLength={20}
        autoComplete="nickname"
        placeholder="Ej: El Muro"
        hint="Es como vas a aparecer en el ranking."
        defaultValue={defaults.nickname}
      />
      {avatarUserId && (
        <AvatarUpload
          userId={avatarUserId}
          defaultUrl={defaults.avatar_url ?? null}
          name={{ first_name: defaults.first_name ?? "", last_name: defaults.last_name ?? "" }}
        />
      )}
    </>
  );
}
