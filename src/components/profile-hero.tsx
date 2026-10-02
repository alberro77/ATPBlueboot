import { Crown } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { StreakBadge } from "@/components/streak-badge";
import { fullName } from "@/lib/format";
import type { Profile } from "@/lib/types";

/** Cabecera azul del perfil: foto, nombre, AURA, posición y días en el #1. */
export function ProfileHero({
  profile,
  position,
  rankedCount,
  daysAtTop,
  reigningNow,
  isMe,
}: {
  profile: Profile;
  position: number;
  rankedCount: number;
  daysAtTop: number;
  reigningNow: boolean;
  isMe: boolean;
}) {
  return (
    <section className="bg-brand flex flex-col items-center gap-2 rounded-3xl px-4 pt-6 pb-5 text-center text-white shadow-lg shadow-primary/25">
      <div className="relative">
        <PlayerAvatar player={profile} size={88} className="ring-4 ring-white/60" />
        <StreakBadge streak={profile.win_streak} className="absolute -right-2 bottom-0 text-xs ring-2 ring-white/80" />
      </div>
      <div className="max-w-full min-w-0">
        <h1 className="text-2xl font-extrabold [overflow-wrap:anywhere]">{profile.nickname}</h1>
        <p className="text-sm text-white/75">{fullName(profile)}</p>
      </div>
      <div className="mt-1 flex items-center gap-5">
        <Metric value={String(profile.elo)} label="AURA" />
        <Divider />
        <Metric
          value={position > 0 ? `#${position}` : "–"}
          label={position > 0 ? `de ${rankedCount}` : "Sin clasificar"}
        />
        <Divider />
        <Metric
          value={String(daysAtTop)}
          label={daysAtTop === 1 ? "día en el #1" : "días en el #1"}
          icon={<Crown className={reigningNow ? "size-6 fill-amber-300 text-amber-200" : "size-6 text-white/60"} />}
        />
      </div>
      {reigningNow && (
        <p className="mt-1 rounded-full bg-amber-300 px-3 py-1 text-xs font-bold text-amber-950">
          👑 {isMe ? "Sos el #1 del ranking" : "Es el #1 del ranking"}
        </p>
      )}
    </section>
  );
}

function Metric({ value, label, icon }: { value: string; label: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center justify-center gap-1 text-3xl leading-none font-extrabold tabular-nums">
        {icon}
        {value}
      </p>
      <p className="mt-1 text-xs text-white/75">{label}</p>
    </div>
  );
}

function Divider() {
  return <div className="h-9 w-px bg-white/25" />;
}
