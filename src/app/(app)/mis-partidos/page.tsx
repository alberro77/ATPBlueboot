import type { Metadata } from "next";
import { Clock, Hourglass, Inbox, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/page-header";
import { CancelButton, ConfirmRejectButtons } from "@/components/match-actions";
import { ModeBadge, MyMatchRow, perspective, TeamAvatars, teamName } from "@/components/match-views";
import { getSession, involving, MATCH_FIELDS } from "@/lib/data";
import { eloDelta, MIN_MATCHES_TO_RANK } from "@/lib/elo";
import { daysAgoIso, formatDate, fullName, signed } from "@/lib/format";
import { MODE_LABEL, statsFor } from "@/lib/modes";
import { createClient } from "@/lib/supabase/server";
import type { EloEvent, MatchWithPlayers, Mode, PlayerSummary, Profile } from "@/lib/types";
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
      .or(involving(me.id))
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("elo_events")
      .select("id, kind, mode, delta, elo_after, created_at")
      .eq("profile_id", me.id)
      .eq("kind", "decay")
      .gte("created_at", daysAgoIso(30))
      .order("created_at", { ascending: false }),
  ]);

  const matches = (matchData ?? []) as unknown as MatchWithPlayers[];
  const decays = (decayData ?? []) as EloEvent[];
  const pendingMatches = matches.filter((m) => m.status === "pending");
  const toConfirm = pendingMatches.filter((m) => m.opponent_id === me.id || m.opponent_partner_id === me.id);
  const awaiting = pendingMatches.filter((m) => m.reporter_id === me.id || m.reporter_partner_id === me.id);
  const history = matches.filter((m) => m.status !== "pending");

  const decayByMode = (["singles", "doubles"] as Mode[])
    .map((mode) => ({
      mode,
      points: Math.abs(decays.filter((d) => d.mode === mode).reduce((s, d) => s + d.delta, 0)),
    }))
    .filter((d) => d.points > 0);

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <PageHeader title="Mis partidos" />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatsCard profile={me} mode="singles" />
        <StatsCard profile={me} mode="doubles" />
      </div>

      {decayByMode.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <TrendingDown className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Penalización por inactividad (últimos 30 días)</p>
            {decayByMode.map((d) => (
              <p key={d.mode} className="text-muted-foreground">
                {MODE_LABEL[d.mode]}: −{d.points} puntos.
              </p>
            ))}
            <p className="text-muted-foreground">¡Cargá un partido para frenarla!</p>
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
            Esperando al rival
          </SectionTitle>
          <ul className="divide-y rounded-xl border bg-card">
            {awaiting.map((m) => (
              <MyMatchRow
                key={m.id}
                match={m}
                playerId={me.id}
                action={m.reporter_id === me.id ? <CancelButton matchId={m.id} /> : undefined}
              />
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

function StatsCard({ profile, mode }: { profile: Profile; mode: Mode }) {
  const s = statsFor(profile, mode);
  const ranked = s.played >= MIN_MATCHES_TO_RANK;
  const stats = [
    { label: "ELO", value: s.elo, className: "text-primary" },
    { label: "PJ", value: s.played },
    { label: "V", value: s.wins, className: "text-success" },
    { label: "D", value: s.losses, className: "text-destructive" },
  ];
  return (
    <Card size="sm">
      <p className="px-4 text-xs font-semibold text-muted-foreground uppercase">{MODE_LABEL[mode]}</p>
      <CardContent className="grid grid-cols-4 divide-x text-center">
        {stats.map((st) => (
          <div key={st.label}>
            <div className={cn("text-2xl font-bold tabular-nums", st.className)}>{st.value}</div>
            <div className="text-xs text-muted-foreground">{st.label}</div>
          </div>
        ))}
      </CardContent>
      {!ranked && (
        <p className="px-4 text-center text-xs text-muted-foreground">
          Sin clasificar: te faltan {MIN_MATCHES_TO_RANK - s.played} partido(s) para el ranking oficial.
        </p>
      )}
    </Card>
  );
}

function teamElo(players: PlayerSummary[], mode: Mode) {
  if (mode === "singles") return players[0].elo;
  return players.reduce((sum, p) => sum + p.elo_doubles, 0) / players.length;
}

function IncomingMatchCard({ match, me }: { match: MatchWithPlayers; me: Profile }) {
  const p = perspective(match, me.id);
  const myTeam = p.partner ? [me, p.partner] : [me];
  const mine = teamElo(myTeam, match.mode);
  const theirs = teamElo(p.rivals, match.mode);
  const preview = p.won ? eloDelta(mine, theirs) : -eloDelta(theirs, mine);
  const reporter = match.reporter;
  const doubles = match.mode === "doubles";

  return (
    <Card className="border-primary/40 ring-2 ring-primary/10">
      <CardHeader className="flex flex-row items-center gap-3">
        <TeamAvatars players={p.rivals} size="lg" />
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="truncate">{teamName(p.rivals)}</span>
            <ModeBadge mode={match.mode} />
          </CardTitle>
          <p className="truncate text-xs text-muted-foreground">
            {doubles ? `Cargado por ${reporter.nickname}` : fullName(reporter)} · {formatDate(match.created_at)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-xl bg-muted/60 p-3 text-center">
          <div className="min-w-0">
            <div className="truncate text-xs text-muted-foreground">
              {p.partner ? `Vos & ${p.partner.nickname}` : "Vos"}
            </div>
            <div className={cn("text-3xl font-bold tabular-nums", p.won && "text-success")}>{p.myScore}</div>
          </div>
          <span className="px-3 text-xl text-muted-foreground">–</span>
          <div className="min-w-0">
            <div className="truncate text-xs text-muted-foreground">{teamName(p.rivals)}</div>
            <div className={cn("text-3xl font-bold tabular-nums", !p.won && "text-success")}>{p.rivalScore}</div>
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          Si confirmás:{" "}
          <b className={preview >= 0 ? "text-success" : "text-destructive"}>
            {signed(preview)} ELO{doubles && " para cada uno"}
          </b>
          {doubles && p.partner && (
            <span className="block text-xs">Alcanza con que confirme uno de los dos ({p.partner.nickname} también puede).</span>
          )}
        </p>
        <ConfirmRejectButtons matchId={match.id} />
      </CardContent>
    </Card>
  );
}
