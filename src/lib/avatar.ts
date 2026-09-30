import { SUPABASE_URL } from "@/lib/supabase/env";

export const AVATAR_BUCKET = "avatars";
/** Lado del cuadrado final en px (se muestra a 64px como máximo; 256 cubre pantallas 4x). */
export const AVATAR_SIZE = 256;
/** Tope para el archivo original antes de comprimirlo (fotos de celular). */
export const AVATAR_MAX_INPUT_BYTES = 15 * 1024 * 1024;

export const AVATAR_PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/`;

export function avatarPath(userId: string) {
  return `${userId}/avatar`;
}

/** Recorta al centro en cuadrado y comprime a WebP (JPEG si el navegador no soporta WebP). */
export async function toSquareAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_SIZE;
  canvas.height = AVATAR_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  bitmap.close();

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85));
  const webp = await encode("image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await encode("image/jpeg");
  if (!jpeg) throw new Error("encode");
  return jpeg;
}
