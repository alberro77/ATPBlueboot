# Blue League

Ranking ELO de ping pong de BlueBoot. Mobile-first, hecho con Next.js 16 (App Router), Tailwind CSS v4, Shadcn UI (Base UI) y Supabase.

## Funcionalidades

- **Ranking único**: 1 vs 1 y 2 vs 2 suman al mismo ELO. Tarjeta con tu posición, franja **On fire** con los jugadores en racha (3+ victorias seguidas), podio para el top 3 (el #1 muestra cuántos días lleva en la cima) y tabla con el resto. Ranking oficial (3+ partidos confirmados) y pestaña "Sin clasificar".
- **Cargar partidos en segundos**: una sola pantalla con tu equipo contra los rivales. Tocás un lugar vacío (o un jugador de "Jugaste hace poco") y después **Gané** / **Perdí** una vez por cada partido, en orden: así se cargan series de varios partidos entre los mismos jugadores de una vez. Muestra la **probabilidad de ganar** (según el ELO), lo que se juega en cada partido y el total estimado. No se carga el marcador.
- **Mis partidos**: partidos para confirmar o rechazar (una serie se confirma o rechaza completa con un toque), los que esperan al rival (los podés cancelar si los cargaste vos) e historial.
- **Perfil**: tu ELO, posición y **días en el #1**, estadísticas (jugados, ganados, perdidos, efectividad, últimos 5, racha actual y mejor racha), **gráfico de evolución del ELO** (1 mes / 3 meses / todo, con detalle de cada cambio al tocar), **clásico rival** (con quien más jugaste 1 vs 1) y **compañero** (con quien más jugaste juntos en 2 vs 2). Datos y foto editables.
- **Perfil de otros jugadores** (`/jugador/[id]`): se abre tocando a cualquiera en el ranking, el podio, la franja On fire o las tarjetas de rival/compañero. Muestra lo mismo que el tuyo, su gráfico de ELO, el **cara a cara 1 vs 1 con vos** con la **probabilidad de ganar si juegan hoy** (y los partidos que jugaron juntos en 2v2), sus últimos partidos y un botón **Desafiar** que abre la carga con ese rival elegido.
- **Historial**: todos los partidos confirmados de la empresa, con filtro 1v1 / 2v2, paginados.
- **Temporadas mensuales** (`/temporadas`): cada mes es una temporada y el ELO **no** se resetea. Campeón = quien más ELO suma en el mes (mín. 3 partidos); además #1 al cierre, más activo, mejor racha, la gran sorpresa (victoria con menos chances), rivalidad 1v1 y dupla del mes, tabla del mes y tu resumen personal. Al empezar un mes nuevo aparece un resumen de la temporada que terminó (una vez por dispositivo). Queda el registro de todas las temporadas.
- **Récord por modalidad**: en tu perfil y en el de cada jugador se ve por separado el récord de **1 vs 1** y de **2 vs 2** (ganados-perdidos, efectividad, partidos, racha actual y mejor racha, últimos 5 resultados y ELO neto ganado o perdido en esa modalidad).
- **Notificaciones push**: te avisan cuando te cargan partidos para confirmar y cuando alguien te **desafía** (botón *Desafiar* en el perfil de otro jugador). En Perfil → Notificaciones se activan o desactivan en cada dispositivo, se elige qué avisos recibir y hay un botón de prueba. Los desafíos recibidos también aparecen en Mis partidos. En iPhone funcionan con la app agregada a la pantalla de inicio.
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
| Series | `report_series()` carga hasta 20 partidos seguidos entre los mismos jugadores (comparten `batch_id`, en el orden en que se jugaron); `confirm_batch()` / `reject_batch()` / `cancel_batch()` los resuelven juntos |
| Rachas | `win_streak` (victorias seguidas actuales) y `best_win_streak`. Un partido confirmado tarde y anterior al último no corta ni alarga la racha |
| Días en el #1 | `top_reigns` registra cada período como #1 del ranking oficial; se actualiza al confirmar partidos y al aplicar decay |
| Temporadas | Mes calendario en hora de Argentina. `season_elo(inicio, fin)` devuelve el ELO de cada jugador al inicio y al cierre; el resumen se calcula a partir de los partidos confirmados, así que siempre coincide con los datos |
| Recalcular | `select private.recalculate_ratings();` recalcula todos los ELO desde cero repasando los partidos confirmados en el orden en que se jugaron. Se ejecutó automáticamente al pasar de dos rankings a uno |

## Notificaciones push (configuración)

Hacen falta tres variables de entorno (en `.env.local` y en Vercel → Settings → Environment Variables). Las claves se generan una sola vez con `npx web-push generate-vapid-keys`:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (pública)
- `VAPID_PRIVATE_KEY` (**secreta**, nunca en el repo)
- `VAPID_SUBJECT` (un `mailto:` de contacto)

Sin ellas la app funciona igual, pero no se envían avisos.

## Seguridad

- **RLS en todas las tablas**: sin sesión no se puede leer nada; con sesión solo se lee. Partidos, ELO y estadísticas cambian únicamente a través de funciones `security definer` que validan quién llama.
- **Cupos anti-spam**: cada usuario puede tener hasta 40 partidos pendientes y cargar hasta 60 por hora.
- **Registro**: tope de 200 cuentas y, opcionalmente, solo emails de dominios permitidos:
  ```sql
  insert into private.allowed_email_domains values ('miempresa.com');
  ```
- **Fotos**: un único archivo por usuario (`avatars/<user_id>/avatar`, máx. 512 KB) y el perfil solo acepta links a ese archivo.
- **Headers**: `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`.
- **Recomendado en los paneles**: Supabase → Authentication → Rate Limits (dejar los valores por defecto o bajarlos) y largo mínimo de contraseña 8; activar 2FA en las cuentas de Supabase, Vercel y GitHub; ante un ataque, Vercel → Firewall → Attack Challenge Mode.

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
