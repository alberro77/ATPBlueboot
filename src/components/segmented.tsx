import Link from "next/link";
import { cn } from "@/lib/utils";

const container = "inline-flex w-full rounded-xl bg-muted p-1 sm:w-auto";
const item =
  "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium sm:px-4 text-muted-foreground transition-colors hover:text-foreground sm:flex-none";
const active = "bg-background text-foreground shadow-sm";

/** Selector segmentado basado en links (el estado vive en la URL). */
export function SegmentedLinks({
  options,
}: {
  options: { href: string; label: React.ReactNode; active: boolean }[];
}) {
  return (
    <nav className={container}>
      {options.map((o) => (
        <Link key={o.href} href={o.href} scroll={false} className={cn(item, o.active && active)}>
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

/** Selector segmentado controlado (para formularios). */
export function SegmentedButtons<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" className={cn(container, "sm:w-full")}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(item, "py-2.5 text-base font-semibold sm:flex-1", o.value === value && "bg-primary text-primary-foreground shadow-md shadow-primary/25 hover:text-primary-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
