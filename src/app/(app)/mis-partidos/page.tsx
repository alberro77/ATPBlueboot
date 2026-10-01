import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Hourglass, Inbox, PartyPopper, Plus, TrendingDown, Trophy } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, PageHeader, SectionTitle } from "@/components/page-header";
import { CancelButton, ConfirmRejectButtons } from "@/components/match-actions";
import { DeltaPill, ModeBadge, MyMatchRow, perspective, TeamAvatars, teamName } from "@/components/match-views";
import { getSession, involving, MATCH_FIELDS } from "@/lib/data";
import { eloDelta, teamElo } from "@/lib/elo";
import { daysAgoIso, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { EloEvent, MatchWithPlayers, PlayerSummary, Profile } from "@/lib/types";
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
      .gte("created_at", daysAgoIso(30)),
  ]);

  const matches = (matchData ?? []) as unknown as MatchWithPlayers[];
  const decayPoints = -((decayData ?? []) as EloEvent[]).reduce((s, d) => s + d.delta, 0);
  const pendingMatches = matches.filter((m) => m.status === "pending");
  const toConfirm = pendingMatches.filter((m) => m.opponent_id === me.id || m.opponent_partner_id === me.id);
  const awaiting = pendingMatches.filter((m) => m.reporter_id === me.id || m.reporter_partner_id === me.id);
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
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <TrendingDown className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-semibold">Perdiste {decayPoints} puntos por inactividad este mes</p>
            <p className="text-muted-foreground">Jugá un partido para frenar el descuento.</p>
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
        <SectionTitle icon={Clock}>Historial</SectionTitle>
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

function IncomingMatchCard({ match, me }: { match: MatchWithPlayers; me: Profile }) {
  const p = perspective(match, me.id);
  const myTeam: PlayerSummary[] = p.partner ? [me, p.partner] : [me];
  const mine = teamElo(myTeam);
  const theirs = teamElo(p.rivals);
  const preview = p.won ? eloDelta(mine, theirs) : -eloDelta(theirs, mine);
  const doubles = match.mode === "doubles";

  return (
    <Card className="gap-4 border-primary/30 py-4 shadow-md ring-2 ring-primary/10">
      <CardContent className="grid gap-4 px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm">
            <b>{match.reporter.nickname}</b> cargó un partido
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
          ¿Es correcto? Si confirmás: <DeltaPill delta={preview} suffix={doubles ? " ELO c/u" : " ELO"} />
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
