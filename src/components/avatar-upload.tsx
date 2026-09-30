"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PlayerAvatar } from "@/components/player-avatar";
import { AVATAR_BUCKET, AVATAR_MAX_INPUT_BYTES, avatarPath, toSquareAvatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/client";

/**
 * Sube la foto a Supabase Storage (ya recortada a 256x256) y guarda la URL
 * en un input oculto `avatar_url`, que se envía con el resto del formulario.
 */
export function AvatarUpload({
  userId,
  defaultUrl,
  name,
}: {
  userId: string;
  defaultUrl: string | null;
  name: { first_name: string; last_name: string };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("El archivo tiene que ser una imagen.");
      return;
    }
    if (file.size > AVATAR_MAX_INPUT_BYTES) {
      setError("La imagen es demasiado grande (máximo 15 MB).");
      return;
    }

    setUploading(true);
    try {
      const blob = await toSquareAvatar(file);
      const supabase = createClient();
      const path = avatarPath(userId);
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: "3600" });
      if (uploadError) throw uploadError;
      const { publicUrl } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data;
      // El query param evita que el navegador muestre la foto anterior cacheada.
      setUrl(`${publicUrl}?v=${Date.now()}`);
    } catch {
      setError("No se pudo procesar la imagen. Probá con otra (JPG o PNG).");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-1.5">
      <Label>Foto (opcional)</Label>
      <div className="flex items-center gap-3">
        <PlayerAvatar
          player={{ ...name, first_name: name.first_name || "?", avatar_url: url || null }}
          size="lg"
          className="size-14"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="animate-spin" /> : <Camera />}
          {url ? "Cambiar" : "Subir foto"}
        </Button>
        {url && !uploading && (
          <Button type="button" variant="ghost" size="icon" aria-label="Quitar foto" onClick={() => setUrl("")}>
            <Trash2 />
          </Button>
        )}
      </div>
      <input type="hidden" name="avatar_url" value={url} />
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">Se recorta en cuadrado y se comprime automáticamente.</p>
      )}
    </div>
  );
}
