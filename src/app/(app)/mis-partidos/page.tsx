import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Hourglass, Inbox, PartyPopper, Plus, Swords, TrendingDown, Trophy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, SectionTitle } from "@/components/page-header";
import { PlayerAvatar } from "@/components/player-avatar";
import { CancelButton, ConfirmRejectButtons, type MatchTarget } from "@/components/match-actions";
import { DeltaPill, ModeBadge, MyMatchRow, perspective, TeamAvatars, teamName } from "@/components/match-views";
import { getSession, involving, MATCH_FIELDS, PLAYER_FIELDS } from "@/lib/data";
import { seriesDelta, teamElo } from "@/lib/elo";
import { daysAgoIso, formatDate, playerHref } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { EloEvent, MatchWithPlayers, PlayerSummary, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Mis partidos" };

/** Partidos pendientes agrupados: una serie (mismo batch_id) o un partido suelto. */
type PendingGroup = { key: string; matches: MatchWithPlayers[]; target: MatchTarget };

function groupPending(matches: MatchWithPlayers[]): PendingGroup[] {
  const groups = new Map<string, MatchWithPlayers[]>();
  for (const m of matches) {
    const key = m.batch_id ?? m.id;
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups.entries()].map(([key, list]) => {
    const sorted = list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return {
      key,
      matches: sorted,
      target: sorted[0].batch_id ? { batchId: sorted[0].batch_id } : { matchId: sorted[0].id },
    };
  });
}

export default async function MyMatchesPage() {
  const { profile } = await getSession();
  const me = profile!;
  const supabase = await createClient();

  const [{ data: matchData }, { data: decayData }, { data: challengeData }] = await Promise.all([
    supabase
      .from("matches")
      .select(MATCH_FIELDS)
      .or(involving(me.id))
      .order("created_at", { ascending: false })
      .limit(150),
    supabase
      .from("elo_events")
      .select("id, kind, mode, delta, elo_after, created_at")
      .eq("profile_id", me.id)
      .eq("kind", "decay")
      .eq("scope", "global")
      .gte("created_at", daysAgoIso(30)),
    supabase
      .from("challenges")
      .select(`id, created_at, challenger:profiles!challenges_challenger_id_fkey(${PLAYER_FIELDS})`)
      .eq("challenged_id", me.id)
      .gte("created_at", daysAgoIso(3))
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Un desafío por jugador (el más reciente), de los últimos 3 días.
  const challenges = new Map<string, { player: PlayerSummary; at: string }>();
  for (const c of (challengeData ?? []) as unknown as { created_at: string; challenger: PlayerSummary }[]) {
    if (!challenges.has(c.challenger.id)) challenges.set(c.challenger.id, { player: c.challenger, at: c.created_at });
  }

  const matches = (matchData ?? []) as unknown as MatchWithPlayers[];
  const decayPoints = -((decayData ?? []) as EloEvent[]).reduce((s, d) => s + d.delta, 0);
  const pendingMatches = matches.filter((m) => m.status === "pending");
  const toConfirm = groupPending(
    pendingMatches.filter((m) => m.opponent_id === me.id || m.opponent_partner_id === me.id),
  );
  const awaiting = groupPending(
    pendingMatches.filter((m) => m.reporter_id === me.id || m.reporter_partner_id === me.id),
  );
  const history = matches.filter((m) => m.status !== "pending");

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

      {decayPoints > 0 && (
        <div className="flex items-center gap-2.5 rounded-2xl bg-destructive/10 px-3 py-2.5 text-sm">
          <TrendingDown className="size-4 shrink-0 text-destructive" />
          <p>
            <b className="tabular-nums text-destructive">−{decayPoints} AURA</b> por inactividad este mes
          </p>
        </div>
      )}

      {challenges.size > 0 && (
        <section className="grid gap-3">
          <SectionTitle icon={Swords} count={challenges.size}>
            Te desafiaron
          </SectionTitle>
          <ul className="grid gap-2">
            {[...challenges.values()].map(({ player, at }) => (
              <li
                key={player.id}
                className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-accent/50 p-3 shadow-sm"
              >
                <Link prefetch={false} href={playerHref(player.id, me.id)} className="flex min-w-0 flex-1 items-center gap-3">
                  <PlayerAvatar player={player} size={44} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{player.nickname} te desafió</span>
                    <span className="block text-xs text-muted-foreground">{formatDate(at)}</span>
                  </span>
                </Link>
                <Link
                  href={`/cargar?rival=${player.id}`}
                  className={cn(buttonVariants({ size: "sm" }), "bg-brand rounded-full px-3")}
                >
                  Jugar
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-3">
        <SectionTitle icon={Inbox} count={toConfirm.length}>
          Para confirmar
        </SectionTitle>
        {toConfirm.length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl bg-muted/60 px-3 py-2.5 text-sm text-muted-foreground">
            <PartyPopper className="size-4 shrink-0 text-primary" /> Nada para confirmar
          </p>
        ) : (
          toConfirm.map((g) => <IncomingCard key={g.key} group={g} me={me} />)
        )}
      </section>

      {awaiting.length > 0 && (
        <section className="grid gap-3">
          <SectionTitle icon={Hourglass} count={awaiting.length}>
            Esperando al rival
          </SectionTitle>
          <ul className="divide-y overflow-hidden rounded-2xl border bg-card shadow-sm">
            {awaiting.map((g) => {
              const canCancel = g.matches[0].reporter_id === me.id;
              const action = canCancel ? <CancelButton target={g.target} /> : undefined;
              return g.matches.length === 1 ? (
                <MyMatchRow key={g.key} match={g.matches[0]} playerId={me.id} action={action} />
              ) : (
                <SeriesRow key={g.key} group={g} me={me} action={action} />
              );
            })}
          </ul>
        </section>
      )}

      <section className="grid gap-3">
        <SectionTitle icon={Clock}>Historial</SectionTitle>
        {history.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Todavía no jugaste"
            action={
              <Link href="/cargar" className={buttonVariants()}>
                <Plus /> Cargar partido
              </Link>
            }
          />
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

/** Resultados de la serie desde mi punto de vista (true = gané), en orden. */
function myResults(group: PendingGroup, playerId: string) {
  return group.matches.map((m) => perspective(m, playerId).won);
}

function ResultChips({ results }: { results: boolean[] }) {
  return (
    <ol className="flex flex-wrap justify-center gap-1.5" aria-label="Resultados en orden">
      {results.map((won, i) => (
        <li
          key={i}
          className={cn(
            "flex size-7 items-center justify-center rounded-lg text-xs font-extrabold text-white",
            won ? "bg-emerald-500" : "bg-slate-500",
          )}
        >
          {won ? "G" : "P"}
        </li>
      ))}
    </ol>
  );
}

function SeriesRow({ group, me, action }: { group: PendingGroup; me: Profile; action?: React.ReactNode }) {
  const first = perspective(group.matches[0], me.id);
  const results = myResults(group, me.id);
  const wins = results.filter(Boolean).length;
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span aria-hidden className="h-10 w-1 shrink-0 rounded-full bg-muted-foreground/30" />
      <TeamAvatars players={first.rivals} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          <b>{group.matches.length} partidos</b> vs {teamName(first.rivals)}
        </p>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ModeBadge mode={group.matches[0].mode} />
          <span className="font-semibold text-success">{wins}G</span>
          <span className="font-semibold text-destructive">{results.length - wins}P</span>
          {formatDate(group.matches[0].created_at)}
        </p>
      </div>
      {action}
    </li>
  );
}

function IncomingCard({ group, me }: { group: PendingGroup; me: Profile }) {
  const match = group.matches[0];
  const p = perspective(match, me.id);
  const myTeam: PlayerSummary[] = p.partner ? [me, p.partner] : [me];
  const results = myResults(group, me.id);
  const wins = results.filter(Boolean).length;
  const series = results.length > 1;
  const preview = seriesDelta(teamElo(myTeam, match.mode), teamElo(p.rivals, match.mode), results);
  const doubles = match.mode === "doubles";
  const iWonMore = wins * 2 > results.length;
  const tie = wins * 2 === results.length;

  return (
    <Card className="gap-4 border-primary/30 py-4 shadow-md ring-2 ring-primary/10">
      <CardContent className="grid gap-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">
            <b>{match.reporter.nickname}</b> cargó {series ? `${results.length} partidos` : "un partido"}
          </p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ModeBadge mode={match.mode} />
            {formatDate(match.created_at)}
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl bg-muted/60 p-3 text-center">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <TeamResult
              players={myTeam}
              label={p.partner ? `Vos & ${p.partner.nickname}` : "Vos"}
              wins={wins}
              highlight={iWonMore || (!series && p.won)}
              series={series}
            />
            <span className="text-xs font-black text-muted-foreground">{series ? "–" : "VS"}</span>
            <TeamResult
              players={p.rivals}
              label={teamName(p.rivals)}
              wins={results.length - wins}
              highlight={!iWonMore && !tie}
              series={series}
            />
          </div>
          {series && <ResultChips results={results} />}
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Si confirmás <DeltaPill delta={preview} suffix={doubles ? " AURA c/u" : " AURA"} />
        </p>
        <ConfirmRejectButtons target={group.target} count={results.length} />
      </CardContent>
    </Card>
  );
}

function TeamResult({
  players,
  label,
  wins,
  highlight,
  series,
}: {
  players: PlayerSummary[];
  label: string;
  wins: number;
  highlight: boolean;
  series: boolean;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col items-center gap-1.5", !highlight && "opacity-60")}>
      <TeamAvatars players={players} size="lg" />
      <span className="w-full truncate text-sm font-semibold">{label}</span>
      {series ? (
        <span className="text-2xl leading-none font-extrabold tabular-nums">{wins}</span>
      ) : highlight ? (
        <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[0.65rem] font-bold text-amber-950 uppercase">
          <Trophy className="size-3" /> Ganó
        </span>
      ) : (
        <span className="text-[0.65rem] font-semibold text-muted-foreground uppercase">Perdió</span>
      )}
    </div>
  );
}
