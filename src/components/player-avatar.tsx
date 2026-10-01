import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import type { PlayerSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AvatarSize = "sm" | "default" | "lg" | number;

/**
 * Foto del jugador o sus iniciales. `size` acepta los tamaños de Shadcn o un
 * número en px (el componente base fija el tamaño con un selector de atributo
 * que una clase `size-*` no llega a pisar).
 */
export function PlayerAvatar({
  player,
  size = "default",
  className,
}: {
  player: Pick<PlayerSummary, "first_name" | "last_name" | "avatar_url">;
  size?: AvatarSize;
  className?: string;
}) {
  const px = typeof size === "number" ? size : null;
  return (
    <Avatar
      size={px ? "default" : (size as "sm" | "default" | "lg")}
      className={className}
      style={px ? { width: px, height: px } : undefined}
    >
      {player.avatar_url && <AvatarImage src={player.avatar_url} alt="" />}
      <AvatarFallback
        className={cn("bg-accent font-semibold text-accent-foreground")}
        style={px ? { fontSize: Math.round(px * 0.36) } : undefined}
      >
        {initials(player)}
      </AvatarFallback>
    </Avatar>
  );
}
