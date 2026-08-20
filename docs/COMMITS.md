# Commits

## Convención

Conventional Commits, en español, imperativo, sin punto final.

```
<tipo>(<alcance>): <descripción>

[cuerpo opcional]
```

**Tipos:** `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`

**Alcances:** `domain`, `data`, `app`, `ui`, `asistencia`, `calificaciones`,
`notas`, `grupo`, `pwa`, `sync`, `evaluacion`

```
feat(asistencia): ciclar estado con un toque en la fila
fix(pwa): corregir zoom de Safari en campos de texto
refactor(data): mover liveQuery al adaptador de Dexie
docs: registrar la decisión sobre notificaciones push
```

## Reglas del repositorio

1. **Un commit compila y pasa `npm run typecheck` (`tsc -b`) y `npm test`.** No se
   rompe `main`.
2. **Un commit es un incremento verificable**, no un archivo suelto. Si no se
   puede escribir un criterio de aceptación, el commit está mal cortado.
3. **Los criterios de aceptación se verifican corriéndolos**, no en la
   descripción del commit: los que son afirmaciones sobre funciones puras van a
   Vitest; los que son de pantalla o de dispositivo, en el navegador y en el
   iPad.
4. **Cero imports de `data/dexie` fuera de `data/`.** Lo verifica
   `tests/arquitectura.test.ts` en cada `npm test`; ya no hay que acordarse del
   grep.
5. **Nada de datos reales del salón en el repositorio.** La lista de alumnos con
   nombres de menores va en un archivo ignorado por git, con un `grupo.example.ts`
   versionado.

## Cómo leer el estatus

| Marca | Significado |
|---|---|
| ✅ | Hecho y verificado en el repositorio |
| ▶ | Es lo que sigue |
| ⬜ | Pendiente |
| ⏸ | Pospuesto por decisión, no por falta de tiempo |
| ✖ | Cancelado o reemplazado; se conserva como registro |

El estado consolidado del proyecto —qué existe en `src/`, qué falta, qué está
bloqueado— vive en [ESTADO.md](./ESTADO.md). Este archivo es el plan; ése es la
foto.

---

# Plan de commits

Orden por incrementos verticales: cada bloque atraviesa todas las capas y llega a
pantalla. No se construye toda una capa antes de pasar a la siguiente.

## Fase 1 — Cimientos ✅

### ✅ C1 · `chore: inicializar proyecto con vite, react y typescript`

Scaffold, Tailwind v4 como plugin de Vite, estructura de carpetas vacía según
[ARCHITECTURE.md](./ARCHITECTURE.md), `.gitignore` con la ruta de la semilla real.

**Aceptación**
- [x] `npm run dev` arranca sin advertencias
- [x] `npm run build` genera `dist/`
- [x] `npm run typecheck` pasa en modo `strict`
- [x] Una clase de Tailwind aplica estilo visible
- [x] Existen `src/domain`, `src/data/ports`, `src/data/dexie`, `src/application`, `src/ui`

### ✅ C1b · `chore: configurar shadcn con los tokens del bicolor`

Alias `@/`, `components.json` apuntando a `src/ui/components/ui`, paleta en
`@theme` y variables semánticas de shadcn apuntadas a ella.

**Aceptación**
- [x] `@/` resuelve tanto en `tsc` como en Vite
- [x] Los componentes de shadcn caen en `src/ui/components/ui`, no en `src/components`
- [x] `--primary` resuelve a `#1B4F9C`, no al zinc por defecto
- [x] No existe ningún color de shadcn sin mapear a un token del bicolor
- [x] Un `Button` de prueba mide 44 px de alto
- [x] Un `Input` de prueba usa 16 px y no provoca zoom al enfocarlo en el iPad

### ✅ C2 · `feat(domain): definir entidades, valores y reglas de dominio`

`entities.ts`, `values.ts`, `fechas.ts`, `rules.ts` según
[DATA-MODEL.md](./DATA-MODEL.md).

**Aceptación**
- [x] Ningún archivo de `domain/` importa librerías externas
- [x] Toda entidad extiende `Sincronizable`
- [x] `promedioDe([])` devuelve `null`, nunca `0`
- [x] `cuentaComoAsistencia('retardo')` devuelve `true`
- [x] `porcentajeAsistencia([])` devuelve `100`, no `NaN`

### ✅ C3 · `feat(data): crear esquema de dexie con outbox`

`db.ts` con las seis tablas, índices compuestos y helper `ahora()` para
`updated_at`.

**Aceptación**
- [x] La base aparece en DevTools → Application → IndexedDB
- [x] Existe el índice `[fecha+alumno_id]` en `asistencia`
- [x] Existe la tabla `outbox` con clave `++seq`
- [x] Ninguna tabla de dominio usa clave autoincremental

### ✅ C4 · `feat(data): definir puertos de alumnos y asistencia`

Interfaces en `ports/`, más `Suscribible<T>` en `domain/values.ts`.

**Aceptación**
- [x] Todo método se nombra por caso de uso, no por consulta
- [x] No existe `find()`, `query()` ni `where()` en ningún puerto
- [x] No existe `BaseRepository<T>`
- [x] `ports/` no importa nada de `dexie`

---

## Fase 2 — Asistencia, el vertical completo ✅

Este es el corazón del producto. Si esto no queda bien, nada más importa.

### ✅ C5 · `feat(data): implementar adaptadores de alumnos y asistencia con dexie`

Incluye `observarDia` con `liveQuery` y la escritura transaccional que encola en
`outbox`.

**Aceptación**
- [x] `liveQuery` aparece **solo** en `data/dexie/`
- [x] Cada mutación escribe `updated_at`
- [x] Escritura y encolado en `outbox` ocurren en la misma transacción
- [x] Toda lectura filtra `deleted_at === null`
- [x] Marcar dos veces el mismo alumno el mismo día actualiza el registro, no crea un segundo

### ✅ C6 · `feat(app): agregar casos de uso de asistencia`

`marcarEstado()` con la lógica de ciclo, `pasarLista()` para crear el día
completo en presente.

**Aceptación**
- [x] `application/` no importa nada de `data/dexie`
- [x] Ciclar desde `justificada` devuelve `presente`
- [x] Abrir un día sin registros no falla y presenta a todos como presentes

### ✅ C7 · `feat(ui): construir shell con navegación de cuatro pestañas`

Store de Zustand, barra de pestañas, contenedor de pantallas.

**Aceptación**
- [x] El store no contiene alumnos, asistencia, calificaciones ni notas
- [x] Todo objetivo táctil mide al menos 44 × 44 px
- [x] La barra respeta `env(safe-area-inset-bottom)`
- [x] El foco de teclado es visible en cada pestaña

### ✅ C8 · `feat(asistencia): construir pantalla de lista con ciclo de estados`

Tira de días, contador, lista con barra de color, hook `useAsistenciaDelDia`.

**Aceptación**
- [x] La pantalla no importa nada de `data/dexie`
- [x] Al abrir un día nuevo, los 30 alumnos aparecen presentes
- [x] Un toque en la fila avanza el estado y el color cambia de inmediato
- [x] El contador de arriba se actualiza sin recargar
- [x] Recargar la página conserva lo capturado
- [x] **Pasar asistencia completa de 30 alumnos con 3 faltas toma menos de 15 segundos, medido con cronómetro**
- [x] Cambiar de día y volver muestra los datos correctos
- [x] Con el WiFi apagado funciona idéntico

El penúltimo criterio es el que define el producto. Si no se cumple, se rediseña
la pantalla antes de seguir.

### ✅ C9 · `feat(data): cargar lista real del grupo como semilla`

`grupo.example.ts` versionado, `grupo.ts` real ignorado por git.

**Aceptación**
- [x] La semilla corre una sola vez y es idempotente
- [x] `git status` no muestra el archivo con nombres reales
- [x] Los alumnos aparecen en el orden de la lista oficial

### ✅ C10 · `chore(pwa): configurar manifest, service worker e iconos`

**Aceptación**
- [x] Se instala en el iPad desde *Agregar a pantalla de inicio*
- [x] El ícono se ve nítido, no como captura de la página
- [x] Abre sin barra de navegador
- [x] `navigator.storage.persist()` devuelve `true`
- [x] Funciona completa en modo avión
- [x] Al haber versión nueva aparece un aviso, sin recarga automática
- [x] Se completa la lista de verificación de [PWA-IOS.md](./PWA-IOS.md)

### ✅ C10b · `feat(asistencia): abrir calendario del mes con mosaico de estatus`

Ajuste de alcance salido de ver la pantalla armada, antes de la pausa. La tira
deja de estar fija en siete días: carga tres meses, se recorre deslizando, centra
el día seleccionado y lleva `‹` y `›` fijos en los extremos para caminar de un día
en uno. En su posición 0, separado por una línea, un botón de calendario abre el
mes completo como mosaico: hueco si el día no se ha capturado, azul si no faltó
nadie, rojo con la cifra de ausentes si hubo faltas.

**Aceptación**
- [x] La tira se recorre deslizando con el dedo, sin tocar ningún día
- [x] `‹` y `›` no se mueven con el desplazamiento
- [x] `‹` pasa al día anterior y `›` al siguiente; `›` está apagado en hoy
- [x] Al cambiar de día, la tira lo centra sola
- [x] Con hoy seleccionado no se pinta ningún día futuro y hoy se ve completo, no cortado contra el borde
- [x] Girar el iPad no deja el día seleccionado fuera de vista
- [x] El botón de calendario mide al menos 44 × 44 px, está en la posición 0 y lo separa una línea de las flechas
- [x] Un día sin registrar se ve hueco; uno capturado sin faltas, azul; uno con faltas, rojo con la cifra
- [x] `‹` va al mes anterior; `›` está deshabilitado en el mes de hoy
- [x] Tocar un día cierra el diálogo, lo deja seleccionado y la lista muestra su detalle
- [x] Marcar una falta y volver a abrir el calendario muestra el mosaico ya actualizado
- [x] `Esc` y el toque fuera cierran, y el foco regresa al botón de calendario
- [x] El mes del mosaico se pide en una sola consulta por rango, no 31 por día

### ✅ C10c · Carga de la lista de alumnos con IA

Ajuste de alcance acordado el 2026-08-18, plan completo en
[CARGA-LISTA-IA.md](./CARGA-LISTA-IA.md), decisión en D-014. La lista deja de
depender de que el desarrollador esté disponible cada ciclo escolar.

Va en cuatro commits:

1. `chore: proteger la clave de gemini y documentar el entorno`
2. `chore(sync): desplegar la funcion de extraccion de listas`
3. `feat(app): extraer una lista de alumnos de un archivo`
4. `feat(grupo): cargar la lista de alumnos desde ajustes`
5. `fix(data): sembrar el grupo solo si la base esta vacia`

Los dos últimos del plan original —abrir Ajustes y la pantalla de carga— se
juntaron: Ajustes con una sola opción que no lleva a ningún lado no tiene
criterio de aceptación que escribir.

**Aceptación**
- [x] `git status` no muestra `.env` ni ningún archivo de prueba con nombres reales
- [x] La clave de Gemini no aparece en el bundle: `grep` sobre `dist/` no la encuentra
- [x] La función responde a un `curl` con un PDF de nombres inventados
- [x] El engrane del tab Grupo mide al menos 44 × 44 px y abre Ajustes
- [x] Subir un PDF muestra la pantalla de revisión con el conteo leído
- [x] Una fila con número repetido, nombre vacío o fecha mal formada se ve marcada
- [x] Corregir un número repetido apaga la marca en las **dos** filas
- [x] Guardar está deshabilitado mientras quede una fila marcada
- [x] Reimportar el mismo archivo no duplica y conserva la asistencia ya capturada
- [x] Recargar la app no devuelve los nombres de la semilla
- [x] Con las DevTools en *Offline*, el mensaje dice que hace falta conexión
- [x] En el iPad, sobre el deploy real, *Tomar foto* abre la cámara

Esto absorbió el C17 del plan original (*cargar lista de alumnos desde imagen*),
que se adelantó por necesidad y ya no existe como commit aparte.

---

## Hito · Entrega y pausa de una semana ✅

Después de C10 se le instaló el iPad y se detuvo el desarrollo. La pausa cumplió
exactamente lo que se esperaba de ella: la evaluación no se parecía a lo planeado
y el C11 provisional se cayó completo.

Resultado de la validación:

- [x] ¿Escala 5–10 entera, o con decimales? → **Ni una ni otra.** Rúbricas de
      cuatro niveles, cálculo en base 1, presentación en base 10 **sin piso**.
- [x] ¿Evaluación numérica o descriptiva por niveles de desempeño? → **Las dos**:
      se captura por niveles con descriptores, se reporta como número.
- [x] ¿Los campos formativos le sirven de agrupación, o son ruido? → **Sirven.**
      Son la agrupación con la que reporta, y por eso todo se calcula dos veces:
      por campo y en general.
- [ ] ¿Cuál es el umbral real de riesgo por asistencia? → **Sigue abierto.**
      Bloquea el color de alerta de C13, nada más.

Lo que salió de ahí es la [Fase 4](#fase-4--evaluación) completa, registrada en
[DECISIONES.md](./DECISIONES.md) D-015.

---

## Fase 3 — Después de la semana de uso

### ✖ C11 · ~~`feat(calificaciones): capturar por actividad con botones de 5 a 10`~~ — REEMPLAZADO

Escrito antes de la validación con la usuaria. Lo sustituye la Fase 4 completa.
Se conserva solo como registro de lo que se suponía y no era: la escala 5–10 con
seis botones no existe en ninguna parte del modelo nuevo.

### ⬜ C12 · `feat(notas): agregar anecdotario por alumno`

Independiente de la Fase 4 y de todo lo demás: no lee ni escribe nada de
evaluación mientras conducta siga pospuesta. Se puede tomar en cualquier momento.

**Aceptación**
- [ ] Guardar requiere alumno y texto no vacío
- [ ] El historial se ordena por fecha, más reciente primero
- [ ] El estado vacío invita a actuar en lugar de solo informar
- [ ] El campo de texto tiene al menos 16 px

### ⬜ C13 · `feat(grupo): mostrar resumen de asistencia y promedio`

El promedio ya no es `promedioDe(calificaciones)`: es el del trimestre activo, así
que la parte de calificaciones de esta pantalla depende de C28. La de asistencia,
no. Si se toma antes, se toma solo con asistencia.

**Aceptación**
- [ ] Los valores coinciden con un conteo manual de la base
- [ ] Sin calificaciones, el promedio muestra `—`, no `0.0`
- [ ] El color de alerta usa el umbral validado con ella

### ⬜ C14 · `feat: exportar e importar respaldo en json`

Cubre el riesgo de pérdida de datos antes de que exista el motor de sincronía.
Con la app ya en el iPad y datos reales dentro, **este es el commit de mayor
valor por unidad de trabajo que queda pendiente.**

Ojo: el respaldo tiene que exportar las tablas de `version(2)`, así que conviene
tomarlo después de C18 o aceptar que hay que volver a él.

**Aceptación**
- [ ] La exportación abre el diálogo de *Guardar en Archivos* en iPad
- [ ] Importar en una base vacía reconstruye todo, IDs incluidos
- [ ] Importar dos veces el mismo archivo no duplica registros

### ⬜ C15 · `feat: avisar cumpleaños del día y de la semana`

**Aceptación**
- [ ] El aviso aparece en la pantalla de asistencia, no en un modal
- [ ] La edad calculada es correcta
- [ ] Sin cumpleaños en la semana, no se muestra nada
- [ ] Funciona sin red

### ⬜ C16 · `feat(sync): subir cambios pendientes a supabase`

**Aceptación**
- [ ] La `outbox` se vacía solo tras confirmación del servidor
- [ ] Sin red, la app funciona idéntico y los cambios quedan encolados
- [ ] Se sincroniza al abrir y al cerrar, nunca en segundo plano
- [ ] Restaurar en un dispositivo limpio reconstruye todo
- [ ] Nada del motor de sincronía atraviesa el repositorio

### ✖ C17 · ~~`feat: cargar lista de alumnos desde imagen`~~ — ADELANTADO

Se construyó antes de tiempo como [C10c](#-c10c--carga-de-la-lista-de-alumnos-con-ia).
Sus criterios de aceptación viven ahí.

---

## Fase 4 — Evaluación

Reemplaza el C11 provisional. El alcance salió de la validación con la usuaria,
no de planeación previa. Ver [DECISIONES.md](./DECISIONES.md) D-015 y la
[jerarquía de evaluación](./DATA-MODEL.md#jerarquía-de-evaluación).

**Orden y dependencias.** C18 es prerrequisito de todo. Después, la cadena dura
es C19 → C20 → C21 → C21b → {C22, C23, C24} → C28 → C29. C27 (cierre) necesita
C28 para escribir el snapshot. C25 y C26 están pospuestos y no bloquean nada.

```
C18 ─ C19 ─ C20 ─ C21 ─ C21b ─┬─ C22 ─┐
                              ├─ C23 ─┼─ C28 ─┬─ C29
                              └─ C24 ─┘       └─ C27
```

### ✅ C18 · `feat(domain): modelar ciclo, trimestre y jerarquía de criterios`

Entidades, valores y reglas puras de evaluación, más `db.version(2)`. Es el único
commit de la fase que migra el esquema; hacerlo completo aquí evita una segunda
migración sobre datos reales.

Salió en `domain/entities.ts` (la jerarquía completa), `domain/values.ts`
(`CampoFormativo`, `NIVELES`, `VALOR_NIVEL`), `domain/evaluacion.ts` (las reglas
de estructura) y `data/dexie/db.ts` (`version(2)`).

Sobre la verificación previa que pedía este commit —que `calificaciones` y
`actividades` estuvieran vacías en el iPad— resultó que no hacía falta ir al
dispositivo: **ninguna ruta de código escribió nunca en esas dos tablas.** No
hubo adaptador, puerto ni caso de uso que las tocara, así que están vacías por
construcción. El `upgrade()` las limpia igual y avisa por consola si encuentra
algo.

**Aceptación**
- [x] `Actividad` referencia `criterio_trimestre_id`, nunca `criterio_id`
- [x] `pesosSuman100()` es una función pura y testeable
- [x] Los rangos de trimestres del mismo ciclo no se traslapan
- [x] Toda regla de dominio devuelve `null` sin datos, nunca `0`
- [x] `db.version(2)` abre sobre una base de `version(1)` con datos de asistencia sin perder ninguno
- [x] `domain/` sigue sin importar nada externo y `tests/arquitectura.test.ts` pasa

La migración se ensayó en `src/data/dexie/migracion.test.ts`, que levanta una base
con el esquema viejo y tres días de asistencia de 30 alumnos, la abre con el
esquema nuevo y verifica que no se pierda un registro —ni el conteo ni los estados
capturados— y que el upsert por `[fecha+alumno_id]` siga funcionando después.

### ▶ C19 · `feat(evaluacion): administrar ciclo, trimestres y sus fechas`

Las reglas puras ya están (`trimestreDeFecha`, `traslapes`, `rangoValido`); falta
el puerto, el adaptador y la pantalla.

**Aceptación**
- [ ] Se ve siempre qué trimestre está activo
- [ ] Un registro de asistencia se atribuye a un trimestre por su fecha, sin elección manual
- [ ] Una fecha fuera de todo rango no cuenta para ningún trimestre y no falla
- [ ] No se pueden editar fechas de un trimestre cerrado

### ⬜ C20 · `feat(evaluacion): configurar criterios y pesos por trimestre`

**Aceptación**
- [ ] El total corriente de pesos es visible mientras se edita
- [ ] Se permite guardar con suma distinta de 100; solo se bloquea el cierre
- [ ] Copiar de un trimestre anterior trae criterios, pesos y rúbricas
- [ ] Copiar **no** trae actividades ni calificaciones
- [ ] Cambiar un peso en T2 no altera ninguna calificación de T1

### ⬜ C21 · `feat(evaluacion): editar rúbricas con niveles y descriptores`

**Aceptación**
- [ ] `niveles` y `valores` tienen la misma longitud
- [ ] Cada `RubricaCriterio` tiene un descriptor por nivel
- [ ] Una rúbrica en uso no se puede borrar, solo desactivar

### ⬜ C21b · `feat(evaluacion): crear actividades por campo formativo`

Nombre, campo formativo y ejes articuladores. Sin esto, C22 y C23 no tienen sobre
qué operar.

**Aceptación**
- [ ] Toda actividad se crea dentro de un `CriterioTrimestre`, nunca suelta
- [ ] El campo formativo se elige antes de nombrar la actividad
- [ ] Los ejes articuladores son opcionales
- [ ] No se pueden crear actividades en un trimestre cerrado
- [ ] La lista distingue visualmente las actividades ya calificadas de las que no
- [ ] Borrar una actividad con calificaciones pide confirmación explícita

### ⬜ C22 · `feat(evaluacion): capturar entregas por actividad`

**Aceptación**
- [ ] Al abrir la actividad se escriben los 30 registros de golpe, todos en entregada
- [ ] Al abrir, todos los alumnos aparecen como **entregada**
- [ ] Un toque marca no entregada; el color cambia de inmediato
- [ ] Cada toque guarda; no existe botón de Guardar
- [ ] **Capturar un grupo de 30 con 4 no entregadas toma menos de 15 segundos**

### ⬜ C23 · `feat(evaluacion): calificar con rúbrica, alumno por alumno`

**Aceptación**
- [ ] La lista muestra quién ya está calificado
- [ ] «Siguiente» salta al siguiente alumno **sin calificar**
- [ ] Se puede saltar a cualquier alumno fuera de orden
- [ ] Salir y volver conserva todo lo calificado
- [ ] Cada toque de nivel guarda de inmediato
- [ ] El progreso es visible: «12 de 30»

### ⬜ C24 · `feat(evaluacion): registrar aciertos de examen por campo formativo`

**Aceptación**
- [ ] La captura usa teclado numérico **dentro de la app**, no el nativo
- [ ] Ningún control provoca zoom de Safari
- [ ] No se aceptan aciertos mayores al total de preguntas del campo
- [ ] «Siguiente» avanza al siguiente alumno sin resultado

### ⏸ C25 · `feat(evaluacion): registrar participación` — POSPUESTO

Pospuesto por decisión de la usuaria. Requiere `db.version(3)` con la tabla
`participaciones` y una respuesta a *¿premiar volumen de participación?*.

**Aceptación**
- [ ] Se registra sin salir de la pantalla de asistencia
- [ ] No agrega ningún toque al camino de pasar lista
- [ ] El conteo del trimestre es visible por alumno
- [ ] La normalización usa la meta configurada, no el máximo del grupo

### ⏸ C26 · `feat(evaluacion): calcular criterios automáticos` — POSPUESTO

Pospuesto por decisión de la usuaria: puntualidad, conducta y participación no
entran al alcance actual. Conducta además requiere agregar `signo` a `Nota`.

**Aceptación**
- [ ] Puntualidad, conducta y participación se derivan; no se almacenan
- [ ] El retardo penaliza en puntualidad
- [ ] Solo las notas marcadas como negativas afectan conducta
- [ ] Una nota sin signo explícito no afecta nada

### ⬜ C27 · `feat(evaluacion): cerrar trimestre con snapshot de calificaciones`

**Aceptación**
- [ ] No se puede cerrar si los pesos no suman 100
- [ ] Al cerrar se escribe un `CierreTrimestre` por alumno
- [ ] El snapshot guarda nombres y pesos como texto, no referencias
- [ ] Un trimestre cerrado rechaza toda escritura
- [ ] Renombrar un criterio después no altera el snapshot
- [ ] Reabrir requiere confirmación explícita y queda registrado

### ⬜ C28 · `feat(evaluacion): calcular calificaciones por criterio y campo formativo`

Toda la cadena de cálculo en `domain/rules.ts`, sin acceso a base de datos.

**Aceptación**
- [ ] Los valores intermedios se manejan en base 1; la conversión a base 10 ocurre solo al presentar
- [ ] El general de un criterio es el promedio de **todas** sus actividades, no el promedio de los promedios por campo
- [ ] El general del examen usa aciertos totales sobre preguntas totales
- [ ] Una actividad sin ningún registro se excluye del promedio
- [ ] Una rúbrica con todos los criterios en «Mal» da 0.0
- [ ] Una rúbrica con todos los criterios en «Bien» da 8.3 en base 10
- [ ] El nivel elegido se almacena como índice, no como valor
- [ ] No existe piso de escala: una calificación menor a 5 se muestra tal cual
- [ ] `valorCriterio([])` devuelve `null`, nunca `0`
- [ ] No hay redondeo en ningún paso intermedio
- [ ] La maestra ve base 10 en toda la interfaz; el porcentaje no aparece nunca

### ⬜ C29 · `feat(evaluacion): consultar calificaciones por alumno y campo formativo`

La pantalla donde ella saca los números para la boleta. Cierra la Fase 4.

**Aceptación**
- [ ] Muestra el **desglose por criterio**, no solo la calificación final
- [ ] Muestra por campo formativo y en general, para cada criterio y para el trimestre
- [ ] Todo en base 10; el porcentaje no aparece en ninguna parte de la interfaz
- [ ] Un criterio sin actividades calificadas se muestra como «sin calificar», nunca como 0
- [ ] Se consulta por alumno y por grupo
- [ ] Indica con claridad cuando el trimestre aún está incompleto
- [ ] En un trimestre cerrado, los números vienen del snapshot, no de recalcular

El desglose no es un lujo: cuando un resultado no cuadre con su intuición —y va a
pasar— es lo único que dice si el error está en la fórmula o en la expectativa.
Sin él, el reporte que llega es «está mal» y no hay dónde buscar.
