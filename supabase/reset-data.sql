-- =====================================================================
-- Blue League — BORRAR TODOS LOS DATOS DE JUEGO (conserva los usuarios)
--
-- CUÁNDO USARLO: una sola vez, antes de empezar a usar la app "en serio"
-- (por ejemplo el domingo a la noche), para dejar todo en cero.
-- Primero corré supabase/schema.sql (para que existan los tres rankings)
-- y después este script.
--
-- QUÉ BORRA (no se puede deshacer):
--   · todos los partidos (confirmados, pendientes y rechazados) y las series
--   · el historial de puntaje, los desafíos y los días en el #1
--   · los puntajes, partidos, récords y rachas de los tres rankings,
--     que vuelven a 1000 / 0
--
-- QUÉ CONSERVA:
--   · las cuentas (auth.users) y los perfiles: nombre, apellido, apodo y foto
--   · las notificaciones activadas y sus preferencias
--
-- Antes de borrar, se muestra cuánto hay. Si algo falla, no se borra nada.
-- =====================================================================

-- 1. Cuánto hay ahora (solo lectura).
select
  (select count(*) from auth.users)            as cuentas,
  (select count(*) from public.profiles)       as perfiles,
  (select count(*) from public.matches)        as partidos,
  (select count(*) from public.elo_events)     as movimientos_de_puntaje,
  (select count(*) from public.challenges)     as desafios;

-- 2. El borrado (todo o nada).
begin;

delete from public.challenges;
delete from public.elo_events;
delete from public.top_reigns;
delete from public.matches;

update public.profiles
   set elo = 1000, matches_played = 0, wins = 0, losses = 0,
       last_match_at = null, decay_weeks_applied = 0, win_streak = 0, best_win_streak = 0,
       singles_elo = 1000, singles_matches_played = 0, singles_wins = 0, singles_losses = 0,
       singles_last_match_at = null, singles_decay_weeks_applied = 0, singles_win_streak = 0, singles_best_win_streak = 0,
       doubles_elo = 1000, doubles_matches_played = 0, doubles_wins = 0, doubles_losses = 0,
       doubles_last_match_at = null, doubles_decay_weeks_applied = 0, doubles_win_streak = 0, doubles_best_win_streak = 0;

commit;

-- 3. Verificación: tiene que mostrar tus cuentas y todo lo demás en 0.
select
  (select count(*) from auth.users)            as cuentas,
  (select count(*) from public.profiles)       as perfiles,
  (select count(*) from public.matches)        as partidos,
  (select count(*) from public.elo_events)     as movimientos_de_puntaje,
  (select count(*) from public.challenges)     as desafios,
  (select count(*) from public.profiles where elo <> 1000 or singles_elo <> 1000 or doubles_elo <> 1000) as perfiles_con_puntaje_distinto_de_1000;
