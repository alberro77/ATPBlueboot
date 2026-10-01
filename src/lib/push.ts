import webpush from "web-push";

export type PushTarget = {
  sub_endpoint: string;
  sub_p256dh: string;
  sub_auth: string;
  sub_profile_id: string;
};

export type PushPayload = {
  title: string;
  body: string;
  /** Página que abre al tocar la notificación. */
  url: string;
  /** Notificaciones con la misma etiqueta se reemplazan entre sí. */
  tag: string;
};

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

/** Las notificaciones solo funcionan si el servidor tiene las claves VAPID. */
export const pushConfigured = Boolean(PUBLIC_KEY && PRIVATE_KEY);

/**
 * Envía la notificación a cada dispositivo. Nunca lanza: un aviso que falla no
 * tiene que romper la acción del usuario. Devuelve los endpoints vencidos (404/410)
 * para que se borren de la base.
 */
export async function sendPush(targets: PushTarget[], payload: PushPayload): Promise<string[]> {
  if (!pushConfigured || targets.length === 0) return [];
  webpush.setVapidDetails(SUBJECT, PUBLIC_KEY!, PRIVATE_KEY!);
  const body = JSON.stringify(payload);

  const results = await Promise.allSettled(
    targets.map((t) =>
      webpush.sendNotification(
        { endpoint: t.sub_endpoint, keys: { p256dh: t.sub_p256dh, auth: t.sub_auth } },
        body,
        { TTL: 60 * 60 * 24, urgency: "high", timeout: 8000 },
      ),
    ),
  );

  const gone: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const status = (r.reason as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) gone.push(targets[i].sub_endpoint);
    }
  });
  return gone;
}
