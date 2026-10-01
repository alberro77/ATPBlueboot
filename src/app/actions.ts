"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { NICKNAME_TAKEN, parseProfileForm } from "@/lib/profile-form";
import { pushConfigured, sendPush, type PushPayload, type PushTarget } from "@/lib/push";
import type { ActionResult, Mode } from "@/lib/types";

function done(message?: string): ActionResult {
  revalidatePath("/", "layout");
  return { ok: true, message };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Envía la notificación y borra los dispositivos vencidos. Nunca lanza ni demora el resultado de la acción. */
async function notify(supabase: Supabase, targets: PushTarget[] | null, payload: PushPayload) {
  if (!pushConfigured || !targets?.length) return;
  try {
    const gone = await sendPush(targets, payload);
    if (gone.length > 0) await supabase.rpc("prune_push_subscriptions", { p_endpoints: gone });
  } catch {
    // Un aviso que falla no debe romper la carga del partido.
  }
}

async function myNickname(supabase: Supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle();
  return { id: user.id, nickname: (data?.nickname as string | undefined) ?? "Alguien" };
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
  const { data: batchId, error } = await supabase.rpc("report_series", {
    p_mode: input.mode,
    p_partner_id: input.partnerId,
    p_opponent_id: input.opponentId,
    p_opponent_partner_id: input.opponentPartnerId,
    p_results: input.results,
  });
  if (error) return { ok: false, error: error.message };
  const n = input.results.length;

  // Avisa al equipo rival que tiene partidos para confirmar.
  if (pushConfigured && batchId) {
    const [{ data: targets }, me] = await Promise.all([
      supabase.rpc("push_targets_for_batch", { p_batch_id: batchId }),
      myNickname(supabase),
    ]);
    await notify(supabase, targets as PushTarget[] | null, {
      title: "Partido para confirmar 🏓",
      body:
        n === 1
          ? `${me?.nickname ?? "Alguien"} cargó un partido contra vos. ¿Lo confirmás?`
          : `${me?.nickname ?? "Alguien"} cargó ${n} partidos contra vos. ¿Los confirmás?`,
      url: "/mis-partidos",
      tag: `match-${batchId}`,
    });
  }

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

/** Desafía a otro jugador: queda registrado y se le avisa si tiene las notificaciones activas. */
export async function sendChallenge(targetId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: targets, error } = await supabase.rpc("send_challenge", { p_target: targetId });
  if (error) return { ok: false, error: error.message };

  const me = await myNickname(supabase);
  await notify(supabase, targets as PushTarget[] | null, {
    title: "¡Te desafiaron! 🏓",
    body: `${me?.nickname ?? "Alguien"} te desafió a un partido. ¿Aceptás?`,
    url: me ? `/cargar?rival=${me.id}` : "/",
    tag: `challenge-${me?.id ?? "x"}`,
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "¡Desafío enviado!" };
}

/** Guarda este dispositivo para recibir notificaciones. */
export async function savePushSubscription(sub: {
  endpoint: string;
  keys?: { p256dh?: string; auth?: string };
}): Promise<ActionResult> {
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, error: "No se pudo registrar este dispositivo." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: sub.keys.p256dh,
    p_auth: sub.keys.auth,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateNotificationPrefs(prefs: {
  matchPending: boolean;
  challenges: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_notification_prefs", {
    p_match_pending: prefs.matchPending,
    p_challenges: prefs.challenges,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Manda una notificación de prueba a todos los dispositivos del usuario. */
export async function sendTestPush(): Promise<ActionResult> {
  if (!pushConfigured) {
    return { ok: false, error: "Las notificaciones todavía no están configuradas en el servidor." };
  }
  const supabase = await createClient();
  const { data } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth, profile_id");
  const targets: PushTarget[] = (data ?? []).map((r) => ({
    sub_endpoint: r.endpoint as string,
    sub_p256dh: r.p256dh as string,
    sub_auth: r.auth as string,
    sub_profile_id: r.profile_id as string,
  }));
  if (targets.length === 0) return { ok: false, error: "Primero activá las notificaciones en este dispositivo." };
  await notify(supabase, targets, {
    title: "¡Funciona! 🎉",
    body: "Así te vamos a avisar cuando te toque confirmar un partido o te desafíen.",
    url: "/perfil",
    tag: "test",
  });
  return { ok: true, message: "Te mandamos una notificación de prueba." };
}
