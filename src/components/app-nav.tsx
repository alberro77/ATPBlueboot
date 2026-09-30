"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, History, PlusCircle, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Ranking", icon: Trophy },
  { href: "/cargar", label: "Cargar", icon: PlusCircle },
  { href: "/mis-partidos", label: "Mis partidos", icon: Bell },
  { href: "/historial", label: "Historial", icon: History },
] as const;

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
}

function PendingBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} pendientes`}
      className={cn(
        "flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] leading-4.5 font-bold text-white",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Navegación horizontal en el header (desktop). */
export function DesktopNav({ pendingCount }: { pendingCount: number }) {
  const isActive = useIsActive();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {ITEMS.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            isActive(href) && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <Icon className="size-4" />
          {label}
          {href === "/mis-partidos" && <PendingBadge count={pendingCount} />}
        </Link>
      ))}
    </nav>
  );
}

/** Barra inferior fija (mobile). */
export function MobileNav({ pendingCount }: { pendingCount: number }) {
  const isActive = useIsActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium text-muted-foreground",
                isActive(href) && "text-primary",
              )}
            >
              <span className="relative">
                <Icon className="size-5" />
                {href === "/mis-partidos" && (
                  <PendingBadge count={pendingCount} className="absolute -top-1.5 -right-2.5" />
                )}
              </span>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
