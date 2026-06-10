# Quiniela Mundial 2026

App web para la quiniela del grupo: login propio para cada jugador, pronósticos con
candado automático al pitazo inicial, tabla de posiciones en vivo y panel de
administración para resultados y pagos.

**Reglas configuradas:**
- Marcador exacto de victoria: **3 puntos**
- Empate con marcador exacto: **2 puntos**
- Empate sin marcador exacto: **1 punto**
- Ganador correcto sin marcador exacto: **1 punto**
- Premio: **el 1er lugar se lleva toda la bolsa** de cada fase
- Desempate: más marcadores exactos
- Fases: Grupos (Q20) · Dieciseisavos y octavos (Q20) · Cuartos, semis y final (Q30)

---

## Paso 1 — Crear el proyecto en Supabase (10 min)

1. Entrá a [supabase.com](https://supabase.com) y creá un proyecto nuevo (plan gratis).
2. Andá a **SQL Editor → New query**, pegá TODO el contenido de
   `supabase/setup.sql` y dale **Run**. Eso crea las tablas, la seguridad,
   el sistema de puntos y las 3 fases.
3. En **Authentication → Providers → Email**: dejá Email habilitado.
   *Opcional pero recomendado para tus amigos:* desactivá **"Confirm email"**
   para que puedan entrar inmediatamente después de crear su cuenta sin
   verificar el correo.
4. En **Project Settings → API** copiá dos valores:
   - `Project URL`
   - `anon public key`

## Paso 2 — Probar localmente (opcional)

```bash
npm install
cp .env.local.example .env.local   # y llenar con la URL y la llave del paso 1
npm run dev                        # abre http://localhost:3000
```

## Paso 3 — Subir a Vercel (10 min)

1. Subí esta carpeta a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com): **Add New → Project → importar el repo**.
3. En **Environment Variables** agregá:
   - `NEXT_PUBLIC_SUPABASE_URL` = tu Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon public key
4. **Deploy**. Vercel te da la URL pública (ej. `quiniela-mundial.vercel.app`).
5. (Recomendado) En Supabase: **Authentication → URL Configuration → Site URL**,
   poné tu URL de Vercel.

## Paso 4 — Nombrarte administrador

1. Entrá a tu app y **creá tu cuenta** primero.
2. En Supabase → SQL Editor corré (con tu correo real):

```sql
update public.profiles set es_admin = true
where id = (select id from auth.users where email = 'TU_CORREO@ejemplo.com');
```

3. Recargá la app: te aparecerá la pestaña **Admin**.

## Paso 5 — Cargar partidos y arrancar

- En **Admin → Agregar partido** cargá los partidos de la jornada
  (la fecha y hora actúan como candado: nadie puede pronosticar después del inicio).
- Compartí la URL con tus amigos para que creen su cuenta y pronostiquen.
- En **Admin → Control de pagos** marcá quién ya pagó cada fase
  (sin pago, sus puntos no aparecen en la tabla).
- Al terminar cada partido, ingresá el resultado en **Admin → Resultados**:
  la tabla de posiciones se recalcula sola.

---

## Cómo funciona la seguridad

Las reglas viven en la base de datos (Row Level Security), no en el navegador:

- Nadie puede crear ni editar un pronóstico después de `fecha_hora` del partido,
  ni manipulando la app.
- Los pronósticos ajenos son invisibles hasta que el partido inicia.
- Solo el administrador puede cargar partidos, resultados y pagos.
- Nadie puede auto-nombrarse administrador desde la app.
