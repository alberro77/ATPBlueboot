import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/data";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  const { user, profile } = await getSession();
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Mi perfil" description={user!.email} />
      <ProfileForm profile={profile!} />
    </div>
  );
}
