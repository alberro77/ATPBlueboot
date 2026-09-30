export type ProfileInput = {
  first_name: string;
  last_name: string;
  nickname: string;
  avatar_url: string | null;
};

export function parseProfileForm(
  formData: FormData,
): { ok: true; data: ProfileInput } | { ok: false; error: string } {
  const first_name = String(formData.get("first_name") ?? "").trim();
  const last_name = String(formData.get("last_name") ?? "").trim();
  const nickname = String(formData.get("nickname") ?? "").trim().replace(/\s+/g, " ");
  const avatarRaw = String(formData.get("avatar_url") ?? "").trim();

  if (!first_name || first_name.length > 50) return { ok: false, error: "Ingresá tu nombre." };
  if (!last_name || last_name.length > 50) return { ok: false, error: "Ingresá tu apellido." };
  if (nickname.length < 2 || nickname.length > 20)
    return { ok: false, error: "El apodo tiene que tener entre 2 y 20 caracteres." };
  if (avatarRaw && !/^https?:\/\//i.test(avatarRaw))
    return { ok: false, error: "La URL de la foto tiene que empezar con http:// o https://" };

  return { ok: true, data: { first_name, last_name, nickname, avatar_url: avatarRaw || null } };
}

export const NICKNAME_TAKEN = "Ese apodo ya está en uso. Probá con otro.";
