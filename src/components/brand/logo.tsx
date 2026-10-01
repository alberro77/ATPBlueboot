import { cn } from "@/lib/utils";

const BRAND_BLUE = "#028BB8";

/**
 * Isotipo BlueBoot: la bota blanca sobre el cuadrado azul redondeado.
 * `inverted` = cuadrado blanco con bota azul, para usar sobre fondos azules.
 */
export function BlueBootIcon({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label="BlueBoot" className={cn("size-8", className)}>
      <rect width="100" height="100" rx="22" fill={inverted ? "#fff" : BRAND_BLUE} />
      <path
        d="M21 25 L49.5 22.6 Q50 33 47.5 45 Q49 49.5 53 46 Q58 39.5 64 39.5 Q76.5 39.5 79.5 49 L79.8 75.5 L21.8 75.5 L21.8 56 Q22.5 50.5 24.5 47.5 Q21 40 20.8 32 Z"
        fill="none"
        stroke={inverted ? BRAND_BLUE : "#fff"}
        strokeWidth="6.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Logo completo: isotipo + "BlueBoot" + "BUSINESS SOFTWARE". */
export function BlueBootLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BlueBootIcon className="size-14" />
      <div className="leading-none" style={{ color: BRAND_BLUE }}>
        <div className="text-3xl tracking-tight">
          Blue<span className="font-extrabold">Boot</span>
          <sup className="ml-0.5 text-xs">©</sup>
        </div>
        <div className="mt-1 text-[0.68rem] font-medium tracking-[0.2em]">BUSINESS SOFTWARE</div>
      </div>
    </div>
  );
}
