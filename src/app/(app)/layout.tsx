import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BlueBootIcon } from "@/components/brand/logo";
import { DesktopNav, MobileNav } from "@/components/app-nav";
import { InstallApp } from "@/components/install-app";
import { SeasonRecap } from "@/components/season-recap";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { confirmableBy, getSession } from "@/lib/data";
import { nowMs } from "@/lib/format";
import { loadSeason } from "@/lib/season-data";
import { SEASON_SEEN_COOKIE, seasonKeyAt, shiftSeason } from "@/lib/seasons";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getSession();
  if (!user) redirect("/login");
  if (!profile) redirect("/onboarding");

  const supabase = await createClient();
  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .or(confirmableBy(user.id))
    .eq("status", "pending");
  const pendingCount = count ?? 0;

  // Resumen de la temporada que terminó: se muestra una vez por dispositivo.
  const lastSeason = shiftSeason(seasonKeyAt(nowMs()), -1);
  const seen = (await cookies()).get(SEASON_SEEN_COOKIE)?.value;
  const recap = seen === lastSeason ? null : await loadSeason(supabase, lastSeason);

  return (
    <>
      <header className="bg-brand sticky top-0 z-40 text-white shadow-md shadow-primary/20">
        <div className="mx-auto flex h-15 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <BlueBootIcon inverted className="size-9" />
            <span className="leading-tight">
              <span className="block text-base font-bold">Blue League</span>
              <span className="block text-[0.65rem] font-semibold tracking-[0.2em] text-white/75">BLUEBOOT</span>
            </span>
          </Link>
          <DesktopNav pendingCount={pendingCount} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserMenu profile={profile} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 md:pb-10">
        <InstallApp />
        {children}
      </main>
      <MobileNav pendingCount={pendingCount} />
      {recap && recap.totalMatches > 0 && <SeasonRecap summary={recap} viewerId={user.id} />}
    </>
  );
}
