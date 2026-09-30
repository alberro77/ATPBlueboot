import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/data";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Completá tu perfil" };

export default async function OnboardingPage() {
  const { user, profile } = await getSession();
  if (!user) redirect("/login");
  if (profile) redirect("/");

  const meta = user.user_metadata ?? {};
  return (
    <OnboardingForm
      userId={user.id}
      defaults={{
        first_name: meta.first_name ?? "",
        last_name: meta.last_name ?? "",
        nickname: meta.nickname ?? "",
      }}
    />
  );
}
