"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlayerAvatar } from "@/components/player-avatar";
import { signOut } from "@/app/(auth)/actions";
import type { Profile } from "@/lib/types";

export function UserMenu({ profile }: { profile: Profile }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menú de usuario"
        className="flex items-center gap-2 rounded-full bg-white/10 p-0.5 pr-3 outline-none transition-colors hover:bg-white/20 focus-visible:ring-3 focus-visible:ring-white/50"
      >
        <PlayerAvatar player={profile} className="ring-2 ring-white/70" />
        <span className="text-left leading-none">
          <span className="block text-[0.6rem] font-medium text-white/70">ELO 1v1 · 2v2</span>
          <span className="block text-sm font-bold tabular-nums">
            {profile.elo}
            <span className="font-medium text-white/60"> · {profile.elo_doubles}</span>
          </span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="font-semibold text-foreground">{profile.nickname}</div>
            <div className="text-xs font-normal">
              {profile.first_name} {profile.last_name}
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/perfil" />}>
          <UserRound />
          Mi perfil
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
