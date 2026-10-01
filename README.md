# ATPBlueboot

Ranking ELO de ping pong de BlueBoot. Mobile-first, hecho con Next.js 16 (App Router), Tailwind CSS v4, Shadcn UI (Base UI) y Supabase.

## Funcionalidades

- **Ranking**: selector **Singles (1v1) / Dobles (2v2)**, tarjeta con tu posición, podio para el top 3 y tabla con el resto. Cada modalidad tiene su ranking oficial (3+ partidos confirmados) y su pestaña "Sin clasificar" con el progreso hacia los 3 partidos.
- **Cargar partido**: en 3 pasos y sin marcador: modalidad → jugadores (buscador con fotos y rivales recientes) → **¿Quién ganó?** tocando la tarjeta del equipo ganador. Muestra cuántos puntos se ganan o pierden antes de enviar.
- **Mis partidos**: estadísticas de ambas modalidades (ELO, PJ, V/D, efectividad, últimos 5 resultados y racha), partidos para confirmar o rechazar, los que esperan al rival (los podés cancelar si los cargaste vos) y tu historial.
- **App instalable (PWA)**: desde el celular se puede agregar a la pantalla de inicio y abre a pantalla completa. En Android/Chrome aparece un botón "Instalar"; en iPhone, la app muestra cómo hacerlo (Compartir → Agregar a inicio).
- **Historial**: todos los partidos confirmados de la empresa, paginados.
- **Perfil**: nombre, apellido, apodo y foto. La foto se recorta en cuadrado y se comprime a 256×256 WebP (~30 KB) en el navegador antes de subirse a Supabase Storage; el bucket rechaza archivos de más de 512 KB o que no sean imágenes.

## Reglas de negocio

Todas viven en la base de datos (`supabase/schema.sql`), en funciones `security definer`. El cliente no puede modificar ELO ni estadísticas.

| Regla | Implementación |
| --- | --- |
| Dos modalidades | `elo` (singles) y `elo_doubles` (dobles) son independientes, igual que PJ, V/D y el decay |
| ELO inicial 1000, K = 32 | `E = 1/(1+10^((Rb-Ra)/400))`, `Δ = round(32·(1-E))`, suma cero. En dobles, `Ra`/`Rb` son el promedio del `elo_doubles` de cada equipo y los 4 jugadores suman o restan el mismo Δ |
| Doble validación | `report_match()` / `report_doubles_match()` crean el partido como `pending`. Confirma o rechaza el rival; en dobles alcanza con cualquiera de los dos integrantes del equipo rival. El ELO cambia recién al confirmar |
| Mínimo 3 partidos | 3+ partidos confirmados **en esa modalidad** para entrar a su ranking oficial |
| Decay por inactividad | Por modalidad. Clasificado con 7+ días sin partidos confirmados en esa modalidad: −10 por cada semana de inactividad (a los 7 días, −10; a los 14, −20 acumulado; etc.). Lo aplica `apply_inactivity_decay()` a diario vía `pg_cron` y también cada vez que se abre el ranking. Es idempotente |
| Resultado | Solo se carga quién ganó (`reporter_won`); el marcador no se pide. Los partidos cargados antes con marcador lo conservan y se sigue mostrando |

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
