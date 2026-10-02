import { Crown } from "lucide-react";
import { PlayerAvatar } from "@/components/player-avatar";
import { StreakBadge } from "@/components/streak-badge";
import { fullName } from "@/lib/format";
import { statsFor } from "@/lib/modes";
import type { Rank } from "@/lib/profile-data";
import type { Profile } from "@/lib/types";

/** Cabecera azul del perfil: foto, nombre, AURA, posición y días en el #1. */
export function ProfileHero({
  profile,
  ranks,
  daysAtTop,
  reigningNow,
  isMe,
}: {
  profile: Profile;
  ranks: Record<"global" | "singles" | "doubles", Rank>;
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
          value={ranks.global.position > 0 ? `#${ranks.global.position}` : "–"}
          label={ranks.global.position > 0 ? `de ${ranks.global.count} · Global` : "Sin clasificar"}
        />
        <Divider />
        <Metric
          value={String(daysAtTop)}
          label={daysAtTop === 1 ? "día en el #1" : "días en el #1"}
          icon={<Crown className={reigningNow ? "size-6 fill-amber-300 text-amber-200" : "size-6 text-white/60"} />}
        />
      </div>
      <div className="mt-2 grid w-full grid-cols-2 gap-2">
        <ScopeTile label="1 vs 1" elo={statsFor(profile, "singles").elo} rank={ranks.singles} />
        <ScopeTile label="2 vs 2" elo={statsFor(profile, "doubles").elo} rank={ranks.doubles} />
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

/** Puntaje y posición en el ranking de una modalidad. */
function ScopeTile({ label, elo, rank }: { label: string; elo: number; rank: Rank }) {
  return (
    <div className="min-w-0 rounded-2xl bg-white/15 px-3 py-2 text-left">
      <p className="text-[0.7rem] font-semibold tracking-wide text-white/75 uppercase">{label}</p>
      <p className="flex items-baseline gap-2">
        <span className="text-xl leading-tight font-extrabold tabular-nums">{elo}</span>
        <span className="truncate text-xs text-white/80">
          {rank.position > 0 ? `#${rank.position} de ${rank.count}` : "Sin clasificar"}
        </span>
      </p>
    </div>
  );
}

function Divider() {
  return <div className="h-9 w-px bg-white/25" />;
}
