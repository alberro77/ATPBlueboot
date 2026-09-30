"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NICKNAME_TAKEN, parseProfileForm } from "@/lib/profile-form";
import type { ActionResult } from "@/lib/types";

function done(message?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

export async function reportMatch(input: {
  opponentId: string;
  myScore: number;
  opponentScore: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_match", {
    p_opponent_id: input.opponentId,
    p_my_score: input.myScore,
    p_opponent_score: input.opponentScore,
  });
  if (error) return { ok: false, error: error.message };
  return done("Partido cargado. Queda pendiente hasta que tu rival lo confirme.");
}

export async function reportDoublesMatch(input: {
  partnerId: string;
  opponentId: string;
  opponentPartnerId: string;
  myScore: number;
  opponentScore: number;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_doubles_match", {
    p_partner_id: input.partnerId,
    p_opponent_id: input.opponentId,
    p_opponent_partner_id: input.opponentPartnerId,
    p_my_score: input.myScore,
    p_opponent_score: input.opponentScore,
  });
  if (error) return { ok: false, error: error.message };
  return done("Partido de dobles cargado. Cualquiera de los dos rivales puede confirmarlo.");
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
