import type { Metadata } from "next";
import { EloChart } from "@/components/elo-chart";
import { NotificationSettings } from "@/components/notification-settings";
import { ProfileHero } from "@/components/profile-hero";
import { computeRelations, ModeStatsCards, RelationCards, StatsCard } from "@/components/player-stats";
import { getSession } from "@/lib/data";
import { nowMs } from "@/lib/format";
import { loadProfileData } from "@/lib/profile-data";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const { profile } = await getSession();
  const me = profile!;
  const supabase = await createClient();
  const [data, { data: prefsRow }] = await Promise.all([
    loadProfileData(supabase, me.id),
    supabase.from("notification_prefs").select("match_pending, challenges").maybeSingle(),
  ]);
  const { rival, partner } = computeRelations(data.matches, me.id);

  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <ProfileHero profile={me} isMe {...data} />
      <StatsCard profile={me} matches={data.matches} />
      <ModeStatsCards matches={data.matches} playerId={me.id} profile={me} ranks={data.ranks} />
      <EloChart points={data.eloHistory} nowMs={nowMs()} title="Tu AURA en el tiempo" />
      <RelationCards rival={rival} partner={partner} viewerId={me.id} />
      <NotificationSettings
        initialPrefs={{
          matchPending: prefsRow?.match_pending ?? true,
          challenges: prefsRow?.challenges ?? true,
        }}
      />
      <ProfileForm profile={me} />
    </div>
  );
}
