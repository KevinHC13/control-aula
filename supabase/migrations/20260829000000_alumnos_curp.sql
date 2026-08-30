-- Los alumnos guardan su CURP (docs/DECISIONES.md D-027).
--
-- Revierte a sabiendas el «sin CURP» de D-014. La razón es la lista real: la de
-- Control Escolar trae `No | MATRÍCULA | CURP | NOMBRE` y **no trae fecha de
-- nacimiento**, que vive dentro de la CURP. Sin esta columna, el aviso de
-- cumpleaños (C15) exigiría teclear treinta fechas a mano.
--
-- Sin esta columna aquí, la sincronía subiría filas con `curp` y PostgREST las
-- rechazaría: el cliente la escribe desde que la carga de lista la lee.
--
-- Nullable a propósito: una lista puede no traerla, un alumno que se dio de alta
-- a mano puede no tenerla a la mano, y ninguno de los dos casos es un error.
--
-- Sin restricción de unicidad: la identidad del alumno sigue siendo
-- `[ciclo_id+numero_lista]` en el cliente, y un CURP mal leído por OCR no puede
-- ser motivo de que el respaldo entero falle al subir.
alter table public.alumnos add column if not exists curp text;

-- Las políticas de RLS son por `owner` y no cambian: la columna nueva viaja
-- dentro de filas que ya estaban acotadas a su dueña.
