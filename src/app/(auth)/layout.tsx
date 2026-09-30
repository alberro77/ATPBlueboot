import { BlueBootLogo } from "@/components/brand/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-linear-to-b from-accent to-background px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <BlueBootLogo />
        <p className="text-sm font-medium tracking-wide text-muted-foreground">🏓 Ranking de Ping Pong</p>
      </div>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
