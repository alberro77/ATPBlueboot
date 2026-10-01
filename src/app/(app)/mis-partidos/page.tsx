import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Flame, Hourglass, Inbox, PartyPopper, Plus, TrendingDown, Trophy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, SectionTitle } from "@/components/page-header";
import { CancelButton, ConfirmRejectButtons } from "@/components/match-actions";
import { DeltaPill, ModeBadge, MyMatchRow, perspective, TeamAvatars, teamName } from "@/components/match-views";
import { getSession, involving, MATCH_FIELDS } from "@/lib/data";
import { eloDelta, MIN_MATCHES_TO_RANK } from "@/lib/elo";
import { daysAgoIso, formatDate } from "@/lib/format";
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
    <div className="mx-auto grid max-w-2xl gap-7">
      <PageHeader
        title="Mis partidos"
        action={
          <Link href="/cargar" className={cn(buttonVariants({ size: "lg" }), "bg-brand hidden sm:inline-flex")}>
            <Plus /> Cargar
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatsCard profile={me} mode="singles" matches={history} />
        <StatsCard profile={me} mode="doubles" matches={history} />
      </div>

      {decayByMode.length > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <TrendingDown className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold">Penalización por inactividad (últimos 30 días)</p>
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
          <EmptyState icon={PartyPopper} title="¡Estás al día!">
            Cuando alguien cargue un partido contra vos, lo vas a ver acá para confirmarlo.
          </EmptyState>
        ) : (
          toConfirm.map((m) => <IncomingMatchCard key={m.id} match={m} me={me} />)
        )}
      </section>

      {awaiting.length > 0 && (
        <section className="grid gap-3">
          <SectionTitle icon={Hourglass} count={awaiting.length}>
            Esperando al rival
          </SectionTitle>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
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
          <EmptyState
            icon={Trophy}
            title="Todavía no jugaste"
            action={
              <Link href="/cargar" className={buttonVariants()}>
                <Plus /> Cargar mi primer partido
              </Link>
            }
          >
            Jugá un partido y cargalo: tu historial y tu ELO aparecen acá.
          </EmptyState>
        ) : (
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
            {history.map((m) => (
              <MyMatchRow key={m.id} match={m} playerId={me.id} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Últimos resultados confirmados y racha actual en una modalidad. */
function recentForm(matches: MatchWithPlayers[], playerId: string, mode: Mode) {
  const results = matches
    .filter((m) => m.status === "confirmed" && m.mode === mode)
    .sort((a, b) => (b.resolved_at ?? b.created_at).localeCompare(a.resolved_at ?? a.created_at))
    .map((m) => perspective(m, playerId).won);
  let streak = 0;
  while (streak < results.length && results[streak] === results[0]) streak++;
  return { last: results.slice(0, 5), streak, winning: results[0] === true };
}

function StatsCard({ profile, mode, matches }: { profile: Profile; mode: Mode; matches: MatchWithPlayers[] }) {
  const s = statsFor(profile, mode);
  const ranked = s.played >= MIN_MATCHES_TO_RANK;
  const form = recentForm(matches, profile.id, mode);
  const winRate = s.played > 0 ? Math.round((s.wins / s.played) * 100) : null;

  return (
    <Card className="gap-3 py-4">
      <CardContent className="grid gap-3 px-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-muted-foreground uppercase">{MODE_LABEL[mode]}</span>
          {ranked ? (
            <span className="rounded-full bg-accent px-2 py-0.5 text-[0.7rem] font-semibold text-accent-foreground">
              Clasificado
            </span>
          ) : (
            <span className="text-[0.7rem] text-muted-foreground">
              {s.played}/{MIN_MATCHES_TO_RANK} para clasificar
            </span>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div>
            <div className="text-3xl leading-none font-extrabold tabular-nums text-primary">{s.elo}</div>
            <div className="mt-1 text-xs text-muted-foreground">ELO</div>
          </div>
          <div className="flex gap-4 text-center">
            <Stat label="PJ" value={s.played} />
            <Stat label="V" value={s.wins} className="text-success" />
            <Stat label="D" value={s.losses} className="text-destructive" />
            {winRate !== null && <Stat label="Efect." value={`${winRate}%`} />}
          </div>
        </div>
        {form.last.length > 0 && (
          <div className="flex items-center justify-between border-t pt-3">
            <div className="flex items-center gap-1" aria-label="Últimos resultados">
              {form.last.map((won, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[0.6rem] font-bold text-white",
                    won ? "bg-success" : "bg-destructive",
                  )}
                >
                  {won ? "V" : "D"}
                </span>
              ))}
            </div>
            {form.streak >= 2 && (
              <span
                className={cn(
                  "flex items-center gap-1 text-xs font-semibold",
                  form.winning ? "text-orange-500" : "text-muted-foreground",
                )}
              >
                {form.winning && <Flame className="size-3.5 fill-orange-400" />}
                {form.streak} {form.winning ? "victorias" : "derrotas"} seguidas
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, className }: { label: string; value: number | string; className?: string }) {
  return (
    <div>
      <div className={cn("text-base leading-none font-bold tabular-nums", className)}>{value}</div>
      <div className="mt-1 text-[0.7rem] text-muted-foreground">{label}</div>
    </div>
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
  const doubles = match.mode === "doubles";
  const reporter = match.reporter.nickname;

  return (
    <Card className="gap-4 border-primary/30 py-4 shadow-md ring-2 ring-primary/10">
      <CardContent className="grid gap-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">
            <b>{reporter}</b> {doubles ? "cargó un partido de dobles" : "cargó un partido"}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ModeBadge mode={match.mode} />
            {formatDate(match.created_at)}
          </div>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl bg-muted/60 p-3 text-center">
          <TeamResult players={myTeam} label={p.partner ? `Vos & ${p.partner.nickname}` : "Vos"} won={p.won} />
          <span className="text-xs font-black text-muted-foreground">VS</span>
          <TeamResult players={p.rivals} label={teamName(p.rivals)} won={!p.won} />
        </div>

        <p className="text-center text-sm">
          {p.won ? "¿Ganaste?" : "¿Perdiste?"} Si confirmás:{" "}
          <DeltaPill delta={preview} suffix={doubles ? " ELO c/u" : " ELO"} />
        </p>
        {doubles && p.partner && (
          <p className="-mt-2 text-center text-xs text-muted-foreground">
            Alcanza con que confirme uno de los dos ({p.partner.nickname} también puede).
          </p>
        )}
        <ConfirmRejectButtons matchId={match.id} />
      </CardContent>
    </Card>
  );
}

function TeamResult({ players, label, won }: { players: PlayerSummary[]; label: string; won: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-1.5", !won && "opacity-60")}>
      <TeamAvatars players={players} size="lg" />
      <span className="w-full truncate text-sm font-semibold">{label}</span>
      {won ? (
        <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[0.65rem] font-bold text-amber-950 uppercase">
          <Trophy className="size-3" /> Ganó
        </span>
      ) : (
        <span className="text-[0.65rem] font-semibold text-muted-foreground uppercase">Perdió</span>
      )}
    </div>
  );
}
