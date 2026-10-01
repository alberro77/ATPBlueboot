import type { Metadata } from "next";
import { ProfileHero } from "@/components/profile-hero";
import { computeRelations, RelationCards, StatsCard } from "@/components/player-stats";
import { getSession } from "@/lib/data";
import { loadProfileData } from "@/lib/profile-data";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const { profile } = await getSession();
  const me = profile!;
  const supabase = await createClient();
  const data = await loadProfileData(supabase, me.id);
  const { rival, partner } = computeRelations(data.matches, me.id);

  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <ProfileHero profile={me} isMe {...data} />
      <StatsCard profile={me} matches={data.matches} />
      <RelationCards rival={rival} partner={partner} viewerId={me.id} />
      <ProfileForm profile={me} />
    </div>
  );
}
