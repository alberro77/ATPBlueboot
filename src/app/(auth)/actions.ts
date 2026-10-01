"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NICKNAME_TAKEN, parseProfileForm } from "@/lib/profile-form";
import type { ActionResult } from "@/lib/types";

export async function signIn(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { ok: false, error: "Todavía no confirmaste tu email. Revisá tu bandeja de entrada." };
    }
    return { ok: false, error: "Email o contraseña incorrectos." };
  }
  redirect("/");
}

export async function signUp(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const parsed = parseProfileForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  if (password.length < 8) {
    return { ok: false, error: "La contraseña tiene que tener al menos 8 caracteres." };
  }

  const supabase = await createClient();
  const { data: available } = await supabase.rpc("is_nickname_available", {
    p_nickname: parsed.data.nickname,
  });
  if (available === false) return { ok: false, error: NICKNAME_TAKEN };

  const origin = (await headers()).get("origin") ?? "";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        first_name: parsed.data.first_name,
        last_name: parsed.data.last_name,
        nickname: parsed.data.nickname,
      },
    },
  });
  if (error) return { ok: false, error: signUpErrorMessage(error.code, error.message) };

  // Con "Confirm email" desactivado en Supabase la sesión llega inmediatamente.
  if (data.session) redirect("/");

  return {
    ok: true,
    message: "¡Listo! Te enviamos un email para confirmar tu cuenta. Después iniciá sesión.",
  };
}

function signUpErrorMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese email. Iniciá sesión.";
    case "over_email_send_rate_limit":
      // Solo ocurre si "Confirm email" está activado en Supabase (ver README).
      return "No pudimos enviar el email de confirmación (límite de envíos alcanzado). Probá de nuevo en un rato.";
    case "over_request_rate_limit":
      return "Demasiados intentos seguidos. Esperá un minuto y volvé a probar.";
    case "weak_password":
      return "La contraseña es muy débil. Probá con una más larga.";
    case "email_address_invalid":
      return "Ese email no es válido.";
    case "signup_disabled":
      return "El registro de cuentas nuevas está deshabilitado.";
    default:
      // El trigger guard_signup rechaza dominios no permitidos o el tope de cuentas.
      if (fallback.includes("Database error saving new user")) {
        return "No se pudo crear la cuenta. Usá tu email de la empresa o consultá con quien administra la app.";
      }
      return fallback;
  }
}

export async function createProfile(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseProfileForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("profiles").insert({ id: user.id, ...parsed.data });
  if (error) {
    return { ok: false, error: error.code === "23505" ? NICKNAME_TAKEN : error.message };
  }
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
