-- =====================================================================
-- ATP Ping Pong · BlueBoot — Esquema de base de datos
--
-- Cómo usarlo: Supabase Dashboard → SQL Editor → New query → pegar todo → Run.
-- El script es idempotente: se puede volver a ejecutar sin perder datos.
--
-- Reglas de negocio implementadas acá (fuente de verdad):
--   · ELO inicial 1000, fórmula estándar con K = 32.
--   · Los partidos se cargan como 'pending' y solo impactan el ELO cuando
--     el rival los confirma (confirm_match).
--   · Clasificado = 3 o más partidos confirmados.
--   · Decay: un jugador clasificado con 14+ días sin partidos confirmados
--     pierde 10 puntos por cada semana de inactividad transcurrida
--     (a los 14 días: -20; a los 21: -30 acumulado; etc.).
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$ begin
  create type public.match_status as enum ('pending', 'confirmed', 'rejected', 'cancelled');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  first_name          text not null check (char_length(btrim(first_name)) between 1 and 50),
  last_name           text not null check (char_length(btrim(last_name)) between 1 and 50),
  nickname            text not null check (char_length(nickname) between 2 and 20 and nickname = btrim(nickname)),
  avatar_url          text check (avatar_url is null or avatar_url ~* '^https?://'),
  elo                 integer not null default 1000,
  matches_played      integer not null default 0,
  wins                integer not null default 0,
  losses              integer not null default 0,
  -- Momento en que se confirmó su último partido (base del decay).
  last_match_at       timestamptz,
  -- Semanas de inactividad ya penalizadas desde last_match_at (hace el decay idempotente).
  decay_weeks_applied integer not null default 0,
  created_at          timestamptz not null default now()
);

create unique index if not exists profiles_nickname_key on public.profiles (lower(nickname));
create index if not exists profiles_elo_idx on public.profiles (elo desc);

create table if not exists public.matches (
  id                  uuid primary key default gen_random_uuid(),
  reporter_id         uuid not null references public.profiles (id) on delete cascade,
  opponent_id         uuid not null references public.profiles (id) on delete cascade,
  reporter_score      smallint not null check (reporter_score between 0 and 99),
  opponent_score      smallint not null check (opponent_score between 0 and 99),
  winner_id           uuid generated always as (
                        case when reporter_score > opponent_score then reporter_id else opponent_id end
                      ) stored,
  status              public.match_status not null default 'pending',
  -- Snapshot al confirmar: ELO previo de cada uno y puntos transferidos al ganador.
  reporter_elo_before integer,
  opponent_elo_before integer,
  elo_delta           integer,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  constraint matches_different_players check (reporter_id <> opponent_id),
  constraint matches_no_tie check (reporter_score <> opponent_score)
);

create index if not exists matches_opponent_status_idx on public.matches (opponent_id, status);
create index if not exists matches_reporter_status_idx on public.matches (reporter_id, status);
create index if not exists matches_status_resolved_idx on public.matches (status, resolved_at desc);

-- Auditoría de cada cambio de ELO (partidos y penalizaciones por inactividad).
create table if not exists public.elo_events (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  match_id    uuid references public.matches (id) on delete set null,
  kind        text not null check (kind in ('match', 'decay')),
  delta       integer not null,
  elo_after   integer not null,
  created_at  timestamptz not null default now()
);

create index if not exists elo_events_profile_idx on public.elo_events (profile_id, created_at desc);

-- ---------------------------------------------------------------------
-- Alta automática de perfil al registrarse
-- (si el apodo está tomado o faltan datos, el usuario lo completa en /onboarding)
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.raw_user_meta_data ? 'nickname' then
    begin
      insert into public.profiles (id, first_name, last_name, nickname)
      values (
        new.id,
        btrim(new.raw_user_meta_data ->> 'first_name'),
        btrim(new.raw_user_meta_data ->> 'last_name'),
        btrim(new.raw_user_meta_data ->> 'nickname')
      );
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Decay por inactividad
-- ---------------------------------------------------------------------

create or replace function private.apply_decay_to(p_profile_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile   public.profiles%rowtype;
  v_owed      integer;
  v_penalty   integer;
begin
  select * into v_profile from public.profiles where id = p_profile_id for update;

  if not found
     or v_profile.matches_played < 3
     or v_profile.last_match_at is null
     or now() - v_profile.last_match_at < interval '14 days' then
    return 0;
  end if;

  v_owed := floor(extract(epoch from now() - v_profile.last_match_at) / 604800)::integer;
  if v_owed <= v_profile.decay_weeks_applied then
    return 0;
  end if;

  v_penalty := (v_owed - v_profile.decay_weeks_applied) * 10;

  update public.profiles
     set elo = elo - v_penalty,
         decay_weeks_applied = v_owed
   where id = p_profile_id;

  insert into public.elo_events (profile_id, kind, delta, elo_after)
  values (p_profile_id, 'decay', -v_penalty, v_profile.elo - v_penalty);

  return v_penalty;
end;
$$;

-- Aplica el decay pendiente a todos. Idempotente: se puede llamar cuantas veces se quiera.
-- La ejecuta pg_cron a diario y la app al cargar el ranking.
create or replace function public.apply_inactivity_decay()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r        record;
  v_count  integer := 0;
begin
  for r in
    select id
      from public.profiles
     where matches_played >= 3
       and last_match_at < now() - interval '14 days'
       and floor(extract(epoch from now() - last_match_at) / 604800) > decay_weeks_applied
     order by id
  loop
    if private.apply_decay_to(r.id) > 0 then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Partidos
-- ---------------------------------------------------------------------

create or replace function public.report_match(
  p_opponent_id    uuid,
  p_my_score       integer,
  p_opponent_score integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := auth.uid();
  v_hi   integer;
  v_lo   integer;
  v_id   uuid;
begin
  if v_me is null then
    raise exception 'Tenés que iniciar sesión.';
  end if;
  if not exists (select 1 from public.profiles where id = v_me) then
    raise exception 'Completá tu perfil antes de cargar partidos.';
  end if;
  if p_opponent_id is null or p_opponent_id = v_me then
    raise exception 'Elegí un rival válido.';
  end if;
  if not exists (select 1 from public.profiles where id = p_opponent_id) then
    raise exception 'El rival no existe.';
  end if;
  if p_my_score is null or p_opponent_score is null
     or p_my_score not between 0 and 99 or p_opponent_score not between 0 and 99 then
    raise exception 'Los puntajes tienen que estar entre 0 y 99.';
  end if;

  v_hi := greatest(p_my_score, p_opponent_score);
  v_lo := least(p_my_score, p_opponent_score);
  if v_hi = v_lo then
    raise exception 'No puede haber empate.';
  end if;
  if v_hi < 11 then
    raise exception 'El ganador tiene que llegar al menos a 11 puntos.';
  end if;
  if v_hi - v_lo < 2 then
    raise exception 'Se gana por 2 puntos de diferencia.';
  end if;

  if exists (
    select 1 from public.matches
     where reporter_id = v_me
       and opponent_id = p_opponent_id
       and status = 'pending'
       and created_at > now() - interval '1 minute'
  ) then
    raise exception 'Ya cargaste un partido contra este rival hace instantes.';
  end if;

  insert into public.matches (reporter_id, opponent_id, reporter_score, opponent_score)
  values (v_me, p_opponent_id, p_my_score, p_opponent_score)
  returning id into v_id;

  return v_id;
end;
$$;

-- Confirma un partido pendiente (solo el rival) y aplica el ELO. Devuelve los puntos transferidos.
create or replace function public.confirm_match(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me        uuid := auth.uid();
  v_match     public.matches%rowtype;
  v_loser_id  uuid;
  v_winner    public.profiles%rowtype;
  v_loser     public.profiles%rowtype;
  v_expected  numeric;
  v_delta     integer;
begin
  if v_me is null then
    raise exception 'Tenés que iniciar sesión.';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'El partido no existe.';
  end if;
  if v_match.opponent_id <> v_me then
    raise exception 'Solo el rival puede confirmar este partido.';
  end if;
  if v_match.status <> 'pending' then
    raise exception 'Este partido ya fue resuelto.';
  end if;

  v_loser_id := case when v_match.winner_id = v_match.reporter_id
                     then v_match.opponent_id else v_match.reporter_id end;

  -- Bloqueo en orden estable para evitar deadlocks entre confirmaciones simultáneas.
  perform 1 from public.profiles
   where id in (v_match.reporter_id, v_match.opponent_id)
   order by id
   for update;

  -- Cobrar cualquier decay pendiente antes de calcular con el ELO vigente.
  perform private.apply_decay_to(v_match.reporter_id);
  perform private.apply_decay_to(v_match.opponent_id);

  select * into v_winner from public.profiles where id = v_match.winner_id;
  select * into v_loser  from public.profiles where id = v_loser_id;

  -- ELO estándar: E = 1 / (1 + 10^((Rb - Ra) / 400)), Δ = K · (S - E), K = 32
  v_expected := 1 / (1 + power(10::numeric, (v_loser.elo - v_winner.elo) / 400.0));
  v_delta    := round(32 * (1 - v_expected))::integer;

  update public.profiles
     set elo = elo + v_delta,
         matches_played = matches_played + 1,
         wins = wins + 1,
         last_match_at = now(),
         decay_weeks_applied = 0
   where id = v_winner.id;

  update public.profiles
     set elo = elo - v_delta,
         matches_played = matches_played + 1,
         losses = losses + 1,
         last_match_at = now(),
         decay_weeks_applied = 0
   where id = v_loser.id;

  update public.matches
     set status = 'confirmed',
         resolved_at = now(),
         elo_delta = v_delta,
         reporter_elo_before = case when v_match.reporter_id = v_winner.id then v_winner.elo else v_loser.elo end,
         opponent_elo_before = case when v_match.opponent_id = v_winner.id then v_winner.elo else v_loser.elo end
   where id = p_match_id;

  insert into public.elo_events (profile_id, match_id, kind, delta, elo_after)
  values (v_winner.id, p_match_id, 'match',  v_delta, v_winner.elo + v_delta),
         (v_loser.id,  p_match_id, 'match', -v_delta, v_loser.elo  - v_delta);

  return v_delta;
end;
$$;

create or replace function public.reject_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.matches
     set status = 'rejected', resolved_at = now()
   where id = p_match_id
     and opponent_id = auth.uid()
     and status = 'pending';
  if not found then
    raise exception 'No se pudo rechazar: el partido no existe, no sos el rival o ya fue resuelto.';
  end if;
end;
$$;

create or replace function public.cancel_match(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.matches
     set status = 'cancelled', resolved_at = now()
   where id = p_match_id
     and reporter_id = auth.uid()
     and status = 'pending';
  if not found then
    raise exception 'No se pudo cancelar: el partido no existe, no lo cargaste vos o ya fue resuelto.';
  end if;
end;
$$;

create or replace function public.is_nickname_available(p_nickname text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles
     where lower(nickname) = lower(btrim(p_nickname))
       and id is distinct from auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- Permisos y Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.matches    enable row level security;
alter table public.elo_events enable row level security;

revoke all on public.profiles, public.matches, public.elo_events from anon, authenticated;
grant select on public.profiles, public.matches, public.elo_events to authenticated;
-- Los campos de ELO/estadísticas solo los modifican las funciones de arriba.
grant insert (id, first_name, last_name, nickname, avatar_url) on public.profiles to authenticated;
grant update (first_name, last_name, nickname, avatar_url) on public.profiles to authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches
  for select to authenticated
  using (status = 'confirmed' or (select auth.uid()) in (reporter_id, opponent_id));

drop policy if exists elo_events_select_own on public.elo_events;
create policy elo_events_select_own on public.elo_events
  for select to authenticated using (profile_id = (select auth.uid()));

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function private.apply_decay_to(uuid) from public, anon, authenticated;

revoke execute on function public.apply_inactivity_decay()             from public, anon;
revoke execute on function public.report_match(uuid, integer, integer) from public, anon;
revoke execute on function public.confirm_match(uuid)                  from public, anon;
revoke execute on function public.reject_match(uuid)                   from public, anon;
revoke execute on function public.cancel_match(uuid)                   from public, anon;
revoke execute on function public.is_nickname_available(text)          from public;

grant execute on function public.apply_inactivity_decay()             to authenticated;
grant execute on function public.report_match(uuid, integer, integer) to authenticated;
grant execute on function public.confirm_match(uuid)                  to authenticated;
grant execute on function public.reject_match(uuid)                   to authenticated;
grant execute on function public.cancel_match(uuid)                   to authenticated;
grant execute on function public.is_nickname_available(text)          to anon, authenticated;

-- ---------------------------------------------------------------------
-- Cron diario del decay (03:00 UTC). Si pg_cron no está disponible,
-- el decay igual se aplica cada vez que alguien abre el ranking.
-- ---------------------------------------------------------------------

do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('pingpong-inactivity-decay', '0 3 * * *', 'select public.apply_inactivity_decay()');
exception when others then
  raise notice 'pg_cron no disponible (%). El decay se aplicará al cargar el ranking.', sqlerrm;
end $$;
