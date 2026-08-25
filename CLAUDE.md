# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Idioma

El proyecto se documenta y se commitea en español. Código y nombres de archivo en
español también (`asistencia`, `calificaciones`, `alumnos`).

## Estado actual del repo

**`docs/ESTADO.md` es la fuente de verdad del estatus.** Leerlo antes de decidir
qué construir; el resumen de aquí abajo se queda viejo primero.

**La Fase 4 está terminada**: hecho de C18 a C29, más los fixes C19b y C21c. Y
encima está hecho **`C12`, la bitácora**, con `db.version(3)`.
Existen y funcionan:

- **`domain/`** completo: `entities.ts` con la jerarquía `Ciclo → … → Actividad`,
  `values.ts`, `fechas.ts`, `rules.ts`, `evaluacion.ts` —la estructura de la
  evaluación— y `calculo.ts` —la cadena de cálculo, C28, más las tres fórmulas de
  los criterios automáticos, C26—, con pruebas.
- **`data/`** con Dexie en `version(3)`: `db.ts` con las dieciséis tablas
  sincronizables, adaptadores de alumnos, asistencia, evaluación y bitácora, sus
  puertos y la `outbox`. **Ya no hay semilla** (D-024): la app arranca vacía y la
  lista entra por la carga con IA o por un respaldo. `bitacora` reemplazó a
  `notas`.
  De las once tablas de evaluación tienen puerto y adaptador `ciclos`,
  `trimestres`, `criterios`, `criterios_trimestre`, `rubricas`,
  `rubrica_criterios`, `actividades`, `entregas`, `eval_rubrica`, `examen_config`,
  `resultados_examen` y `cierres`. **Las dieciséis tablas están en uso**:
  `participaciones` entró con el modo de participación (C25).
- **`application/`**: `asistencia.ts`, `importacion.ts`,
  `evaluacion.ts`, `entregas.ts`, `calificacion.ts`, `examen.ts`,
  `calificaciones.ts` —el reporte del trimestre y su cierre—, `bitacora.ts`,
  `participacion.ts` y `respaldo.ts` —el archivo JSON con todo, C14—. `armarReporte` es la
  única función que decide entre recalcular y leer el snapshot: no duplicar esa
  decisión.
- **`services/`**: `extraccion.ts`, `supabase.ts` y `sincronia.ts` —la única salida
  a red del cliente—. El motor de sincronía tiene además su propio puerto
  (`data/ports/sincronia.ts`): habla de filas y de la `outbox`, no de alumnos, y no
  vuelve a pasar por los casos de uso.
- **`ui/`**: las cuatro pestañas, la de asistencia terminada (tira de días,
  calendario del mes, contador, filas, etiqueta del trimestre), Ajustes, la carga
  de lista con IA, la configuración del ciclo escolar, los criterios con sus pesos,
  las rúbricas, el cierre del trimestre, y `Calificaciones` con las actividades del
  trimestre, sus tres capturas —entregas, rúbrica alumno por alumno y el examen por
  aciertos con teclado numérico propio— y el reporte por alumno y por campo
  formativo.
  **`Bitácora`** —lo que era `Notas`— con el conteo de reportes por alumno y el
  historial del trimestre, y **`Grupo`** con el resumen del trimestre —asistencia y
  promedio, del grupo y por alumno (C13)— más los equipos. **Ya no hay placeholders.**
- PWA con `vite-plugin-pwa`, Zustand y el aviso de actualización.
- Una Edge Function desplegada en Supabase, `extraer-lista`, en
  `supabase/functions/`.

**`C14`, el respaldo en JSON, ya está**: *Grupo → Ajustes → Respaldo* exporta las
dieciséis tablas a un archivo y lo restaura por upsert. Falta una sola cosa y es de
dispositivo, no de código: ver en el iPad que la hoja de compartir ofrezca *Guardar
en Archivos*.

El **alcance nuevo del 2026-08-21** —la usuaria retomó los tres criterios
automáticos con reglas propias (D-020)— **está terminado**: `C12` la bitácora, `C25b`
la configuración, `C25` el modo de participación y `C26` las tres fórmulas. Con
conducta configurada, todo el grupo tiene 10.0 desde el primer día: no tener reportes
es el dato.

Las dos **herramientas de aula** (D-021) están hechas: `C30` —el sorteo de
participación, en la pantalla de asistencia— y `C31` —formar equipos, en la pestaña
Grupo, que no guarda nada—.

**Los treinta y un commits del plan están escritos**: `C16`, el motor de sincronía,
cerró la lista. Lo que queda no es código —los tres pasos de Supabase, una pasada con
el iPad y dos validaciones con la usuaria—; está en `docs/ESTADO.md`.

Encima entran dos **herramientas de aula** (D-021): `C30` —sortear quién participa,
que escribe en `participaciones` y no registra nada por sí solo— y `C31` —formar
equipos, que no guarda nada porque los equipos son estado de interfaz—. Son las dos
únicas funciones que se usan con los niños mirando la pantalla: se leen de lejos y no
hacen esperar.

De la Fase 3 ya está todo: bitácora (`C12`), resumen (`C13`), respaldo (`C14`),
cumpleaños (`C15`) y sincronía (`C16`).

Ojo con algo que no es un commit: **la Fase 4 nunca se ha usado en el iPad**, solo en
el navegador; falta medir con cronómetro la captura con rúbrica y la del examen.

Antes de afirmar que algo existe, verificarlo en `src/`.

El plan de construcción con criterios de aceptación por commit está en
`docs/COMMITS.md` (C1 … C31), con el estatus marcado commit por commit. Seguir
ese orden.

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
calificaciones y reportes de un solo grupo. **Un usuario, un dispositivo (iPad), sin
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
5. `services/` es la única salida a red del cliente y no pasa por el
   repositorio. `domain/` y `data/` no lo conocen; él no importa `data/` ni
   `ui/`.

Las reglas están verificadas en `tests/arquitectura.test.ts`, que corre con
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
  calificaciones ni reportes — eso vive en IndexedDB y se lee por hook.
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
garantiza un registro por alumno por día y permite upsert directo. En evaluación
lo hacen `[actividad_id+alumno_id]` y `[criterio_trimestre_id+alumno_id]`.

## Reglas de la evaluación (Fase 4)

Salieron de la validación con la usuaria, no de planeación previa (D-015). Detalle
y fórmulas en `docs/DATA-MODEL.md`; lo que no se negocia al escribir código:

- Jerarquía `Ciclo → Trimestre → CriterioTrimestre → Actividad → Entrega |
  EvaluacionRubrica`. La actividad cuelga de `CriterioTrimestre`, **nunca** de
  `Criterio`: es lo que hace que un trimestre nuevo nazca con cero actividades sin
  borrar ni filtrar nada.
- Todo el cálculo en **base 1**; la conversión a base 10 ocurre una sola vez, al
  presentar, **con un decimal** (D-018), y `comoCalificacion` es el único lugar que
  redondea. **Sin redondeo intermedio y sin piso de escala** — una calificación
  menor a 5 se muestra tal cual. El porcentaje no aparece nunca en la interfaz.
- **Lo que no está capturado no vale cero: se excluye** (D-019). Una captura
  incompleta devuelve `null` y el alumno queda fuera de esa actividad; el trimestre
  se normaliza sobre los pesos que sí aportan y viaja con `pesoConsiderado`, para
  que la pantalla pueda decir sobre cuánto calcula.
- Niveles fijos `['Excelente','Bien','Regular','Mal']` con
  `VALOR_NIVEL = [3, 2.5, 2, 0]`. Se almacena el **índice** del nivel, no su
  valor, para que cambiar la tabla no migre datos.
- El general de un criterio es el promedio de **todas** sus actividades, no el
  promedio de los promedios por campo formativo.
- Una actividad sin ningún registro se excluye del promedio. Por eso abrir la
  pantalla de captura escribe los 30 registros de golpe — lo contrario de
  asistencia (D-013), y a propósito.
- Un trimestre cerrado rechaza toda escritura y su calificación viene del snapshot
  `CierreTrimestre`, no de recalcular. Esa decisión vive en un solo lugar
  —`reporteDeTrimestre`— para que ninguna pantalla pueda saltársela. **Reabrir** borra
  el snapshot, conserva `cerrado_en` como huella y exige confirmación explícita.
- Los pesos pueden sumar cualquier cosa mientras se editan; solo el **cierre**
  exige 100.
- Una rúbrica **en uso** no se borra: se desactiva (`Rubrica.activa`). Desactivada
  sale del selector pero sigue resolviendo lo ya calificado. `deleted_at` se
  reserva para las que nadie usó.
- Editar una rúbrica **conserva el `id` de sus renglones**: es la clave de
  `EvaluacionRubrica.niveles`, y recrearlos dejaría huérfano lo ya calificado.
- **La rúbrica cuelga de la `Actividad`, no del `CriterioTrimestre`** (D-016). Un
  criterio tiene muchas actividades y cada una se evalúa con lo que le toca; y con
  la rúbrica en el criterio, cambiarla dejaba las `EvaluacionRubrica` ya capturadas
  apuntando a renglones de la rúbrica vieja. Una actividad sin `rubrica_id` no está
  incompleta: significa captura binaria, entregada / no entregada. Solo las
  criterios `entregable` se llenan con actividades (`admiteActividades`); el examen
  se captura por aciertos sobre el `CriterioTrimestre`.
- **Al abrir la captura de una actividad se materializan los 30 registros** en
  `entregada: true`, en una transacción e idempotente. Es lo contrario de la
  asistencia (D-013) y a propósito: a una actividad no se entra si no es a
  calificarla, y así «cero registros ⇒ sin calificar» queda inequívoco.
- **Ninguna pantalla de captura tiene botón de Guardar.** Cada toque escribe.
- **Cambiar con qué se califica una actividad descarta su captura**, y el caso de
  uso exige confirmación explícita: `EvaluacionRubrica.niveles` está indexado por
  los renglones de la rúbrica anterior. Renombrarla o moverle la fecha no tira
  nada.
- **Hay un examen por trimestre y cuelga del `CriterioTrimestre`** (D-018), no de
  una actividad: se captura por aciertos sobre preguntas, con `ExamenConfig` como
  denominador. Un campo sin preguntas no se captura, y más aciertos que preguntas no
  es un dato improbable sino imposible. Todo se teclea con el **teclado de la app**:
  el nativo de iPadOS tapa media pantalla y hace zoom.
- **Los tres criterios automáticos se derivan, nunca se capturan** (D-020).
  Puntualidad: `(días − faltas − ⌊retardos ÷ retardos_por_falta⌋) ÷ días`, y con
  `retardos_por_falta: null` un retardo no penaliza. Conducta: sale de la
  **bitácora**, donde todo reporte es negativo —0 o 1 reportes valen 10, 2 vale 5, 3
  o más vale 0— y **sin reportes vale 10, no `—`**: no tener reportes es el dato.
  Participación: se marca con un modo en la pantalla de asistencia y se califica
  `mín(participaciones ÷ meta, 1)`, con la meta en **5** por omisión (D-021) —cinco
  o más valen 10.0, una vale 2.0—. Ninguno de los tres aporta a un campo formativo,
  así que solo cuentan para el general.
- La atribución al trimestre es **por fecha y nunca manual**: no existe ni debe
  existir un selector de trimestre en el camino diario. Una fecha fuera de todo
  rango devuelve `null`, que es un resultado normal —vacaciones, puentes— y no un
  error.
- **La atribución no se guarda, se deriva al leer.** Es lo que permite abrir el
  ciclo con un solo trimestre (D-017): los días capturados antes de abrir el
  trimestre que los contiene quedan atribuidos en cuanto se abre, sin migración.
  No convertir esto en un campo almacenado.
- Un ciclo con **uno o dos** trimestres es válido. Nada debe asumir tres.

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
Alcances: `domain`, `data`, `app`, `ui`, `asistencia`, `calificaciones`,
`bitacora`, `grupo`, `pwa`, `sync`, `evaluacion`.

```
feat(asistencia): ciclar estado con un toque en la fila
```

Un commit compila, pasa `npm run typecheck` y `npm test`, y es un incremento
verificable: si no se
le puede escribir un criterio de aceptación, está mal cortado.

## Datos reales

**Nada de nombres de alumnos reales en el repositorio.** Ya no hay semilla ni
archivo de ejemplo con nombres inventados (D-024): la lista entra en el
dispositivo, nunca por el código. Las pruebas usan nombres inventados definidos
en el propio archivo de prueba.

Lo mismo con los archivos de prueba de la carga de lista: nunca subir a un
servicio externo la lista real durante las pruebas, y nunca dejar el PDF en el
repositorio. `.env` está ignorado; `.env.example` es el versionado. La clave de
Gemini no va en el front: es secret de la Edge Function.

## Supuestos sin validar

Los gruesos ya se validaron y el resultado tiró el modelo anterior: no existe la
escala 5–10 con seis botones, y los campos formativos sí sirven como agrupación de
reporte. Lo que queda abierto, con lo que bloquea cada uno, está listado en
`docs/ESTADO.md`:

- El umbral de riesgo por asistencia.
- ¿Una captura a medias debería dar calificación? Se resolvió excluyéndola (D-019),
  pero sin preguntárselo a la usuaria.
- El umbral real de riesgo por asistencia y de promedio. Ya no bloquea nada: `C13`
  se construyó con los del prototipo —90 % y 6.0— y **la pantalla los escribe**, así
  que el día que ella diga otro número es cambiar una constante.

Ninguno bloquea C28. Si aparece uno nuevo, se marca `[POR VALIDAR]` y se anota en
`docs/ESTADO.md` qué commit detiene.
