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
--   · Series: se pueden cargar varios partidos seguidos entre los mismos
--     jugadores (report_series) y el rival los confirma todos juntos.
--   · Solo se carga quién ganó. El partido queda 'pending' hasta que el rival
--     (en 2v2: cualquiera de los dos rivales) lo confirma.
--   · Clasificado = 3 o más partidos confirmados (1v1 y 2v2 suman).
--   · Días en el top 1: top_reigns guarda cada período como #1 del ranking
--     oficial (se actualiza al confirmar partidos y al aplicar decay).
--   · Temporadas: cada mes calendario (hora de Argentina) es una temporada.
--     El ELO NO se resetea; season_elo() da el ELO de cada jugador al inicio
--     y al cierre del mes y la app arma el resumen (campeón = más ELO ganado).
--   · Racha: victorias seguidas actuales (win_streak) y la mejor histórica
--     (best_win_streak). Un partido confirmado tarde que es anterior al
--     último registrado no corta ni alarga la racha actual.
--   · Decay: un jugador clasificado pierde 10 puntos por cada semana sin
--     jugar a partir de los 7 días (7 días: -10; 14: -20 acumulado; etc.).
--     Cuenta la fecha en que se jugó el partido, no la de confirmación: si
--     una confirmación tardía demuestra que el jugador sí jugó, se le
--     devuelven las semanas cobradas de más.
--
-- Seguridad (todo se aplica en la base, aunque alguien use la API directo):
--   · RLS en todas las tablas; ELO/estadísticas solo cambian vía funciones.
--   · Registro: tope de cuentas y, opcionalmente, solo emails de dominios
--     permitidos (tabla private.allowed_email_domains; vacía = cualquiera).
--   · Cupos de carga por usuario: 40 partidos pendientes y 60 por hora.
--   · Fotos: un solo archivo por usuario (avatars/<user_id>/avatar) y el
--     perfil solo acepta links a ese archivo.
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
  -- Victorias seguidas actuales y mejor racha histórica.
  win_streak          integer not null default 0,
  best_win_streak     integer not null default 0,
  created_at          timestamptz not null default now()
);

create unique index if not exists profiles_nickname_key on public.profiles (lower(nickname));

-- Sin caracteres de control ni invisibles (evita apodos "clonados" o rotos).
alter table public.profiles drop constraint if exists profiles_clean_text;
alter table public.profiles add constraint profiles_clean_text check (
  first_name !~ '[[:cntrl:]]'
  and last_name !~ '[[:cntrl:]]'
  and nickname !~ '[[:cntrl:]\u200B-\u200F\u2028-\u202E\u2060-\u2064\uFEFF]'
) not valid;

-- La foto solo puede ser el archivo propio del bucket "avatars" del proyecto.
alter table public.profiles drop constraint if exists profiles_avatar_own_storage;
alter table public.profiles add constraint profiles_avatar_own_storage check (
  avatar_url is null
  or avatar_url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/' || id::text || '/avatar(\?v=[0-9]+)?$')
) not valid;
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
  add column if not exists confirmed_by                uuid references public.profiles (id) on delete set null,
  -- Partidos cargados juntos como serie (se confirman de una vez).
  add column if not exists batch_id                    uuid;

create index if not exists matches_batch_idx on public.matches (batch_id) where batch_id is not null;

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

-- Cada período en que un jugador fue #1 del ranking oficial (ended_at null = reinado actual).
create table if not exists public.top_reigns (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  started_at  timestamptz not null,
  ended_at    timestamptz,
  constraint top_reigns_valid_range check (ended_at is null or ended_at >= started_at)
);

create unique index if not exists top_reigns_single_open on public.top_reigns ((true)) where ended_at is null;
create index if not exists top_reigns_profile_idx on public.top_reigns (profile_id);

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

-- Dominios de email permitidos para registrarse. Vacía = cualquiera.
-- Ej.: insert into private.allowed_email_domains values ('miempresa.com');
create table if not exists private.allowed_email_domains (
  domain text primary key check (domain = lower(btrim(domain)) and domain <> '')
);

create or replace function public.guard_signup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from auth.users) >= 200 then
    raise exception 'Se alcanzó el máximo de cuentas de la app.';
  end if;
  if exists (select 1 from private.allowed_email_domains)
     and not exists (
       select 1 from private.allowed_email_domains
        where domain = lower(split_part(new.email, '@', 2))
     ) then
    raise exception 'Solo se pueden registrar emails de la empresa.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_signup on auth.users;
create trigger guard_signup
  before insert on auth.users
  for each row execute function public.guard_signup();

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
drop function if exists public.report_match(uuid, boolean);
drop function if exists public.report_doubles_match(uuid, uuid, uuid, boolean);

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
  if v_count > 0 then
    perform private.update_leader(now());
  end if;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Días en el top 1: historial de "reinados" del #1 del ranking oficial.
-- ---------------------------------------------------------------------

-- Deja registrado quién es el #1 a la fecha p_at: si cambió, cierra el
-- reinado abierto y abre uno nuevo. Mismo orden que el ranking de la app.
create or replace function private.update_leader(p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_leader       uuid;
  v_open_id      bigint;
  v_open_player  uuid;
begin
  -- Una sola actualización a la vez (evita choques entre confirmaciones simultáneas).
  perform pg_advisory_xact_lock(hashtext('pingpong_update_leader'));

  select id into v_leader
    from public.profiles
   where matches_played >= 3
   order by elo desc, wins desc, nickname
   limit 1;

  select id, profile_id into v_open_id, v_open_player
    from public.top_reigns
   where ended_at is null
   for update;

  if v_open_id is not null and v_open_player is not distinct from v_leader then
    return;
  end if;

  if v_open_id is not null then
    update public.top_reigns set ended_at = greatest(p_at, started_at) where id = v_open_id;
  end if;

  if v_leader is not null then
    insert into public.top_reigns (profile_id, started_at) values (v_leader, p_at);
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Carga de partidos (solo ganador / perdedor)
-- ---------------------------------------------------------------------

-- Cupos por usuario para frenar el spam de partidos (también vía API directa).
create or replace function private.check_report_quota(p_reporter uuid, p_new integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.matches where reporter_id = p_reporter and status = 'pending') + p_new > 40 then
    raise exception 'Tenés demasiados partidos sin confirmar. Esperá a que tus rivales los confirmen.';
  end if;
  if (select count(*) from public.matches
       where reporter_id = p_reporter and created_at > now() - interval '1 hour') + p_new > 60 then
    raise exception 'Cargaste muchos partidos en la última hora. Probá de nuevo más tarde.';
  end if;
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
  -- La racha solo se actualiza si el partido es el más reciente del jugador.
  update public.profiles
     set elo = elo + case when id = any (v_winners) then v_delta else -v_delta end,
         matches_played = matches_played + 1,
         wins   = wins   + case when id = any (v_winners) then 1 else 0 end,
         losses = losses + case when id = any (v_winners) then 0 else 1 end,
         win_streak = case
                        when last_match_at is not null and v_as_of < last_match_at then win_streak
                        when id = any (v_winners) then win_streak + 1
                        else 0
                      end,
         best_win_streak = case
                             when (last_match_at is null or v_as_of >= last_match_at) and id = any (v_winners)
                             then greatest(best_win_streak, win_streak + 1)
                             else best_win_streak
                           end,
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
         last_match_at = null, decay_weeks_applied = 0, win_streak = 0, best_win_streak = 0
   where true;
  delete from public.elo_events where true;
  delete from public.top_reigns where true;

  for v_match in
    select * from public.matches where status = 'confirmed' order by created_at, id
  loop
    perform private.settle_match(v_match);
    perform private.update_leader(v_match.created_at);
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
  perform private.update_leader(now());

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

-- ---------------------------------------------------------------------
-- Series: varios partidos seguidos entre los mismos jugadores, cargados
-- y confirmados de una sola vez. Comparten batch_id.
-- ---------------------------------------------------------------------

-- p_results: un elemento por partido, en el orden en que se jugaron
-- (true = ganó el equipo de quien carga). En 1v1, p_partner_id y
-- p_opponent_partner_id van en null. Devuelve el batch_id.
create or replace function public.report_series(
  p_mode                public.match_mode,
  p_partner_id          uuid,
  p_opponent_id         uuid,
  p_opponent_partner_id uuid,
  p_results             boolean[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me       uuid := auth.uid();
  v_batch    uuid := gen_random_uuid();
  v_n        integer := coalesce(array_length(p_results, 1), 0);
  v_partner  uuid := case when p_mode = 'doubles' then p_partner_id end;
  v_opp2     uuid := case when p_mode = 'doubles' then p_opponent_partner_id end;
  v_ids      uuid[];
  v_i        integer;
begin
  if v_me is null then
    raise exception 'Tenés que iniciar sesión.';
  end if;
  if not exists (select 1 from public.profiles where id = v_me) then
    raise exception 'Completá tu perfil antes de cargar partidos.';
  end if;
  if v_n = 0 then
    raise exception 'Cargá al menos un resultado.';
  end if;
  if v_n > 20 then
    raise exception 'Se pueden cargar hasta 20 partidos de una vez.';
  end if;
  if array_position(p_results, null) is not null then
    raise exception 'Indicá quién ganó cada partido.';
  end if;

  v_ids := case when p_mode = 'singles'
                then array[v_me, p_opponent_id]
                else array[v_me, v_partner, p_opponent_id, v_opp2] end;

  if array_position(v_ids, null) is not null then
    if p_mode = 'singles' then
      raise exception 'Elegí a tu rival.';
    end if;
    raise exception 'Elegí a tu compañero y a los dos rivales.';
  end if;
  if (select count(distinct x) from unnest(v_ids) as x) <> array_length(v_ids, 1) then
    raise exception 'Los jugadores tienen que ser distintos.';
  end if;
  if (select count(*) from public.profiles where id = any (v_ids)) <> array_length(v_ids, 1) then
    raise exception 'Alguno de los jugadores no existe.';
  end if;

  perform private.check_report_quota(v_me, v_n);

  -- Evita el doble envío accidental.
  if exists (
    select 1 from public.matches
     where reporter_id = v_me
       and opponent_id = p_opponent_id
       and status = 'pending'
       and created_at > now() - interval '30 seconds'
  ) then
    raise exception 'Ya cargaste partidos contra este rival hace instantes.';
  end if;

  -- created_at escalonado (1 s) para conservar el orden en que se jugaron.
  for v_i in 1 .. v_n loop
    insert into public.matches (
      mode, reporter_id, reporter_partner_id, opponent_id, opponent_partner_id,
      reporter_won, batch_id, created_at
    )
    values (
      p_mode, v_me, v_partner, p_opponent_id, v_opp2,
      p_results[v_i], v_batch, now() - make_interval(secs => v_n - v_i)
    );
  end loop;

  return v_batch;
end;
$$;

-- Confirma todos los partidos pendientes de una serie, en orden. Devuelve cuántos.
create or replace function public.confirm_batch(p_batch_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me     uuid := auth.uid();
  v_match  public.matches;
  v_count  integer := 0;
begin
  if v_me is null then
    raise exception 'Tenés que iniciar sesión.';
  end if;

  for v_match in
    select * from public.matches
     where batch_id = p_batch_id and status = 'pending'
     order by created_at, id
     for update
  loop
    if v_me <> v_match.opponent_id and v_me is distinct from v_match.opponent_partner_id then
      raise exception 'Solo el equipo rival puede confirmar estos partidos.';
    end if;
    perform private.settle_match(v_match);
    update public.matches
       set status = 'confirmed', resolved_at = now(), confirmed_by = v_me
     where id = v_match.id;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'No hay partidos pendientes en esta serie.';
  end if;

  perform private.update_leader(now());
  return v_count;
end;
$$;

create or replace function public.reject_batch(p_batch_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.matches
     set status = 'rejected', resolved_at = now(), confirmed_by = auth.uid()
   where batch_id = p_batch_id
     and (opponent_id = auth.uid() or opponent_partner_id = auth.uid())
     and status = 'pending';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'No se pudo rechazar: la serie no existe, no sos del equipo rival o ya fue resuelta.';
  end if;
  return v_count;
end;
$$;

create or replace function public.cancel_batch(p_batch_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.matches
     set status = 'cancelled', resolved_at = now()
   where batch_id = p_batch_id
     and reporter_id = auth.uid()
     and status = 'pending';
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'No se pudo cancelar: la serie no existe, no la cargaste vos o ya fue resuelta.';
  end if;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------
-- Temporadas: ELO de cada jugador al inicio y al cierre de un período, y
-- cuántos partidos confirmados tenía al cierre (para saber si clasificaba).
-- ---------------------------------------------------------------------

create or replace function public.season_elo(p_start timestamptz, p_end timestamptz)
returns table (profile_id uuid, elo_start integer, elo_end integer, matches_before_end integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    p.id,
    coalesce((select e.elo_after from public.elo_events e
               where e.profile_id = p.id and e.created_at < p_start
               order by e.created_at desc, e.id desc limit 1), 1000),
    coalesce((select e.elo_after from public.elo_events e
               where e.profile_id = p.id and e.created_at < p_end
               order by e.created_at desc, e.id desc limit 1), 1000),
    (select count(*)::integer from public.elo_events e
      where e.profile_id = p.id and e.kind = 'match' and e.created_at < p_end)
  from public.profiles p;
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
-- Migraciones de versiones anteriores. Si hace falta, se recalcula todo
-- desde cero con las reglas actuales (corre una sola vez):
--   · ELO único: se eliminan las columnas de dobles (versión con dos rankings).
--   · Rachas: se agregan win_streak / best_win_streak y se completan.
--   · Días en el top 1: se reconstruye el historial de reinados.
-- ---------------------------------------------------------------------

do $$
declare
  v_recalc boolean := false;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'win_streak'
  ) then
    alter table public.profiles
      add column win_streak integer not null default 0,
      add column best_win_streak integer not null default 0;
    v_recalc := true;
  end if;

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
    v_recalc := true;
  end if;

  -- Días en el top 1: si todavía no hay historial pero sí partidos, reconstruirlo.
  if not exists (select 1 from public.top_reigns)
     and exists (select 1 from public.matches where status = 'confirmed') then
    v_recalc := true;
  end if;

  if v_recalc then
    perform private.recalculate_ratings();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Permisos y Row Level Security
-- ---------------------------------------------------------------------

alter table public.profiles   enable row level security;
alter table public.matches    enable row level security;
alter table public.elo_events enable row level security;
alter table public.top_reigns enable row level security;

revoke all on public.profiles, public.matches, public.elo_events, public.top_reigns from anon, authenticated;
grant select on public.profiles, public.matches, public.elo_events, public.top_reigns to authenticated;
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

drop policy if exists top_reigns_select on public.top_reigns;
create policy top_reigns_select on public.top_reigns
  for select to authenticated using (true);

-- El historial de ELO es visible para todos (gráfico de evolución en los perfiles).
drop policy if exists elo_events_select_own on public.elo_events;
drop policy if exists elo_events_select on public.elo_events;
create policy elo_events_select on public.elo_events
  for select to authenticated using (true);

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.guard_signup() from public, anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;

revoke execute on function public.apply_inactivity_decay() from public, anon;
revoke execute on function public.confirm_match(uuid) from public, anon;
revoke execute on function public.reject_match(uuid) from public, anon;
revoke execute on function public.cancel_match(uuid) from public, anon;
revoke execute on function public.report_series(public.match_mode, uuid, uuid, uuid, boolean[]) from public, anon;
revoke execute on function public.confirm_batch(uuid) from public, anon;
revoke execute on function public.reject_batch(uuid) from public, anon;
revoke execute on function public.cancel_batch(uuid) from public, anon;
revoke execute on function public.is_nickname_available(text) from public;
revoke execute on function public.season_elo(timestamptz, timestamptz) from public, anon;

grant execute on function public.apply_inactivity_decay() to authenticated;
grant execute on function public.confirm_match(uuid) to authenticated;
grant execute on function public.reject_match(uuid) to authenticated;
grant execute on function public.cancel_match(uuid) to authenticated;
grant execute on function public.report_series(public.match_mode, uuid, uuid, uuid, boolean[]) to authenticated;
grant execute on function public.confirm_batch(uuid) to authenticated;
grant execute on function public.reject_batch(uuid) to authenticated;
grant execute on function public.cancel_batch(uuid) to authenticated;
grant execute on function public.is_nickname_available(text) to anon, authenticated;
grant execute on function public.season_elo(timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------
-- Fotos de perfil (Supabase Storage)
-- La app recorta y comprime la foto a 256x256 (~30 KB) antes de subirla;
-- el bucket además rechaza archivos de más de 512 KB o que no sean imágenes.
-- Cada usuario tiene un único archivo: avatars/<user_id>/avatar (no se pueden acumular).
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
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');

drop policy if exists avatars_update_own on storage.objects;
create policy avatars_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and name = (select auth.uid())::text || '/avatar');

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
