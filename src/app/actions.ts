"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NICKNAME_TAKEN, parseProfileForm } from "@/lib/profile-form";
import type { ActionResult, Mode } from "@/lib/types";

function done(message?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

/** Carga uno o varios partidos seguidos entre los mismos jugadores (en el orden en que se jugaron). */
export async function reportSeries(input: {
  mode: Mode;
  partnerId: string | null;
  opponentId: string;
  opponentPartnerId: string | null;
  results: boolean[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_series", {
    p_mode: input.mode,
    p_partner_id: input.partnerId,
    p_opponent_id: input.opponentId,
    p_opponent_partner_id: input.opponentPartnerId,
    p_results: input.results,
  });
  if (error) return { ok: false, error: error.message };
  const n = input.results.length;
  const who = input.mode === "doubles" ? "uno de los rivales" : "tu rival";
  return done(
    n === 1
      ? `Partido cargado. Suma al ranking cuando ${who} lo confirme.`
      : `${n} partidos cargados. Suman al ranking cuando ${who} los confirme.`,
  );
}

export async function confirmBatch(batchId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: count, error } = await supabase.rpc("confirm_batch", { p_batch_id: batchId });
  if (error) return { ok: false, error: error.message };
  return done(`Se confirmaron ${count} partidos.`);
}

export async function rejectBatch(batchId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_batch", { p_batch_id: batchId });
  if (error) return { ok: false, error: error.message };
  return done("Partidos rechazados.");
}

export async function cancelBatch(batchId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_batch", { p_batch_id: batchId });
  if (error) return { ok: false, error: error.message };
  return done("Partidos cancelados.");
}

export async function confirmMatch(matchId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: delta, error } = await supabase.rpc("confirm_match", { p_match_id: matchId });
  if (error) return { ok: false, error: error.message };
  return done(`Partido confirmado. Se transfirieron ${delta} puntos ELO.`);
}

export async function rejectMatch(matchId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_match", { p_match_id: matchId });
  if (error) return { ok: false, error: error.message };
  return done("Partido rechazado.");
}

export async function cancelMatch(matchId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_match", { p_match_id: matchId });
  if (error) return { ok: false, error: error.message };
  return done("Partido cancelado.");
}

export async function updateProfile(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseProfileForm(formData);
  if (!parsed.ok) return { ok: false, error: parsed.error };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Tu sesión expiró. Volvé a iniciar sesión." };

  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) {
    return { ok: false, error: error.code === "23505" ? NICKNAME_TAKEN : error.message };
  }
  return done("Perfil actualizado.");
}
