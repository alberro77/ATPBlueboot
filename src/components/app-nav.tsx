"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, History, Plus, Trophy, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/", label: "Ranking", icon: Trophy },
  { href: "/mis-partidos", label: "Mis partidos", icon: Bell },
  { href: "/cargar", label: "Cargar", icon: Plus },
  { href: "/historial", label: "Historial", icon: History },
  { href: "/perfil", label: "Perfil", icon: UserRound },
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
        "flex min-w-4.5 items-center justify-center rounded-full bg-destructive px-1 text-[0.65rem] leading-4.5 font-bold text-white ring-2 ring-background",
        className,
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

/** Navegación horizontal sobre el encabezado azul (desktop). */
export function DesktopNav({ pendingCount }: { pendingCount: number }) {
  const isActive = useIsActive();
  return (
    <nav className="hidden items-center gap-1 md:flex">
      {ITEMS.filter((i) => i.href !== "/perfil").map(({ href, label, icon: Icon }) =>
        href === "/cargar" ? (
          <Link
            key={href}
            href={href}
            className="ml-1 flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-transform hover:scale-[1.03]"
          >
            <Icon className="size-4" />
            Cargar partido
          </Link>
        ) : (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white",
              isActive(href) && "bg-white/15 text-white",
            )}
          >
            <Icon className="size-4" />
            {label}
            {href === "/mis-partidos" && <PendingBadge count={pendingCount} className="ring-primary" />}
          </Link>
        ),
      )}
    </nav>
  );
}

/** Barra inferior fija (mobile), con el botón de cargar partido destacado al centro. */
export function MobileNav({ pendingCount }: { pendingCount: number }) {
  const isActive = useIsActive();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_-8px] shadow-primary/20 backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <li key={href} className="flex justify-center">
            {href === "/cargar" ? (
              <Link href={href} aria-label="Cargar partido" className="-mt-5 flex flex-col items-center gap-1">
                <span
                  className={cn(
                    "bg-brand flex size-14 items-center justify-center rounded-full text-white shadow-lg shadow-primary/40 ring-4 ring-background transition-transform active:scale-95",
                    isActive(href) && "ring-accent",
                  )}
                >
                  <Icon className="size-7" strokeWidth={2.5} />
                </span>
                <span className={cn("text-[0.68rem] font-semibold", isActive(href) ? "text-primary" : "text-muted-foreground")}>
                  {label}
                </span>
              </Link>
            ) : (
              <Link
                href={href}
                className={cn(
                  "flex w-full flex-col items-center gap-1 py-2.5 text-[0.68rem] font-medium text-muted-foreground transition-colors",
                  isActive(href) && "text-primary",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    isActive(href) && "bg-accent",
                  )}
                >
                  <Icon className="size-5" />
                  {href === "/mis-partidos" && (
                    <PendingBadge count={pendingCount} className="absolute -top-1 right-0.5" />
                  )}
                </span>
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
