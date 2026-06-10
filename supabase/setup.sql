-- ============================================================
-- QUINIELA MUNDIAL 2026 — Script de configuración para Supabase
-- Pegar completo en: Supabase > SQL Editor > New query > Run
-- ============================================================

-- ---------- 1. TABLAS ----------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text not null,
  es_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.fases (
  id serial primary key,
  nombre text not null,
  cuota numeric not null default 0,
  orden int not null,
  fecha_limite timestamptz -- límite para enviar/editar pronósticos de la fase
);

create table public.pagos (
  user_id uuid not null references public.profiles(id) on delete cascade,
  fase_id int not null references public.fases(id) on delete cascade,
  pagado boolean not null default false,
  fecha_pago timestamptz,
  primary key (user_id, fase_id)
);

create table public.partidos (
  id serial primary key,
  fase_id int not null references public.fases(id) on delete cascade,
  jornada int not null default 1,
  grupo text,                          -- ej. 'A', 'B'... (null en eliminatorias)
  equipo_local text not null,
  equipo_visitante text not null,
  fecha_hora timestamptz not null,     -- hora del pitazo inicial (candado de pronósticos)
  goles_local int,
  goles_visitante int,
  finalizado boolean not null default false
);

create table public.pronosticos (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  partido_id int not null references public.partidos(id) on delete cascade,
  goles_local int not null check (goles_local between 0 and 20),
  goles_visitante int not null check (goles_visitante between 0 and 20),
  actualizado timestamptz not null default now(),
  unique (user_id, partido_id)
);

-- ---------- 2. PERFIL AUTOMÁTICO AL REGISTRARSE ----------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nombre)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 3. FUNCIONES AUXILIARES ----------

-- ¿El usuario actual es administrador?
create or replace function public.is_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce((select es_admin from public.profiles where id = auth.uid()), false)
$$;

-- Sistema de puntos de la quiniela:
--   Marcador exacto de victoria .......... 3 puntos
--   Empate con marcador exacto ........... 2 puntos
--   Empate sin marcador exacto ........... 1 punto
--   Ganador correcto sin marcador exacto . 1 punto
--   Lo demás ............................. 0 puntos
create or replace function public.calcular_puntos(pl int, pv int, rl int, rv int)
returns int
language sql immutable
as $$
  select case
    when rl is null or rv is null then 0
    when pl = rl and pv = rv then (case when rl = rv then 2 else 3 end)
    when sign(pl - pv) = sign(rl - rv) then 1
    else 0
  end
$$;

-- ---------- 4. SEGURIDAD (ROW LEVEL SECURITY) ----------

alter table public.profiles    enable row level security;
alter table public.fases       enable row level security;
alter table public.pagos       enable row level security;
alter table public.partidos    enable row level security;
alter table public.pronosticos enable row level security;

-- PROFILES: todos ven los nombres; cada quien edita solo su nombre
create policy "ver perfiles" on public.profiles
  for select to authenticated using (true);
create policy "editar mi perfil" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
-- Nadie puede auto-nombrarse admin: solo la columna nombre es editable
revoke update on public.profiles from authenticated;
grant update (nombre) on public.profiles to authenticated;

-- FASES: todos las ven; solo admin las modifica
create policy "ver fases" on public.fases
  for select to authenticated using (true);
create policy "admin gestiona fases" on public.fases
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- PAGOS: todos ven quién ha pagado; solo admin registra pagos
create policy "ver pagos" on public.pagos
  for select to authenticated using (true);
create policy "admin gestiona pagos" on public.pagos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- PARTIDOS: todos los ven; solo admin los crea y carga resultados
create policy "ver partidos" on public.partidos
  for select to authenticated using (true);
create policy "admin gestiona partidos" on public.partidos
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- PRONÓSTICOS — las dos reglas de oro:
-- (a) Candado de tiempo: solo se crean/editan ANTES del pitazo inicial
-- (b) Secreto: los pronósticos ajenos solo se ven cuando el partido ya inició
create policy "crear pronostico antes del partido" on public.pronosticos
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.partidos pa
                join public.fases f on f.id = pa.fase_id
                where pa.id = partido_id 
                  and now() < pa.fecha_hora
                  and (f.fecha_limite is null or now() < f.fecha_limite))
  );

create policy "editar pronostico antes del partido" on public.pronosticos
  for update to authenticated
  using (
    user_id = auth.uid()
    and exists (select 1 from public.partidos pa
                join public.fases f on f.id = pa.fase_id
                where pa.id = partido_id 
                  and now() < pa.fecha_hora
                  and (f.fecha_limite is null or now() < f.fecha_limite))
  )
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.partidos pa
                join public.fases f on f.id = pa.fase_id
                where pa.id = partido_id 
                  and now() < pa.fecha_hora
                  and (f.fecha_limite is null or now() < f.fecha_limite))
  );

create policy "ver pronosticos" on public.pronosticos
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from public.partidos pa
               where pa.id = partido_id and now() >= pa.fecha_hora)
  );

-- ---------- 5. TABLA DE POSICIONES (vista) ----------
-- Solo suma puntos de partidos finalizados y de jugadores con la fase pagada.

create or replace view public.tabla_posiciones as
select
  f.id   as fase_id,
  f.nombre as fase,
  pn.user_id,
  pf.nombre,
  sum(public.calcular_puntos(pn.goles_local, pn.goles_visitante,
                             pa.goles_local, pa.goles_visitante)) as puntos,
  count(*) filter (
    where pn.goles_local = pa.goles_local
      and pn.goles_visitante = pa.goles_visitante
  ) as exactos,
  count(*) filter (
    where pn.goles_local = pa.goles_local
      and pn.goles_visitante = pa.goles_visitante
      and pa.goles_local != pa.goles_visitante
  ) as exactos_victoria,
  count(*) filter (
    where pn.goles_local = pa.goles_local
      and pn.goles_visitante = pa.goles_visitante
      and pa.goles_local = pa.goles_visitante
  ) as exactos_empate,
  count(*) filter (
    where public.calcular_puntos(pn.goles_local, pn.goles_visitante,
                                 pa.goles_local, pa.goles_visitante) = 1
  ) as aciertos_simples,
  count(*) as pronosticados
from public.pronosticos pn
join public.partidos pa on pa.id = pn.partido_id and pa.finalizado
join public.fases f     on f.id = pa.fase_id
join public.profiles pf on pf.id = pn.user_id
join public.pagos pg    on pg.user_id = pn.user_id
                       and pg.fase_id = f.id
                       and pg.pagado
group by f.id, f.nombre, pn.user_id, pf.nombre;

-- ---------- 6. DATOS INICIALES ----------

insert into public.fases (nombre, cuota, orden) values
  ('Fase de grupos', 20, 1),
  ('Dieciseisavos y octavos', 20, 2),
  ('Cuartos, semis y final', 30, 3);

-- Los partidos se cargan desde la página /admin de la app,
-- o por SQL con este formato (hora de Guatemala = UTC-6):
--
-- insert into public.partidos
--   (fase_id, jornada, grupo, equipo_local, equipo_visitante, fecha_hora)
-- values
--   (1, 1, 'A', 'México', 'Rival', '2026-06-11 19:00:00-06');

-- ---------- 7. ÚLTIMO PASO (manual) ----------
-- Después de crear TU cuenta en la app, nombrate administrador
-- corriendo esto con tu correo:
--
-- update public.profiles set es_admin = true
-- where id = (select id from auth.users where email = 'TU_CORREO@ejemplo.com');
