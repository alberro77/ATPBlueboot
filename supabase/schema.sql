-- =====================================================================
-- ATP Ping Pong · BlueBoot — Esquema de base de datos
--
-- Cómo usarlo: Supabase Dashboard → SQL Editor → New query → pegar todo → Run.
-- El script es idempotente: se puede volver a ejecutar sin perder datos
-- (también migra bases creadas con versiones anteriores).
--
-- Reglas de negocio implementadas acá (fuente de verdad):
--   · Un solo ELO por jugador para 1v1 y 2v2. Inicial 1000, K = 32.
--   · 1v1: fórmula ELO estándar entre los dos jugadores.
--   · 2v2: ELO del equipo = promedio de sus integrantes; los 4 jugadores
--     suman o restan el mismo Δ. Un compañero fuerte sube el promedio del
--     equipo, así que ganar con él da menos puntos (nadie sube "colgado").
--   · Suma cero: lo que gana un equipo es exactamente lo que pierde el otro.
--   · Ganar siempre suma al menos 1 punto (aunque la diferencia sea enorme).
--   · Solo se carga quién ganó. El partido queda 'pending' hasta que el rival
--     (en 2v2: cualquiera de los dos rivales) lo confirma.
--   · Clasificado = 3 o más partidos confirmados (1v1 y 2v2 suman).
--   · Decay: un jugador clasificado pierde 10 puntos por cada semana sin
--     jugar a partir de los 7 días (7 días: -10; 14: -20 acumulado; etc.).
--     Cuenta la fecha en que se jugó el partido, no la de confirmación: si
--     una confirmación tardía demuestra que el jugador sí jugó, se le
--     devuelven las semanas cobradas de más.
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
  elo                 integer not null default 1000,
  matches_played      integer not null default 0,
  wins                integer not null default 0,
  losses              integer not null default 0,
  -- Fecha en que se jugó su último partido confirmado (base del decay).
  last_match_at       timestamptz,
  -- Semanas de inactividad ya penalizadas desde last_match_at (hace el decay idempotente).
  decay_weeks_applied integer not null default 0,
  created_at          timestamptz not null default now()
);

create unique index if not exists profiles_nickname_key on public.profiles (lower(nickname));
create index if not exists profiles_elo_idx on public.profiles (elo desc);

-- Equipo A = reporter_id (+ reporter_partner_id en 2v2): quien carga el partido.
-- Equipo B = opponent_id (+ opponent_partner_id en 2v2): quien confirma.
-- reporter_won indica qué equipo ganó. Los marcadores (reporter_score /
-- opponent_score) solo existen en partidos cargados con una versión anterior.
create table if not exists public.matches (
  id                  uuid primary key default gen_random_uuid(),
  reporter_id         uuid not null references public.profiles (id) on delete cascade,
  opponent_id         uuid not null references public.profiles (id) on delete cascade,
  reporter_won        boolean not null,
  reporter_score      smallint check (reporter_score between 0 and 99),
  opponent_score      smallint check (opponent_score between 0 and 99),
  -- Jugador 1 del equipo ganador.
  winner_id           uuid generated always as (
                        case when reporter_won then reporter_id else opponent_id end
                      ) stored,
  status              public.match_status not null default 'pending',
  -- Snapshot al confirmar: ELO previo de cada jugador y puntos transferidos.
  reporter_elo_before integer,
  opponent_elo_before integer,
  elo_delta           integer,
  created_at          timestamptz not null default now(),
  resolved_at         timestamptz,
  constraint matches_different_players check (reporter_id <> opponent_id)
);

-- Migración desde la versión con marcador obligatorio.
alter table public.matches add column if not exists reporter_won boolean;
update public.matches set reporter_won = reporter_score > opponent_score where reporter_won is null;
alter table public.matches alter column reporter_won set not null;
alter table public.matches alter column reporter_score drop not null;
alter table public.matches alter column opponent_score drop not null;
alter table public.matches drop constraint if exists matches_no_tie;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'matches'
       and column_name = 'winner_id' and generation_expression ilike '%reporter_won%'
  ) then
    alter table public.matches drop column if exists winner_id;
    alter table public.matches add column winner_id uuid generated always as (
      case when reporter_won then reporter_id else opponent_id end
    ) stored;
  end if;
end $$;

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

-- Modalidad del partido (null en las penalizaciones por inactividad).
alter table public.elo_events add column if not exists mode public.match_mode;
alter table public.elo_events alter column mode drop not null;
alter table public.elo_events alter column mode drop default;

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
-- Funciones de versiones anteriores
-- ---------------------------------------------------------------------

drop function if exists private.apply_decay_to(uuid);
drop function if exists private.apply_decay_to(uuid, public.match_mode);
drop function if exists private.settle_singles(public.matches);
drop function if exists private.settle_doubles(public.matches);
drop function if exists private.validate_score(integer, integer);
drop function if exists public.report_match(uuid, integer, integer);
drop function if exists public.report_doubles_match(uuid, uuid, uuid, integer, integer);

-- ---------------------------------------------------------------------
-- Decay por inactividad
-- ---------------------------------------------------------------------

-- Deja el decay del jugador "al día" a la fecha p_as_of: cobra las semanas de
-- inactividad que correspondan y, si ya se habían cobrado de más (porque un
-- partido confirmado tarde demuestra que jugó antes), las devuelve.
-- Devuelve el cambio de ELO aplicado (negativo = penalización).
create or replace function private.sync_decay(p_profile_id uuid, p_as_of timestamptz)
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
  v_change   integer;
begin
  select elo, matches_played, last_match_at, decay_weeks_applied
    into v_elo, v_played, v_last, v_applied
    from public.profiles where id = p_profile_id for update;

  -- Sin partidos previos, o el partido es anterior al último registrado: nada que ajustar.
  if not found or v_last is null or p_as_of <= v_last then
    return 0;
  end if;

  v_owed := case
              when v_played >= 3 and p_as_of - v_last >= interval '7 days'
              then floor(extract(epoch from p_as_of - v_last) / 604800)::integer
              else 0
            end;
  if v_owed = v_applied then
    return 0;
  end if;

  v_change := (v_applied - v_owed) * 10;

  update public.profiles
     set elo = elo + v_change, decay_weeks_applied = v_owed
   where id = p_profile_id;

  insert into public.elo_events (profile_id, kind, delta, elo_after, created_at)
  values (p_profile_id, 'decay', v_change, v_elo + v_change, p_as_of);

  return v_change;
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
       and last_match_at < now() - interval '7 days'
       and floor(extract(epoch from now() - last_match_at) / 604800) > decay_weeks_applied
     order by id
  loop
    if private.sync_decay(r.id, now()) <> 0 then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Carga de partidos (solo ganador / perdedor)
-- ---------------------------------------------------------------------

create or replace function public.report_match(
  p_opponent_id uuid,
  p_i_won       boolean
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
  if p_i_won is null then
    raise exception 'Indicá quién ganó.';
  end if;

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

  insert into public.matches (mode, reporter_id, opponent_id, reporter_won)
  values ('singles', v_me, p_opponent_id, p_i_won)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.report_doubles_match(
  p_partner_id          uuid,
  p_opponent_id         uuid,
  p_opponent_partner_id uuid,
  p_we_won              boolean
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
  if p_we_won is null then
    raise exception 'Indicá qué equipo ganó.';
  end if;

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
    mode, reporter_id, reporter_partner_id, opponent_id, opponent_partner_id, reporter_won
  )
  values (
    'doubles', v_me, p_partner_id, p_opponent_id, p_opponent_partner_id, p_we_won
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- Cálculo de ELO
-- E = 1 / (1 + 10^((Rperdedor - Rganador) / 400)),  Δ = max(1, round(K · (1 - E))),  K = 32
-- ---------------------------------------------------------------------

create or replace function private.elo_delta(p_winner numeric, p_loser numeric)
returns integer
language sql
immutable
set search_path = ''
as $$
  select greatest(1, round(32 * (1 - 1 / (1 + power(10::numeric, (p_loser - p_winner) / 400.0))))::integer);
$$;

-- Aplica el resultado de un partido (1v1 o 2v2) a los jugadores. Devuelve Δ.
-- Usa la fecha en que se jugó (created_at) para el decay y para last_match_at.
create or replace function private.settle_match(p_match public.matches)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_as_of    timestamptz := p_match.created_at;
  v_team_a   uuid[] := array_remove(array[p_match.reporter_id, p_match.reporter_partner_id], null);
  v_team_b   uuid[] := array_remove(array[p_match.opponent_id, p_match.opponent_partner_id], null);
  v_players  uuid[];
  v_winners  uuid[];
  v_a_avg    numeric;
  v_b_avg    numeric;
  v_delta    integer;
  v_id       uuid;
begin
  v_players := v_team_a || v_team_b;
  v_winners := case when p_match.reporter_won then v_team_a else v_team_b end;

  -- Bloqueo en orden estable para evitar deadlocks entre confirmaciones simultáneas.
  perform 1 from public.profiles where id = any (v_players) order by id for update;

  -- Decay al día a la fecha del partido, antes de calcular con el ELO vigente.
  foreach v_id in array v_players loop
    perform private.sync_decay(v_id, v_as_of);
  end loop;

  -- ELO de cada equipo = promedio de sus integrantes (en 1v1, el del jugador).
  select avg(elo) into v_a_avg from public.profiles where id = any (v_team_a);
  select avg(elo) into v_b_avg from public.profiles where id = any (v_team_b);

  v_delta := case when p_match.reporter_won
                  then private.elo_delta(v_a_avg, v_b_avg)
                  else private.elo_delta(v_b_avg, v_a_avg) end;

  -- Snapshot del ELO previo de cada jugador.
  update public.matches m
     set elo_delta = v_delta,
         reporter_elo_before         = (select elo from public.profiles where id = m.reporter_id),
         reporter_partner_elo_before = (select elo from public.profiles where id = m.reporter_partner_id),
         opponent_elo_before         = (select elo from public.profiles where id = m.opponent_id),
         opponent_partner_elo_before = (select elo from public.profiles where id = m.opponent_partner_id)
   where m.id = p_match.id;

  -- Mismo +Δ / -Δ para cada integrante. Todas las expresiones ven los valores previos.
  update public.profiles
     set elo = elo + case when id = any (v_winners) then v_delta else -v_delta end,
         matches_played = matches_played + 1,
         wins   = wins   + case when id = any (v_winners) then 1 else 0 end,
         losses = losses + case when id = any (v_winners) then 0 else 1 end,
         decay_weeks_applied = case when last_match_at is null or v_as_of > last_match_at
                                    then 0 else decay_weeks_applied end,
         last_match_at = greatest(coalesce(last_match_at, v_as_of), v_as_of)
   where id = any (v_players);

  insert into public.elo_events (profile_id, match_id, kind, mode, delta, elo_after, created_at)
  select id, p_match.id, 'match', p_match.mode,
         case when id = any (v_winners) then v_delta else -v_delta end, elo, v_as_of
    from public.profiles
   where id = any (v_players);

  return v_delta;
end;
$$;

-- Recalcula todos los ELO desde cero repasando los partidos confirmados en el
-- orden en que se jugaron (y el decay correspondiente). Se usa al migrar o si
-- cambian las reglas: select private.recalculate_ratings();
create or replace function private.recalculate_ratings()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
begin
  update public.profiles
     set elo = 1000, matches_played = 0, wins = 0, losses = 0,
         last_match_at = null, decay_weeks_applied = 0
   where true;
  delete from public.elo_events where true;

  for v_match in
    select * from public.matches where status = 'confirmed' order by created_at, id
  loop
    perform private.settle_match(v_match);
  end loop;

  perform public.apply_inactivity_decay();
end;
$$;

-- Confirma un partido pendiente y aplica el ELO. Devuelve los puntos transferidos.
-- 1v1: solo el rival. 2v2: cualquiera de los dos integrantes del equipo rival.
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

  v_delta := private.settle_match(v_match);

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
-- Migración a ELO único: si todavía existen las columnas de dobles
-- (versión con dos rankings), se eliminan y se recalcula todo desde cero
-- con las reglas actuales. Corre una sola vez.
-- ---------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'elo_doubles'
  ) then
    alter table public.profiles
      drop column if exists elo_doubles,
      drop column if exists doubles_played,
      drop column if exists doubles_wins,
      drop column if exists doubles_losses,
      drop column if exists doubles_last_match_at,
      drop column if exists doubles_decay_weeks_applied;
    perform private.recalculate_ratings();
  end if;
end $$;

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

revoke execute on function public.apply_inactivity_decay() from public, anon;
revoke execute on function public.report_match(uuid, boolean) from public, anon;
revoke execute on function public.report_doubles_match(uuid, uuid, uuid, boolean) from public, anon;
revoke execute on function public.confirm_match(uuid) from public, anon;
revoke execute on function public.reject_match(uuid) from public, anon;
revoke execute on function public.cancel_match(uuid) from public, anon;
revoke execute on function public.is_nickname_available(text) from public;

grant execute on function public.apply_inactivity_decay() to authenticated;
grant execute on function public.report_match(uuid, boolean) to authenticated;
grant execute on function public.report_doubles_match(uuid, uuid, uuid, boolean) to authenticated;
grant execute on function public.confirm_match(uuid) to authenticated;
grant execute on function public.reject_match(uuid) to authenticated;
grant execute on function public.cancel_match(uuid) to authenticated;
grant execute on function public.is_nickname_available(text) to anon, authenticated;

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
