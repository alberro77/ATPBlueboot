import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import type { PlayerSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PlayerAvatar({
  player,
  size = "default",
  className,
}: {
  player: Pick<PlayerSummary, "first_name" | "last_name" | "avatar_url">;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {player.avatar_url && <AvatarImage src={player.avatar_url} alt="" />}
      <AvatarFallback className={cn("bg-accent font-semibold text-accent-foreground")}>
        {initials(player)}
      </AvatarFallback>
    </Avatar>
  );
}
