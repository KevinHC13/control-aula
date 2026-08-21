-- Palomita · el espejo de la base local en Supabase (C16)
--
-- Las dieciséis tablas de `TABLAS_SINCRONIZABLES` (src/data/dexie/db.ts), una por
-- una y con las mismas columnas que las entidades de `src/domain/entities.ts`.
-- La `outbox` no está: es local, efímera y nunca se sincroniza como contenido.
--
-- Esto es un **espejo para respaldar y restaurar**, no un almacén que se consulte:
-- la única fuente de verdad es IndexedDB en el iPad, y el motor solo sabe subir
-- pendientes y bajar todo (docs/DECISIONES.md D-006). De ahí tres decisiones que
-- de otro modo parecerían descuidos:
--
-- 1. **Las fechas y los instantes son `text`, no `date` ni `timestamptz`.** El
--    cliente guarda `Fecha` como "2026-09-10" e `Instante` como
--    "2026-09-10T14:32:07.123Z", y los compara como cadenas —ISO-8601 ordena
--    igual que el calendario—. Con tipos de fecha, el viaje de ida y vuelta
--    devolvería "+00:00" en vez de "Z" y las comparaciones locales dejarían de
--    ser byte a byte. Un espejo tiene que devolver exactamente lo que recibió.
-- 2. **No hay claves ajenas entre tablas.** Restaurar sube tabla por tabla y una
--    FK obligaría a un orden total —o a diferir todo— para escribir lo mismo que
--    ya es consistente en el dispositivo. La integridad la garantiza el cliente,
--    que es quien crea los `id`.
-- 3. **No hay índices más allá de la clave primaria.** Se lee `select *` de una
--    tabla completa y se escribe `upsert` por `id`; no hay consulta que indexar.
--
-- El acceso, en D-023: una cuenta con correo y contraseña, y RLS que solo deja ver
-- y escribir las filas propias. `owner` la pone Postgres con `default auth.uid()`,
-- así que el cliente nunca la manda y la descarta al bajar.
--
-- Ojo con algo que no es SQL: **apagar los registros públicos** en el proyecto
-- después de crear su cuenta. Con `signup` abierto cualquiera puede crear un
-- usuario; no vería nada de ella —las políticas lo impiden— pero no hay razón para
-- dejar la puerta.

create table if not exists public.alumnos (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  nombre text not null,
  numero_lista integer not null,
  fecha_nacimiento text
);

create table if not exists public.asistencia (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  alumno_id text not null,
  fecha text not null,
  estado text not null
);

-- La bitácora: todo lo que se anota es un reporte, y todos son negativos (D-020).
create table if not exists public.bitacora (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  alumno_id text not null,
  fecha text not null,
  texto text not null
);

-- Un contador por alumno y por día, no una fila por marca.
create table if not exists public.participaciones (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  alumno_id text not null,
  fecha text not null,
  cantidad integer not null
);

create table if not exists public.ciclos (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  nombre text not null,
  estado text not null
);

create table if not exists public.trimestres (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  ciclo_id text not null,
  numero integer not null,
  inicio text not null,
  fin text not null,
  estado text not null,
  cerrado_en text
);

create table if not exists public.criterios (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  nombre text not null,
  tipo text not null
);

-- `meta_participacion` y `retardos_por_falta` son los parámetros de los criterios
-- automáticos (C25b); el resto de los tipos los deja nulos.
create table if not exists public.criterios_trimestre (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  trimestre_id text not null,
  criterio_id text not null,
  peso integer not null,
  orden integer not null,
  meta_participacion integer,
  retardos_por_falta integer
);

create table if not exists public.rubricas (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  nombre text not null,
  activa boolean not null
);

-- `descriptores` es un arreglo de cuatro cadenas, uno por nivel.
create table if not exists public.rubrica_criterios (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  rubrica_id text not null,
  nombre text not null,
  descriptores jsonb not null,
  orden integer not null
);

create table if not exists public.actividades (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  criterio_trimestre_id text not null,
  nombre text not null,
  campo text not null,
  ejes jsonb not null,
  fecha text not null,
  rubrica_id text
);

create table if not exists public.entregas (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  actividad_id text not null,
  alumno_id text not null,
  entregada boolean not null
);

-- `niveles`: `rubrica_criterio_id` → índice del nivel elegido, nunca su valor.
create table if not exists public.eval_rubrica (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  actividad_id text not null,
  alumno_id text not null,
  niveles jsonb not null
);

create table if not exists public.examen_config (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  criterio_trimestre_id text not null,
  preguntas jsonb not null
);

create table if not exists public.resultados_examen (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  criterio_trimestre_id text not null,
  alumno_id text not null,
  aciertos jsonb not null
);

-- El snapshot del cierre. `final` en base 1, igual que toda la cadena de cálculo;
-- la conversión a base 10 ocurre al presentar, y solo ahí.
create table if not exists public.cierres (
  id text primary key,
  owner uuid not null default auth.uid(),
  updated_at text not null,
  deleted_at text,
  trimestre_id text not null,
  alumno_id text not null,
  final double precision,
  desglose jsonb not null
);

-- RLS y políticas, iguales para las dieciséis: cada quien ve y escribe lo suyo.
--
-- En un bucle y no escritas a mano sesenta y cuatro veces, porque son idénticas:
-- una política copiada dieciséis veces es una que va a quedar distinta de las
-- otras quince el día que alguien la corrija.
do $$
declare
  t text;
begin
  foreach t in array array[
    'alumnos', 'asistencia', 'bitacora', 'participaciones',
    'ciclos', 'trimestres', 'criterios', 'criterios_trimestre',
    'rubricas', 'rubrica_criterios', 'actividades', 'entregas',
    'eval_rubrica', 'examen_config', 'resultados_examen', 'cierres'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_propias_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (owner = auth.uid())',
      t || '_propias_select', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_propias_insert', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (owner = auth.uid())',
      t || '_propias_insert', t
    );

    execute format('drop policy if exists %I on public.%I', t || '_propias_update', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid())',
      t || '_propias_update', t
    );

    -- El borrado duro existe por si algún día hace falta limpiar; la app no lo
    -- usa: borra suave con `deleted_at`, y esa fila viaja como una más.
    execute format('drop policy if exists %I on public.%I', t || '_propias_delete', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (owner = auth.uid())',
      t || '_propias_delete', t
    );
  end loop;
end $$;
