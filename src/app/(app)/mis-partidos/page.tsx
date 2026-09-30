import type { Metadata } from "next";
import { Clock, Hourglass, Inbox, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/page-header";
import { PlayerAvatar } from "@/components/player-avatar";
import { CancelButton, ConfirmRejectButtons } from "@/components/match-actions";
import { MyMatchRow, perspective } from "@/components/match-views";
import { getSession, MATCH_FIELDS } from "@/lib/data";
import { eloDelta, MIN_MATCHES_TO_RANK } from "@/lib/elo";
import { daysAgoIso, formatDate, fullName, signed } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { EloEvent, MatchWithPlayers, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mis partidos" };

export default async function MyMatchesPage() {
  const { profile } = await getSession();
  const me = profile!;
  const supabase = await createClient();

  const [{ data: matchData }, { data: decayData }] = await Promise.all([
    supabase
      .from("matches")
      .select(MATCH_FIELDS)
      .or(`reporter_id.eq.${me.id},opponent_id.eq.${me.id}`)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("elo_events")
      .select("id, kind, delta, elo_after, created_at")
      .eq("profile_id", me.id)
      .eq("kind", "decay")
      .gte("created_at", daysAgoIso(30))
      .order("created_at", { ascending: false }),
  ]);

  const matches = (matchData ?? []) as unknown as MatchWithPlayers[];
  const decays = (decayData ?? []) as EloEvent[];
  const toConfirm = matches.filter((m) => m.status === "pending" && m.opponent_id === me.id);
  const awaiting = matches.filter((m) => m.status === "pending" && m.reporter_id === me.id);
  const history = matches.filter((m) => m.status !== "pending");

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <PageHeader title="Mis partidos" />

      <StatsCard profile={me} />

      {decays.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <TrendingDown className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Penalización por inactividad</p>
            <p className="text-muted-foreground">
              Perdiste {Math.abs(decays.reduce((s, d) => s + d.delta, 0))} puntos en los últimos 30 días por no
              jugar. ¡Cargá un partido para frenarla!
            </p>
          </div>
        </div>
      )}

      <section className="grid gap-3">
        <SectionTitle icon={Inbox} count={toConfirm.length}>
          Para confirmar
        </SectionTitle>
        {toConfirm.length === 0 ? (
          <EmptyState>No tenés partidos pendientes de confirmación.</EmptyState>
        ) : (
          toConfirm.map((m) => <IncomingMatchCard key={m.id} match={m} me={me} />)
        )}
      </section>

      {awaiting.length > 0 && (
        <section className="grid gap-3">
          <SectionTitle icon={Hourglass} count={awaiting.length}>
            Esperando a tu rival
          </SectionTitle>
          <ul className="divide-y rounded-xl border bg-card">
            {awaiting.map((m) => (
              <MyMatchRow key={m.id} match={m} playerId={me.id} action={<CancelButton matchId={m.id} />} />
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3">
        <SectionTitle icon={Clock}>Mi historial</SectionTitle>
        {history.length === 0 ? (
          <EmptyState>Todavía no jugaste partidos.</EmptyState>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {history.map((m) => (
              <MyMatchRow key={m.id} match={m} playerId={me.id} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-base font-semibold">
      <Icon className="size-4 text-primary" />
      {children}
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-primary px-2 text-xs leading-5 text-primary-foreground">{count}</span>
      )}
    </h2>
  );
}

function StatsCard({ profile }: { profile: Profile }) {
  const ranked = profile.matches_played >= MIN_MATCHES_TO_RANK;
  const stats = [
    { label: "ELO", value: profile.elo, className: "text-primary" },
    { label: "PJ", value: profile.matches_played },
    { label: "V", value: profile.wins, className: "text-success" },
    { label: "D", value: profile.losses, className: "text-destructive" },
  ];
  return (
    <Card size="sm">
      <CardContent className="grid grid-cols-4 divide-x text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <div className={cn("text-2xl font-bold tabular-nums", s.className)}>{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </CardContent>
      {!ranked && (
        <p className="px-4 text-center text-xs text-muted-foreground">
          En evaluación: te faltan {MIN_MATCHES_TO_RANK - profile.matches_played} partido(s) confirmados para
          entrar al ranking oficial.
        </p>
      )}
    </Card>
  );
}

function IncomingMatchCard({ match, me }: { match: MatchWithPlayers; me: Profile }) {
  const p = perspective(match, me.id);
  const preview = p.won ? eloDelta(me.elo, p.rival.elo) : -eloDelta(p.rival.elo, me.elo);

  return (
    <Card className="border-primary/40 ring-2 ring-primary/10">
      <CardHeader className="flex flex-row items-center gap-3">
        <PlayerAvatar player={p.rival} size="lg" />
        <div className="min-w-0">
          <CardTitle className="truncate text-base">{p.rival.nickname}</CardTitle>
          <p className="truncate text-xs text-muted-foreground">
            {fullName(p.rival)} · {formatDate(match.created_at)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-xl bg-muted/60 p-3 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Vos</div>
            <div className={cn("text-3xl font-bold tabular-nums", p.won && "text-success")}>{p.myScore}</div>
          </div>
          <span className="px-3 text-xl text-muted-foreground">–</span>
          <div>
            <div className="truncate text-xs text-muted-foreground">{p.rival.nickname}</div>
            <div className={cn("text-3xl font-bold tabular-nums", !p.won && "text-success")}>{p.rivalScore}</div>
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Si confirmás:{" "}
          <b className={preview >= 0 ? "text-success" : "text-destructive"}>{signed(preview)} ELO</b>
        </p>
        <ConfirmRejectButtons matchId={match.id} />
      </CardContent>
    </Card>
  );
}
