# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

El proyecto se documenta y se commitea en español. Código y nombres de archivo en
español también (`asistencia`, `calificaciones`, `alumnos`).

## Estado actual del repo

C1 y C1b hechos: el scaffold de Vite está limpio, Tailwind v4 corre como plugin
de Vite, el alias `@/` resuelve, `strict` está activo, existen las carpetas de
las cuatro capas (vacías, con `.gitkeep`), shadcn está configurado con los tokens
del bicolor (`Button` e `Input` ya corregidos a 44 px / 16 px) y Archivo y DM Mono
están auto-hospedadas.

Todavía **no** hay nada de dominio, datos ni pantallas, y **no** están instalados
Dexie, Zustand ni `vite-plugin-pwa`. Eso está descrito en `docs/` como destino, no
como hecho consumado. Antes de afirmar que algo existe, verificarlo en `src/`.

El plan de construcción con criterios de aceptación por commit está en
`docs/COMMITS.md` (C1 … C16). Seguir ese orden.

## Comandos

```bash
npm run dev       # Vite dev server
npm run build     # tsc -b && vite build
npm run lint      # eslint .
npm run preview   # servir dist/
npm run typecheck # tsc -b, chequeo de tipos, requisito antes de cada commit
npm test          # vitest run, una vez
npm run test:watch # vitest en modo watch
```

No usar `npx tsc --noEmit` a secas: `tsconfig.json` es un archivo-solución con
`files: []`, así que ese comando no chequea nada y pasa incluso con errores de
tipos. El chequeo real es `tsc -b` (`npm run typecheck`).

Vitest corre en entorno `node` sobre `src/**/*.test.ts`, colocados junto al
archivo que prueban. Las pruebas se importan explícitamente de `vitest` (sin
`globals: true`), así que no hace falta configurar tipos globales ni tocar
ESLint. Un archivo que necesite DOM o IndexedDB pide su propio entorno con
`// @vitest-environment` en la primera línea.

## Qué es esto

App PWA offline-first para que una maestra de primaria registre asistencia,
calificaciones y notas de un solo grupo. **Un usuario, un dispositivo (iPad), sin
red garantizada.** No hay login, no hay multi-grupo, no hay pantalla de ajustes.

El criterio que gobierna todo: **la competencia es el cuaderno, no Excel.** Si
pasar asistencia de 30 alumnos toma más de 15 segundos, el producto está muerto.
Cualquier función que agregue un toque al camino diario tiene que justificarse
contra eso.

## Arquitectura — las reglas duras

Cuatro capas, dependencias en una sola dirección (detalle en
`docs/ARCHITECTURE.md`):

1. `domain/` no importa nada — ni React, ni Dexie, ni librerías.
2. `application/` importa `domain/` y `data/ports/`. **Nunca** `data/dexie/`.
3. `ui/` importa `application/`, `domain/` y `ui/hooks/`. **Nunca** `data/dexie/`.
4. Solo `data/index.ts` sabe qué adaptador concreto se usa.

Las cuatro reglas están verificadas en `tests/arquitectura.test.ts`, que corre con
`npm test`: lee los archivos y falla si `domain/` importa algo externo, si `ui/` o
`application/` importan `data/dexie`, si un puerto importa Dexie o declara un
método por consulta (`find`, `query`, `where`), o si `liveQuery` aparece fuera de
`data/dexie`. Ya no hay que acordarse de correr el grep:

```bash
grep -rn "from.*data/dexie" src/ui src/application   # debe dar cero
```

Consecuencias prácticas:

- La reactividad es parte del **contrato del puerto**: el puerto declara
  `observarDia(fecha): Suscribible<T[]>`; el adaptador de Dexie lo implementa con
  `liveQuery`. `liveQuery` y `dexie-react-hooks` aparecen **solo** en
  `data/dexie/`. Los componentes consumen hooks propios de `ui/hooks/`.
- Los métodos de los puertos se nombran por **caso de uso**, no por consulta.
  Nada de `find()`, `query()`, `where()`, ni `BaseRepository<T>`. Cada puerto
  declara solo lo que alguna pantalla usa hoy.
- Zustand es hermano de React, no una capa de datos: guarda `diaSeleccionado`,
  `actividadActiva`, `pestanaActiva`, `aviso`. **Nunca** alumnos, asistencia,
  calificaciones ni notas — eso vive en IndexedDB y se lee por hook.
- Sin router en la v1: cuatro pestañas manejadas con estado en Zustand.
- Supabase (fase 2) **no** es una implementación alternativa del puerto. El
  repositorio siempre escribe en Dexie; un motor de sincronía aparte lee la
  `outbox` y sube. Solo *subir pendientes* y *restaurar todo*; sin merge.

## Invariantes del modelo de datos

No se pueden agregar retroactivamente sin migrar datos reales del salón
(`docs/DATA-MODEL.md`):

1. IDs con `crypto.randomUUID()`, nunca autoincremento. (Excepción: `outbox`,
   que usa `++seq` porque es local y nunca se sincroniza como contenido.)
2. `updated_at` ISO-8601 UTC en **cada** mutación, sin excepción.
3. Borrado suave con `deleted_at`; toda lectura filtra `deleted_at === null`.
4. Tabla `outbox` desde el primer commit; cada mutación encola su cambio en la
   **misma transacción de Dexie** que la escritura.

El índice `[fecha+alumno_id]` en `asistencia` sostiene la pantalla principal:
garantiza un registro por alumno por día y permite upsert directo.

## Restricciones de UI que son requisitos, no sugerencias

- Objetivo táctil mínimo **44 × 44 px**.
- `font-size` mínimo **16 px** en cualquier control editable — por debajo, Safari
  hace zoom automático al enfocar.
- Barra de pestañas con `env(safe-area-inset-bottom)`.
- Al agregar un componente de shadcn, corregir su `cva` **una vez**
  (`h-9 → h-11`, `h-10 → h-12`, `text-sm → text-base`), nunca parchear con
  `className` por sitio de uso.
- Los tokens del lápiz bicolor viven en `@theme` y son la fuente de verdad; las
  variables semánticas de shadcn (`--primary`, `--destructive`, `--background`)
  apuntan a ellos, nunca al revés.
- Componentes de shadcn salen a `src/ui/components/ui` (alias `@/`).
- `registerType: 'prompt'` en `vite-plugin-pwa`, nunca `autoUpdate`: una recarga
  a mitad de una captura es motivo de abandono.

Detalle de paleta, tipografía y reparto shadcn/propio en `docs/UX.md` y
`docs/DECISIONES.md` (D-010).

## Trampas de iPadOS

- `crypto.randomUUID()` requiere contexto seguro: falla en `http://192.168.x.x`.
  Probar en el iPad por red local con `npm run dev -- --host` rompe la creación
  del primer registro.
- El service worker no corre sobre HTTP salvo `localhost`. La instalación como
  PWA y el comportamiento offline **solo** se validan en el deploy, no en `dev`.
- No existe Background Sync ni Notification Triggers en iOS: toda sincronía es
  con la app abierta, y no hay notificaciones locales agendadas.

Lista de verificación antes de entregar el iPad: `docs/PWA-IOS.md`.

## Commits

Conventional Commits, en español, imperativo, sin punto final.
Tipos: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`.
Alcances: `domain`, `data`, `app`, `ui`, `asistencia`, `calificaciones`, `notas`,
`grupo`, `pwa`, `sync`.

```
feat(asistencia): ciclar estado con un toque en la fila
```

Un commit compila, pasa `npm run typecheck` y `npm test`, y es un incremento
verificable: si no se
le puede escribir un criterio de aceptación, está mal cortado.

## Datos reales

**Nada de nombres de alumnos reales en el repositorio.** La semilla real va en
`src/data/seed/grupo.ts`, ignorada por git, con un `grupo.example.ts`
versionado. Verificar `git status` antes de commitear la semilla.

## Supuestos sin validar

`docs/` marca con `[POR VALIDAR]` los supuestos sobre evaluación en primaria
(escala 5–10 entera, campos formativos de la NEM, umbrales de riesgo). No están
confirmados con la usuaria. La escala bloquea la pantalla de calificaciones: si
usa decimales o evaluación descriptiva, la captura por botones se cae. No
construir C11 en adelante asumiendo que están resueltos.
