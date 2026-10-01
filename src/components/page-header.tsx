import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Estado vacío amigable: ícono en círculo, mensaje y una acción opcional. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon?: LucideIcon;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border border-dashed border-primary/25 bg-card/60 px-6 py-8 text-center",
        className,
      )}
    >
      {Icon && (
        <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-accent text-primary">
          <Icon className="size-6" />
        </span>
      )}
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className="max-w-xs text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Título de sección con ícono y contador opcional. */
export function SectionTitle({
  icon: Icon,
  count,
  children,
}: {
  icon: LucideIcon;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-base font-bold">
      <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-primary">
        <Icon className="size-4" />
      </span>
      {children}
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-primary px-2 text-xs leading-5 font-semibold text-primary-foreground">
          {count}
        </span>
      )}
    </h2>
  );
}
