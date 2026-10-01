# ATPBlueboot

Ranking ELO de ping pong de BlueBoot. Mobile-first, hecho con Next.js 16 (App Router), Tailwind CSS v4, Shadcn UI (Base UI) y Supabase.

## Funcionalidades

- **Ranking único**: 1 vs 1 y 2 vs 2 suman al mismo ELO. Tarjeta con tu posición, podio para el top 3 y tabla con el resto. Ranking oficial (3+ partidos confirmados) y pestaña "Sin clasificar" con el progreso hacia los 3 partidos.
- **Cargar partido en segundos**: una sola pantalla con tu equipo contra los rivales. Tocás un lugar vacío (o un jugador de "Jugaste hace poco") y después **Gané** o **Perdí**, que ya muestran los puntos en juego y envían el resultado. En 1v1 con un rival reciente son dos toques. No se carga el marcador.
- **Mis partidos**: partidos para confirmar o rechazar, los que esperan al rival (los podés cancelar si los cargaste vos) e historial.
- **Perfil**: tu ELO y posición, estadísticas (jugados, ganados, perdidos, efectividad, últimos 5 y racha), **clásico rival** (con quien más jugaste en contra, en 1v1 o 2v2) y **compañero** (con quien más jugaste juntos en 2v2), cada uno con el historial de victorias y derrotas. Datos y foto editables.
- **Historial**: todos los partidos confirmados de la empresa, con filtro 1v1 / 2v2, paginados.
- **App instalable (PWA)**: desde el celular se puede agregar a la pantalla de inicio y abre a pantalla completa. En Android/Chrome aparece un botón "Instalar"; en iPhone, la app muestra cómo hacerlo (Compartir → Agregar a inicio).
- **Fotos**: se recortan en cuadrado y se comprimen a 256×256 WebP (~30 KB) en el navegador antes de subirse a Supabase Storage; el bucket rechaza archivos de más de 512 KB o que no sean imágenes.

## Reglas de negocio

Todas viven en la base de datos (`supabase/schema.sql`), en funciones `security definer`. El cliente no puede modificar ELO ni estadísticas.

| Regla | Implementación |
| --- | --- |
| ELO único, inicial 1000, K = 32 | `E = 1/(1+10^((Rperdedor-Rganador)/400))`, `Δ = max(1, round(32·(1-E)))`. Ganar siempre suma al menos 1 |
| 2 vs 2 | El ELO de cada equipo es el promedio de sus integrantes y los 4 jugadores suman o restan el mismo Δ. Un compañero fuerte sube el promedio del equipo, así que ganar con él da menos puntos: nadie sube "colgado" |
| Suma cero | Lo que gana un equipo es exactamente lo que pierde el otro; no se crean ni se pierden puntos por los partidos |
| Doble validación | `report_match()` / `report_doubles_match()` crean el partido como `pending`. Confirma o rechaza el rival; en 2v2 alcanza con cualquiera de los dos. El ELO cambia recién al confirmar |
| Mínimo 3 partidos | 3+ partidos confirmados (1v1 y 2v2 suman) para entrar al ranking oficial |
| Decay por inactividad | Clasificado con 7+ días sin jugar: −10 por cada semana (7 días −10, 14 días −20, etc.). Cuenta la fecha en que **se jugó** el partido: si una confirmación tardía demuestra que el jugador sí jugó, se le devuelven las semanas cobradas de más. Lo aplica `apply_inactivity_decay()` a diario vía `pg_cron` y al abrir el ranking. Es idempotente |
| Resultado | Solo se carga quién ganó (`reporter_won`). Los partidos viejos con marcador lo conservan |
| Recalcular | `select private.recalculate_ratings();` recalcula todos los ELO desde cero repasando los partidos confirmados en el orden en que se jugaron. Se ejecutó automáticamente al pasar de dos rankings a uno |

## Puesta en marcha

### 1. Supabase

1. **SQL Editor → New query**: pegá todo `supabase/schema.sql` y ejecutalo. Se puede volver a correr sin perder datos.
2. **Authentication → URL Configuration**:
   - *Site URL*: la URL de producción (por ejemplo, `https://atpblueboot.vercel.app`).
   - *Redirect URLs*: `https://<tu-dominio>/auth/callback` y `http://localhost:3000/auth/callback`.
3. **Authentication → Sign In / Providers → Email**: desactivar *Confirm email* y guardar. El servidor de mail que trae Supabase por defecto manda muy pocos emails por hora, y con la confirmación activada los registros fallan con `email rate limit exceeded`. Sin confirmación, el usuario entra apenas se registra.
   Si alguien se registró antes de este cambio y quedó sin confirmar, ejecutá en el SQL Editor:
   ```sql
   update auth.users set email_confirmed_at = now() where email_confirmed_at is null;
   ```

### 2. Local

```bash
cp .env.example .env.local   # completar URL y publishable key
npm install
npm run dev
```

### 3. Deploy en Vercel

1. Importá el repo en Vercel (se detecta Next.js solo).
2. Cargá estas variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: la publishable key (`sb_publishable_…`). También se acepta la anon key legacy como `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Deploy. Después agregá la URL final en *Redirect URLs* de Supabase (paso 1.2).

No se necesita la service role key.

## Estructura

```
supabase/schema.sql          Tablas, RLS, funciones (ELO, confirmaciones, decay) y cron
src/proxy.ts                 Refresca la sesión de Supabase y protege las rutas
src/lib/supabase/            Clientes browser/server
src/lib/elo.ts               Fórmula ELO (solo para previsualizar)
src/app/(auth)/              Login / registro / onboarding
src/app/(app)/               Ranking, Cargar, Mis partidos, Historial, Perfil
src/app/actions.ts           Server actions (llaman a las funciones RPC)
src/components/brand/        Logo BlueBoot
```
