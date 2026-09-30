import Link from "next/link";
import { redirect } from "next/navigation";
import { BlueBootIcon } from "@/components/brand/logo";
import { DesktopNav, MobileNav } from "@/components/app-nav";
import { InstallApp } from "@/components/install-app";
import { UserMenu } from "@/components/user-menu";
import { confirmableBy, getSession } from "@/lib/data";
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

  return (
    <>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2">
            <BlueBootIcon className="size-8" />
            <span className="leading-tight">
              <span className="block text-sm font-bold">Ping Pong</span>
              <span className="block text-[0.65rem] font-medium tracking-widest text-primary">BLUEBOOT</span>
            </span>
          </Link>
          <DesktopNav pendingCount={pendingCount} />
          <UserMenu profile={profile} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 md:pb-10">
        <InstallApp />
        {children}
      </main>
      <MobileNav pendingCount={pendingCount} />
    </>
  );
}
