-- =====================================================================
-- ATP Ping Pong · BlueBoot — Esquema de base de datos
--
-- Cómo usarlo: Supabase Dashboard → SQL Editor → New query → pegar todo → Run.
-- El script es idempotente: se puede volver a ejecutar sin perder datos
-- (también sirve para migrar una base creada con una versión anterior).
--
-- Reglas de negocio implementadas acá (fuente de verdad):
--   · Dos modalidades con ELO independiente: singles (1v1) y dobles (2v2).
--   · ELO inicial 1000, fórmula estándar con K = 32. En dobles se usa el
--     promedio de cada equipo y el resultado (+X / -X) se aplica igual a
--     los 4 jugadores.
--   · Los partidos se cargan como 'pending' y solo impactan el ELO cuando
--     el rival (en dobles: cualquiera de los dos rivales) los confirma.
--   · Clasificado = 3 o más partidos confirmados en esa modalidad.
--   · Decay por modalidad: un jugador clasificado con 7+ días sin partidos
--     confirmados en esa modalidad pierde 10 puntos por cada semana de
--     inactividad transcurrida (a los 7 días: -10; a los 14: -20 acumulado; etc.).
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$ begin
  create type public.match_status as enum ('pending', 'confirmed', 'rejected', 'cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.match_mode as enum ('singles', 'doubles');
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
  -- Singles (1v1)
  elo                 integer not null default 1000,
  matches_played      integer not null default 0,
  wins                integer not null default 0,
  losses              integer not null default 0,
  -- Momento en que se confirmó su último partido de singles (base del decay).
  last_match_at       timestamptz,
  -- Semanas de inactividad ya penalizadas desde last_match_at (hace el decay idempotente).
  decay_weeks_applied integer not null default 0,
  created_at          timestamptz not null default now()
);

-- Dobles (2v2): mismas estadísticas, independientes de singles.
alter table public.profiles
  add column if not exists elo_doubles                 integer not null default 1000,
  add column if not exists doubles_played              integer not null default 0,
  add column if not exists doubles_wins                integer not null default 0,
  add column if not exists doubles_losses              integer not null default 0,
  add column if not exists doubles_last_match_at       timestamptz,
  add column if not exists doubles_decay_weeks_applied integer not null default 0;

create unique index if not exists profiles_nickname_key on public.profiles (lower(nickname));
create index if not exists profiles_elo_idx on public.profiles (elo desc);
create index if not exists profiles_elo_doubles_idx on public.profiles (elo_doubles desc);

-- Equipo A = reporter_id (+ reporter_partner_id en dobles): quien carga el partido.
-- Equipo B = opponent_id (+ opponent_partner_id en dobles): quien confirma.
-- reporter_score / opponent_score son los puntos de cada equipo.
create table if not exists public.matches (
  id                  uuid primary key default gen_random_uuid(),
  reporter_id         uuid not null references public.profiles (id) on delete cascade,
  opponent_id         uuid not null references public.profiles (id) on delete cascade,
  reporter_score      smallint not null check (reporter_score between 0 and 99),
  opponent_score      smallint not null check (opponent_score between 0 and 99),
  -- Jugador 1 del equipo ganador.
  winner_id           uuid generated always as (
                        case when reporter_score > opponent_score then reporter_id else opponent_id end
                      ) stored,
  status              public.match_status not null default 'pending',
  -- Snapshot al confirmar: ELO previo de cada uno (de la modalidad) y puntos transferidos.
  reporter_elo_before integer,
  opponent_elo_before integer,
  elo_delta           integer,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  constraint matches_different_players check (reporter_id <> opponent_id),
  constraint matches_no_tie check (reporter_score <> opponent_score)
);

alter table public.matches
  add column if not exists mode                        public.match_mode not null default 'singles',
  add column if not exists reporter_partner_id         uuid references public.profiles (id) on delete cascade,
  add column if not exists opponent_partner_id         uuid references public.profiles (id) on delete cascade,
  add column if not exists reporter_partner_elo_before integer,
  add column if not exists opponent_partner_elo_before integer,
  add column if not exists confirmed_by                uuid references public.profiles (id) on delete set null;

alter table public.matches drop constraint if exists matches_mode_players;
alter table public.matches add constraint matches_mode_players check (
  (mode = 'singles' and reporter_partner_id is null and opponent_partner_id is null)
  or (
    mode = 'doubles'
    and reporter_partner_id is not null
    and opponent_partner_id is not null
    and reporter_partner_id not in (reporter_id, opponent_id, opponent_partner_id)
    and opponent_partner_id not in (reporter_id, opponent_id)
  )
);

create index if not exists matches_opponent_status_idx on public.matches (opponent_id, status);
create index if not exists matches_reporter_status_idx on public.matches (reporter_id, status);
create index if not exists matches_opponent_partner_status_idx on public.matches (opponent_partner_id, status);
create index if not exists matches_reporter_partner_status_idx on public.matches (reporter_partner_id, status);
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

alter table public.elo_events
  add column if not exists mode public.match_mode not null default 'singles';

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
-- Decay por inactividad (independiente por modalidad)
-- ---------------------------------------------------------------------

-- Versión anterior (solo singles).
drop function if exists private.apply_decay_to(uuid);

create or replace function private.apply_decay_to(p_profile_id uuid, p_mode public.match_mode)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_elo      integer;
  v_played   integer;
  v_last     timestamptz;
  v_applied  integer;
  v_owed     integer;
  v_penalty  integer;
begin
  if p_mode = 'singles' then
    select elo, matches_played, last_match_at, decay_weeks_applied
      into v_elo, v_played, v_last, v_applied
      from public.profiles where id = p_profile_id for update;
  else
    select elo_doubles, doubles_played, doubles_last_match_at, doubles_decay_weeks_applied
      into v_elo, v_played, v_last, v_applied
      from public.profiles where id = p_profile_id for update;
  end if;

  if not found or v_played < 3 or v_last is null or now() - v_last < interval '7 days' then
    return 0;
  end if;

  v_owed := floor(extract(epoch from now() - v_last) / 604800)::integer;
  if v_owed <= v_applied then
    return 0;
  end if;

  v_penalty := (v_owed - v_applied) * 10;

  if p_mode = 'singles' then
    update public.profiles
       set elo = elo - v_penalty, decay_weeks_applied = v_owed
     where id = p_profile_id;
  else
    update public.profiles
       set elo_doubles = elo_doubles - v_penalty, doubles_decay_weeks_applied = v_owed
     where id = p_profile_id;
  end if;

  insert into public.elo_events (profile_id, kind, mode, delta, elo_after)
  values (p_profile_id, 'decay', p_mode, -v_penalty, v_elo - v_penalty);

  return v_penalty;
end;
$$;

-- Aplica el decay pendiente a todos, en ambas modalidades. Idempotente.
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
    select id, 'singles'::public.match_mode as mode
      from public.profiles
     where matches_played >= 3
       and last_match_at < now() - interval '7 days'
       and floor(extract(epoch from now() - last_match_at) / 604800) > decay_weeks_applied
    union all
    select id, 'doubles'::public.match_mode
      from public.profiles
     where doubles_played >= 3
       and doubles_last_match_at < now() - interval '7 days'
       and floor(extract(epoch from now() - doubles_last_match_at) / 604800) > doubles_decay_weeks_applied
     order by 1
  loop
    if private.apply_decay_to(r.id, r.mode) > 0 then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Carga de partidos
-- ---------------------------------------------------------------------

create or replace function private.validate_score(p_a integer, p_b integer)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_hi integer := greatest(p_a, p_b);
  v_lo integer := least(p_a, p_b);
begin
  if p_a is null or p_b is null or p_a not between 0 and 99 or p_b not between 0 and 99 then
    raise exception 'Los puntajes tienen que estar entre 0 y 99.';
  end if;
  if v_hi = v_lo then
    raise exception 'No puede haber empate.';
  end if;
  if v_hi < 11 then
    raise exception 'El ganador tiene que llegar al menos a 11 puntos.';
  end if;
  if v_hi - v_lo < 2 then
    raise exception 'Se gana por 2 puntos de diferencia.';
  end if;
end;
$$;

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
  v_me  uuid := auth.uid();
  v_id  uuid;
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
  perform private.validate_score(p_my_score, p_opponent_score);

  if exists (
    select 1 from public.matches
     where mode = 'singles'
       and reporter_id = v_me
       and opponent_id = p_opponent_id
       and status = 'pending'
       and created_at > now() - interval '1 minute'
  ) then
    raise exception 'Ya cargaste un partido contra este rival hace instantes.';
  end if;

  insert into public.matches (mode, reporter_id, opponent_id, reporter_score, opponent_score)
  values ('singles', v_me, p_opponent_id, p_my_score, p_opponent_score)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.report_doubles_match(
  p_partner_id          uuid,
  p_opponent_id         uuid,
  p_opponent_partner_id uuid,
  p_my_score            integer,
  p_opponent_score      integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me  uuid := auth.uid();
  v_id  uuid;
begin
  if v_me is null then
    raise exception 'Tenés que iniciar sesión.';
  end if;
  if not exists (select 1 from public.profiles where id = v_me) then
    raise exception 'Completá tu perfil antes de cargar partidos.';
  end if;
  if p_partner_id is null or p_opponent_id is null or p_opponent_partner_id is null then
    raise exception 'Elegí a tu compañero y a los dos rivales.';
  end if;
  if (select count(distinct x) from unnest(array[v_me, p_partner_id, p_opponent_id, p_opponent_partner_id]) as x) <> 4 then
    raise exception 'Los cuatro jugadores tienen que ser distintos.';
  end if;
  if (select count(*) from public.profiles where id in (p_partner_id, p_opponent_id, p_opponent_partner_id)) <> 3 then
    raise exception 'Alguno de los jugadores no existe.';
  end if;
  perform private.validate_score(p_my_score, p_opponent_score);

  if exists (
    select 1 from public.matches
     where mode = 'doubles'
       and reporter_id = v_me
       and status = 'pending'
       and created_at > now() - interval '1 minute'
  ) then
    raise exception 'Ya cargaste un partido de dobles hace instantes.';
  end if;

  insert into public.matches (
    mode, reporter_id, reporter_partner_id, opponent_id, opponent_partner_id, reporter_score, opponent_score
  )
  values (
    'doubles', v_me, p_partner_id, p_opponent_id, p_opponent_partner_id, p_my_score, p_opponent_score
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Confirmación y cálculo de ELO
-- ELO estándar: E = 1 / (1 + 10^((Rb - Ra) / 400)), Δ = round(K · (1 - E)), K = 32
-- ---------------------------------------------------------------------

create or replace function private.elo_delta(p_winner numeric, p_loser numeric)
returns integer
language sql
immutable
set search_path = ''
as $$
  select round(32 * (1 - 1 / (1 + power(10::numeric, (p_loser - p_winner) / 400.0))))::integer;
$$;

create or replace function private.settle_singles(p_match public.matches)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_loser_id  uuid := case when p_match.winner_id = p_match.reporter_id
                           then p_match.opponent_id else p_match.reporter_id end;
  v_r_elo     integer;
  v_o_elo     integer;
  v_delta     integer;
begin
  -- Bloqueo en orden estable para evitar deadlocks entre confirmaciones simultáneas.
  perform 1 from public.profiles
   where id in (p_match.reporter_id, p_match.opponent_id)
   order by id
   for update;

  -- Cobrar cualquier decay pendiente antes de calcular con el ELO vigente.
  perform private.apply_decay_to(p_match.reporter_id, 'singles');
  perform private.apply_decay_to(p_match.opponent_id, 'singles');

  select elo into v_r_elo from public.profiles where id = p_match.reporter_id;
  select elo into v_o_elo from public.profiles where id = p_match.opponent_id;

  v_delta := case when p_match.winner_id = p_match.reporter_id
                  then private.elo_delta(v_r_elo, v_o_elo)
                  else private.elo_delta(v_o_elo, v_r_elo) end;

  update public.profiles
     set elo = elo + v_delta, matches_played = matches_played + 1, wins = wins + 1,
         last_match_at = now(), decay_weeks_applied = 0
   where id = p_match.winner_id;

  update public.profiles
     set elo = elo - v_delta, matches_played = matches_played + 1, losses = losses + 1,
         last_match_at = now(), decay_weeks_applied = 0
   where id = v_loser_id;

  update public.matches
     set elo_delta = v_delta, reporter_elo_before = v_r_elo, opponent_elo_before = v_o_elo
   where id = p_match.id;

  insert into public.elo_events (profile_id, match_id, kind, mode, delta, elo_after)
  select id, p_match.id, 'match', 'singles',
         case when id = p_match.winner_id then v_delta else -v_delta end, elo
    from public.profiles
   where id in (p_match.reporter_id, p_match.opponent_id);

  return v_delta;
end;
$$;

create or replace function private.settle_doubles(p_match public.matches)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_players  uuid[] := array[p_match.reporter_id, p_match.reporter_partner_id,
                             p_match.opponent_id, p_match.opponent_partner_id];
  v_a_won    boolean := p_match.reporter_score > p_match.opponent_score;
  v_winners  uuid[];
  v_a1       integer;
  v_a2       integer;
  v_b1       integer;
  v_b2       integer;
  v_a_avg    numeric;
  v_b_avg    numeric;
  v_delta    integer;
  v_id       uuid;
begin
  perform 1 from public.profiles where id = any (v_players) order by id for update;

  foreach v_id in array v_players loop
    perform private.apply_decay_to(v_id, 'doubles');
  end loop;

  select elo_doubles into v_a1 from public.profiles where id = p_match.reporter_id;
  select elo_doubles into v_a2 from public.profiles where id = p_match.reporter_partner_id;
  select elo_doubles into v_b1 from public.profiles where id = p_match.opponent_id;
  select elo_doubles into v_b2 from public.profiles where id = p_match.opponent_partner_id;

  -- ELO del equipo = promedio de sus dos integrantes.
  v_a_avg := (v_a1 + v_a2) / 2.0;
  v_b_avg := (v_b1 + v_b2) / 2.0;

  if v_a_won then
    v_winners := array[p_match.reporter_id, p_match.reporter_partner_id];
    v_delta := private.elo_delta(v_a_avg, v_b_avg);
  else
    v_winners := array[p_match.opponent_id, p_match.opponent_partner_id];
    v_delta := private.elo_delta(v_b_avg, v_a_avg);
  end if;

  -- El mismo +X / -X para cada integrante.
  update public.profiles
     set elo_doubles = elo_doubles + v_delta, doubles_played = doubles_played + 1,
         doubles_wins = doubles_wins + 1, doubles_last_match_at = now(), doubles_decay_weeks_applied = 0
   where id = any (v_winners);

  update public.profiles
     set elo_doubles = elo_doubles - v_delta, doubles_played = doubles_played + 1,
         doubles_losses = doubles_losses + 1, doubles_last_match_at = now(), doubles_decay_weeks_applied = 0
   where id = any (v_players) and id <> all (v_winners);

  update public.matches
     set elo_delta = v_delta,
         reporter_elo_before = v_a1, reporter_partner_elo_before = v_a2,
         opponent_elo_before = v_b1, opponent_partner_elo_before = v_b2
   where id = p_match.id;

  insert into public.elo_events (profile_id, match_id, kind, mode, delta, elo_after)
  select id, p_match.id, 'match', 'doubles',
         case when id = any (v_winners) then v_delta else -v_delta end, elo_doubles
    from public.profiles
   where id = any (v_players);

  return v_delta;
end;
$$;

-- Confirma un partido pendiente y aplica el ELO. Devuelve los puntos transferidos.
-- Singles: solo el rival. Dobles: cualquiera de los dos integrantes del equipo rival.
create or replace function public.confirm_match(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := auth.uid();
  v_match  public.matches%rowtype;
  v_delta  integer;
begin
  if v_me is null then
    raise exception 'Tenés que iniciar sesión.';
  end if;

  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'El partido no existe.';
  end if;
  if v_me <> v_match.opponent_id and v_me is distinct from v_match.opponent_partner_id then
    raise exception 'Solo el equipo rival puede confirmar este partido.';
  end if;
  if v_match.status <> 'pending' then
    raise exception 'Este partido ya fue resuelto.';
  end if;

  if v_match.mode = 'singles' then
    v_delta := private.settle_singles(v_match);
  else
    v_delta := private.settle_doubles(v_match);
  end if;

  update public.matches
     set status = 'confirmed', resolved_at = now(), confirmed_by = v_me
   where id = p_match_id;

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
     set status = 'rejected', resolved_at = now(), confirmed_by = auth.uid()
   where id = p_match_id
     and (opponent_id = auth.uid() or opponent_partner_id = auth.uid())
     and status = 'pending';
  if not found then
    raise exception 'No se pudo rechazar: el partido no existe, no sos del equipo rival o ya fue resuelto.';
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
  using (
    status = 'confirmed'
    or (select auth.uid()) in (reporter_id, opponent_id)
    or (select auth.uid()) = reporter_partner_id
    or (select auth.uid()) = opponent_partner_id
  );

drop policy if exists elo_events_select_own on public.elo_events;
create policy elo_events_select_own on public.elo_events
  for select to authenticated using (profile_id = (select auth.uid()));

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

revoke execute on function public.apply_inactivity_decay()                                   from public, anon;
revoke execute on function public.report_match(uuid, integer, integer)                       from public, anon;
revoke execute on function public.report_doubles_match(uuid, uuid, uuid, integer, integer)   from public, anon;
revoke execute on function public.confirm_match(uuid)                                        from public, anon;
revoke execute on function public.reject_match(uuid)                                         from public, anon;
revoke execute on function public.cancel_match(uuid)                                         from public, anon;
revoke execute on function public.is_nickname_available(text)                                from public;

grant execute on function public.apply_inactivity_decay()                                   to authenticated;
grant execute on function public.report_match(uuid, integer, integer)                       to authenticated;
grant execute on function public.report_doubles_match(uuid, uuid, uuid, integer, integer)   to authenticated;
grant execute on function public.confirm_match(uuid)                                        to authenticated;
grant execute on function public.reject_match(uuid)                                         to authenticated;
grant execute on function public.cancel_match(uuid)                                         to authenticated;
grant execute on function public.is_nickname_available(text)                                to anon, authenticated;

-- ---------------------------------------------------------------------
-- Fotos de perfil (Supabase Storage)
-- La app recorta y comprime la foto a 256x256 (~30 KB) antes de subirla;
-- el bucket además rechaza archivos de más de 512 KB o que no sean imágenes.
-- Cada usuario solo puede escribir en su carpeta: avatars/<user_id>/...
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_select_own on storage.objects;
create policy avatars_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatars_delete_own on storage.objects;
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

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
