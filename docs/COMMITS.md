# Commits

## Convención

Conventional Commits, en español, imperativo, sin punto final.

```
<tipo>(<alcance>): <descripción>

[cuerpo opcional]
```

**Tipos:** `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`

**Alcances:** `domain`, `data`, `app`, `ui`, `asistencia`, `calificaciones`,
`bitacora`, `grupo`, `pwa`, `sync`, `evaluacion`

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

### ✅ C12 · `feat(bitacora): registrar reportes por alumno`

Era «anecdotario por alumno» y **cambió de nombre y de significado** (D-020): la
pestaña se llama **Bitácora**, todo lo que se anota ahí es un **reporte** y todos los
reportes son negativos. Ya no es un espacio sin consecuencias: de aquí sale la
calificación de conducta, así que este commit es prerrequisito de `C26`.

Renombra la entidad `Nota` a `Reporte` y la tabla `notas` a `bitacora`. La tabla
nunca tuvo pantalla, así que está vacía en todas partes: es un renombre, no una
migración de datos. Va en `db.version(3)` junto con `participaciones` (C25).

**Aceptación**
- [x] Guardar requiere alumno y texto no vacío
- [x] El historial se ordena por fecha, más reciente primero
- [x] El estado vacío invita a actuar en lugar de solo informar
- [x] El campo de texto tiene al menos 16 px
- [x] La pantalla dice que un reporte **afecta la calificación de conducta**
- [x] El conteo de reportes del trimestre es visible por alumno

Los dos últimos no son adorno. Con toda la bitácora contando para conducta, esconder
la consecuencia haría que ella la descubra en la boleta; y el conteo es lo que
permite ver que un alumno ya va en dos —el umbral donde la conducta cae a la mitad—
antes de escribir el tercero.

Cómo quedó, más allá de la lista:

- **`db.version(3)` completa, no solo la parte de este commit.** Entra `bitacora`,
  entra `participaciones` —vacía hasta `C25`— y `criterios_trimestre` gana
  `retardos_por_falta`. La migración del iPad se hace una vez: partirla en dos
  versiones multiplica las ocasiones de romper la base por una tabla vacía. Con eso,
  `C14` ya puede exportar `TABLAS_SINCRONIZABLES` sin volver a tocarse.
- El `upgrade()` **copia** las filas de `notas` a `bitacora` antes de que Dexie borre
  la tabla vieja. La tabla estaba vacía en el dispositivo, pero una migración que da
  por hecho que no hay nada que migrar es la que pierde datos.
- **Se puede quitar un reporte**, con un segundo toque en el mismo botón. No estaba
  en la lista y se agregó porque un reporte de más **baja una calificación**: sin
  forma de deshacerlo, un toque equivocado se arreglaría editando la base a mano.
- El reporte se anota **con la fecha de hoy**, y solo si hoy cae en el trimestre que
  se está viendo. Escribir un reporte «en T1» desde febrero lo fecharía en febrero y
  desaparecería de la lista en cuanto se guardara: la atribución es por fecha y se
  deriva al leer.
- Es la única pantalla nueva **con botón de Guardar**. Un reporte es un texto que se
  escribe, no un toque que cicla, y guardar a media frase dejaría media frase
  contando para conducta.

### ⬜ C13 · `feat(grupo): mostrar resumen de asistencia y promedio`

El promedio ya no es `promedioDe(calificaciones)`: es el del trimestre activo, así
que la parte de calificaciones de esta pantalla depende de C28. La de asistencia,
no. Si se toma antes, se toma solo con asistencia.

**Aceptación**
- [ ] Los valores coinciden con un conteo manual de la base
- [ ] Sin calificaciones, el promedio muestra `—`, no `0.0`
- [ ] El color de alerta usa el umbral validado con ella

### ✅ C14 · `feat: exportar e importar respaldo en json`

Cubre el riesgo de pérdida de datos antes de que exista el motor de sincronía.
Con la app ya en el iPad y datos reales dentro, era **el commit de mayor valor por
unidad de trabajo que quedaba pendiente**. Se tomó después de `C12`, así que
exporta el esquema definitivo —las dieciséis tablas de `version(3)`— y no hay que
volver a él.

**Aceptación**
- [~] La exportación abre el diálogo de *Guardar en Archivos* en iPad
- [x] Importar en una base vacía reconstruye todo, IDs incluidos
- [x] Importar dos veces el mismo archivo no duplica registros

El primero queda a medias **por falta de dispositivo, no de código**: la
exportación usa `navigator.share({ files })` cuando existe —en iPadOS eso es la
hoja de compartir, con *Guardar en Archivos* dentro— y cae a una descarga por
ancla en el escritorio, que es donde se probó. Falta verlo en el iPad; está anotado
en [PWA-IOS.md](./PWA-IOS.md).

Cómo quedó:

- **El repositorio es quien sabe qué tablas hay.** El puerto declara
  `volcar()`/`restaurar()` sobre un `Record<tabla, filas>` y el adaptador recorre
  `TABLAS_SINCRONIZABLES`: agregar una tabla al esquema la mete al respaldo sin
  tocar el caso de uso. Si hubiera que acordarse de agregarla en dos lugares, el
  respaldo saldría incompleto y nadie lo notaría hasta el día que hiciera falta.
- **El respaldo incluye los registros borrados.** El borrado es suave; un archivo
  que se comiera los `deleted_at` resucitaría al restaurar lo que ella dio de baja.
- **Restaurar es un upsert por `id` en una sola transacción**, así que el mismo
  archivo dos veces no duplica, y **no borra lo que el archivo no trae**: restaurar
  es recuperar, no reemplazar el dispositivo.
- **El archivo lleva la versión del esquema** y uno más nuevo se rechaza con un
  mensaje que se puede leer en pantalla; uno más viejo se acepta, porque le faltan
  campos y eso ya lo sabe manejar la app.
- **Restaurar no encola en la `outbox`**, y es la única excepción a «toda escritura
  encola». No es una mutación del salón: qué hace la sincronía con un dispositivo
  restaurado lo decide `C16`, que tiene su propio «restaurar todo».

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
C28 para escribir el snapshot.

C25, C25b y C26 —los criterios automáticos— estaban pospuestos y **volvieron al
alcance el 2026-08-21 con las reglas de la usuaria** (D-020). Cuelgan de esta fase
pero se toman después de que esté cerrada, y su orden es
`C12 → C25b → C25 → C26`: la configuración antes de la captura, y el cálculo al
final, cuando ya tiene de dónde leer. **`C12` ya está hecho**, y con él
`db.version(3)` completa: `C25b` y `C25` no vuelven a tocar el esquema.

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

### ✅ C19 · `feat(evaluacion): administrar ciclo, trimestres y sus fechas`

El primer vertical de la fase: puerto `evaluacion.ts`, adaptador de Dexie, casos
de uso y dos pantallas —*Ciclo escolar* en Ajustes y la etiqueta permanente en
Asistencia—.

**Aceptación**
- [x] Se ve siempre qué trimestre está activo
- [x] Un registro de asistencia se atribuye a un trimestre por su fecha, sin elección manual
- [x] Una fecha fuera de todo rango no cuenta para ningún trimestre y no falla
- [x] No se pueden editar fechas de un trimestre cerrado

Los cuatro se verificaron en el navegador, además de en Vitest: la etiqueta dice
«Trimestre 1» en un día dentro del rango y «Fuera de los trimestres» en uno de
vacaciones, y con el trimestre 1 cerrado a mano en IndexedDB sus dos campos de
fecha salen deshabilitados mientras los del 2 y el 3 siguen editables.

**Corregido después, en C19b:** abrir el ciclo pedía las fechas de los tres
trimestres. Ahora pide solo la del primero (D-017).

Decisiones que salieron de construirlo:

- **La etiqueta sigue al día seleccionado, no a hoy.** Hojear un día de noviembre
  y ver «Trimestre 1» es lo que hace visible que la atribución es por fecha. Con
  la etiqueta clavada en hoy, la regla quedaría invisible justo cuando importa.
- **Las fechas se capturan con `type="date"`**, que en iPadOS abre el selector y
  no el teclado. Es la misma razón por la que las calificaciones no usan un campo
  numérico, y de paso garantiza el formato.
- **El traslape se marca en las dos filas** y dice con cuál choca, así que
  corregir una apaga las dos marcas. Mismo patrón que el número de lista repetido
  en la carga de la lista (D-014).
- **Un hueco entre trimestres es válido.** No todo día del calendario es día de
  clases, y los días fuera de rango ya tienen una respuesta definida.
- **No se abre un segundo ciclo mientras haya uno en curso**: dos ciclos abiertos
  harían ambigua la atribución de una fecha, que es lo que este commit existe para
  volver inequívoco.

### ✅ C19b · `fix(evaluacion): abrir el ciclo con solo el primer trimestre`

Corrección de alcance salida de usar la pantalla: C19 pedía las fechas de los tres
trimestres para abrir el ciclo, y en agosto solo se sabe la del primero. Decisión y
razones en [DECISIONES.md](./DECISIONES.md) D-017.

**Aceptación**
- [x] El ciclo se abre con las fechas del primer trimestre nada más
- [x] Un ciclo con uno o dos trimestres es un estado válido, no uno a medias
- [x] Los siguientes se abren en orden, después del anterior y sin traslaparse
- [x] Corregir las fechas de los trimestres que ya existen no exige que estén los tres
- [x] Un día capturado antes de abrir su trimestre queda atribuido al abrirlo, sin migrar nada
- [x] La asistencia distingue «fuera de los trimestres» de «el trimestre de este día no se ha abierto»

Se pudo hacer sin migración ni recálculo porque **la atribución no se guarda**: sale
de la fecha al leer. Verificado en el navegador de punta a punta: se abrió un ciclo
con solo el T1, se marcó una falta en un día posterior a su fin —la etiqueta decía
«El trimestre de este día no se ha abierto»—, se abrió el T2 cubriendo ese día, y la
etiqueta pasó a «Trimestre 2» con la falta intacta (29/30).

Salió un defecto de la verificación, ya corregido: al abrir el T2, su fila no
aparecía en la lista de fechas hasta volver a entrar a la pantalla. El formulario se
inicializa una vez y no se resincronizaba; ahora su `key` lleva cuántos trimestres
hay.

### ✅ C20 · `feat(evaluacion): configurar criterios y pesos por trimestre`

Pantalla *Criterios y pesos* en Ajustes, con selector de trimestre. Amplía el
puerto `evaluacion.ts` en vez de abrir uno nuevo: `Rubrica` sin `RubricaCriterio`
no significa nada y una actividad sin sus entregas tampoco, así que el puerto se
corta por caso de uso (docs/ARCHITECTURE.md).

**Aceptación**
- [x] El total corriente de pesos es visible mientras se edita
- [x] Se permite guardar con suma distinta de 100; solo se bloquea el cierre
- [x] Copiar de un trimestre anterior trae criterios y pesos
- [x] Copiar **no** trae actividades ni calificaciones
- [x] Cambiar un peso en T2 no altera ninguna calificación de T1

Los cinco se verificaron en el navegador además de en Vitest: agregar «Tareas» y
«Examen» en T1 con 60/40 lleva el contador a «100 / 100 · El reparto cuadra»,
copiar a T2 trae los dos con sus pesos, y bajar el de T2 a 25 deja T1 intacto en
60. Con T1 cerrado a mano en IndexedDB sus pesos salen deshabilitados, el alta
desaparece y la copia deja de ofrecerse.

Decisiones que salieron de construirlo:

- **No hay botón de guardar.** Cada cambio de peso escribe, como el ciclo de
  estados de asistencia. Un botón de guardar en una pantalla que se abandona a
  medias es una forma de perder el reparto sin avisar.
- **El peso nace en 0**, no en un reparto sugerido: adivinarlo la obligaría a
  corregir una cifra inventada.
- **Sí se guarda un reparto que no suma 100**, y la pantalla lo dice —«Faltan 30
  para cerrar el trimestre»— en lugar de bloquear. Editar pasa siempre por
  estados intermedios inválidos.
- **El catálogo de criterios se reutiliza** entre trimestres, comparando sin
  acentos ni mayúsculas: «Tareas» tiene que ser el mismo criterio en los tres para
  que copiar el esquema y comparar entre periodos signifiquen algo. Las filas de
  `CriterioTrimestre`, en cambio, son siempre nuevas, y es eso lo que aísla los
  pesos.

El criterio de aceptación original decía «copiar trae criterios, pesos **y
rúbricas**». Dejó de aplicar: la rúbrica se movió a la actividad (D-016), así que
no hay rúbrica en este nivel que copiar. Lo que se copia sigue siendo lo mismo,
menos ese campo.
- **Quitar un criterio no toca el catálogo**, solo la fila del trimestre.
- **La pantalla no ofrece `personalizado` ni los `auto_*`.** Un tipo sin forma de
  captura definida la llevaría a crear un criterio que después no tiene pantalla
  donde llenarse.
- **Aquí sí hay selector de trimestre**, a diferencia de la asistencia: configurar
  el trimestre que viene mientras corre el actual es justo lo que necesita poder
  hacer. Arranca en el trimestre de hoy.

### ✅ C21 · `feat(evaluacion): editar rúbricas con niveles y descriptores`

Pantalla *Rúbricas* en Ajustes, más el selector de rúbrica en cada criterio
entregable de *Criterios y pesos*. Lo segundo no estaba en los criterios de
aceptación pero sí en el commit: una rúbrica que no se le puede asignar a nada es
dato huérfano, y C23 no tendría de dónde leer con qué calificar.

**Corregido después, en C21c:** el selector estaba en el nivel equivocado. La
rúbrica cuelga de la **actividad**, no del criterio (D-016), así que ese selector se
retiró y la asignación llega en C21b.

**Aceptación**
- [x] `niveles` y `valores` tienen la misma longitud
- [x] Cada `RubricaCriterio` tiene un descriptor por nivel
- [x] Una rúbrica en uso no se puede borrar, solo desactivar

El primero ya lo cubría `src/domain/values.test.ts` desde C18, junto con que
`NIVEL_MAXIMO` sea el valor del mejor nivel —si se desalinean, una rúbrica
califica con el valor del nivel de al lado—.

Verificado en el navegador: con tres de los cuatro descriptores llenos, el renglón
se marca y dice **«Falta el descriptor de Bien, Mal»** —cuáles, no cuántos— y
guardar sigue bloqueado. Asignada a «Tareas», la rúbrica pasa a «1 renglón · en
uso» y su botón de borrar queda deshabilitado mientras *Desactivar* sigue
disponible. Desactivada, el criterio la sigue mostrando marcada «(desactivada)»,
porque la fila no debe mentir sobre cómo se está calificando.

Decisiones que salieron de construirlo:

- **`Rubrica.activa` es un campo nuevo**, aparte de `deleted_at`. Desactivar y
  borrar no son lo mismo: la desactivada sigue resolviendo lo ya calificado, la
  borrada no existía para nadie. Cabe sin migración porque la tabla estaba vacía.
- **Editar una rúbrica conserva el `id` de sus renglones.** Es la clave de
  `EvaluacionRubrica.niveles`: recrearlos dejaría huérfano todo lo ya calificado.
  Hoy no hay nada calificado, pero un diseño que solo funciona mientras la base
  esté vacía es una trampa puesta a plazo.
- **Una rúbrica nueva arranca con un solo renglón**, no con cuatro en blanco:
  cuatro campos vacíos parecen una obligación, uno parece un ejemplo.
- **Solo los criterios `entregable` ofrecen rúbrica.** Un examen se califica con
  aciertos por campo formativo y una rúbrica ahí no tendría dónde aplicarse. Sigue
  valiendo con la rúbrica en la actividad: se pregunta por el tipo del criterio del
  que la actividad cuelga.
- **Sin rúbrica no es un estado incompleto**, es un modo: para las tareas del día,
  palomear entregada / no entregada es exactamente lo que ella quiere.
- **El editor marca al primer cambio, no al abrir.** Una rúbrica recién abierta con
  todo en rojo regaña antes de que ella haya hecho nada.

### ✅ C21c · `fix(evaluacion): mover la rubrica del criterio a la actividad`

Corrección de modelo salida de revisar C21, antes de que existieran actividades.
Decisión y razones en [DECISIONES.md](./DECISIONES.md) D-016.

`rubrica_id` sale de `CriterioTrimestre` y entra en `Actividad`. Un criterio tiene
muchas actividades y una actividad tiene una rúbrica; con la rúbrica en el criterio,
cambiarla a mitad del trimestre dejaba las `EvaluacionRubrica` ya capturadas
apuntando a renglones de la rúbrica vieja, y una calificación ya dada desaparecía
sin avisar.

**Aceptación**
- [x] `Actividad` declara `rubrica_id`; `CriterioTrimestre` ya no
- [x] `enUso` de una rúbrica se mide por las actividades que la referencian, no por los criterios
- [x] Una actividad sin rúbrica no marca ninguna en uso: `null` es captura binaria, no un hueco
- [x] Copiar el esquema de un trimestre no arrastra rúbricas
- [x] No hizo falta versión nueva del esquema: `rubrica_id` nunca estuvo indexado

Sin migración: la base no tenía una sola actividad. El selector de *Criterios y
pesos* se retiró y la asignación llega en C21b, así que **por ahora «una rúbrica en
uso no se puede borrar» solo se verifica en Vitest**: no hay camino en la interfaz
para dejar una rúbrica en uso.

### ✅ C21b · `feat(evaluacion): crear actividades por campo formativo`

Nombre, campo formativo y ejes articuladores. Sin esto, C22 y C23 no tienen sobre
qué operar.

Es la primera pantalla de evaluación que vive **fuera de Ajustes**: la pestaña
Calificaciones deja de ser un placeholder. Crear una actividad pasa varias veces por
semana, no tres veces al año.

**Aceptación**
- [x] Toda actividad se crea dentro de un `CriterioTrimestre`, nunca suelta
- [x] El campo formativo se elige antes de nombrar la actividad
- [x] Los ejes articuladores son opcionales
- [x] Con qué se califica se elige en la actividad: una rúbrica activa, o entregada / no entregada
- [x] La rúbrica llega precargada con la de la actividad anterior del mismo criterio
- [x] Cambiar la rúbrica de una actividad ya calificada avisa de lo que se pierde
- [x] No se pueden crear actividades en un trimestre cerrado
- [x] La lista distingue visualmente las actividades ya calificadas de las que no
- [x] Borrar una actividad con calificaciones pide confirmación explícita

Verificado en el navegador: el nombre está deshabilitado con el texto «Elige antes
el campo formativo» hasta tocar un campo; la segunda actividad del criterio llega
con la rúbrica de la primera y lo dice; cambiar la rúbrica de una actividad con 4
registros avisa **con la cifra** antes de guardar y pide confirmación aparte;
borrarla nombra la actividad y sus registros; y con el trimestre cerrado el botón de
nueva actividad desaparece.

Decisiones que salieron de construirlo:

- **El campo formativo bloquea el nombre.** Es la agrupación con la que ella
  reporta; puesto al final se queda en el que venía por omisión y el reporte por
  campo deja de significar algo. Es el único orden que la pantalla impone.
- **Cero registros es «sin calificar», y se ve.** Barra azul si está calificada,
  hueca si no —la misma distinción que el calendario de asistencia hace entre un día
  capturado y uno sin pasar—. Pintarlas igual sería mentir, y además una actividad
  sin registros se excluye del promedio.
- **Cambiar con qué se califica descarta la captura de esa actividad**, y hay que
  confirmarlo. No es una precaución: `EvaluacionRubrica.niveles` está indexado por
  los renglones de la rúbrica anterior, así que conservarlos dejaría una
  calificación que ya no significa nada. Renombrar o mover la fecha no tira nada.
- **El examen no aparece en esta pantalla.** Se captura por aciertos sobre el
  `CriterioTrimestre` (C24), no por actividades, y mostrarlo vacío invitaría a
  crearle actividades que no van a ningún lado.
- **Los siete ejes se ofrecen como lista**, no como texto libre: teclear en el iPad
  es lo que se evita. Se guardan como `string[]`, así que corregir la lista no
  migra nada.

### ✅ C22 · `feat(evaluacion): capturar entregas por actividad`

La captura binaria: entregada o no entregada. La de rúbrica es C23.

**Aceptación**
- [x] Al abrir la actividad se escriben los 30 registros de golpe, todos en entregada
- [x] Al abrir, todos los alumnos aparecen como **entregada**
- [x] Un toque marca no entregada; el color cambia de inmediato
- [x] Cada toque guarda; no existe botón de Guardar
- [~] **Capturar un grupo de 30 con 4 no entregadas toma menos de 15 segundos**

El último queda **medido a medias, a propósito**: en el navegador, abrir y tocar a
los cuatro que no entregaron cuesta 73 ms desde el primer toque hasta ver los cuatro
en rojo, contando el viaje a IndexedDB y el repintado. Eso mide la parte de la app;
la parte de ella —encontrar cuatro nombres en una lista de 30— solo se mide con el
iPad en la mano y un cronómetro. **Pendiente de confirmar en el dispositivo**, como
se hizo con C8.

Verificado en el navegador: al abrir, los 30 salen entregada y el contador dice
30 / 30; cuatro toques lo dejan en 26 / 30 con «4 sin entregar»; recargar conserva
exactamente esos cuatro; y no existe ningún botón de Guardar en la pantalla.

Decisiones que salieron de construirlo:

- **La fila de la actividad lleva a capturar, no a editar.** Capturar es lo que se
  hace todos los días; editar la actividad es un toque más desde ahí. Las de rúbrica
  siguen llevando a la forma hasta que exista su captura (C23).
- **La captura vive en `application/entregas.ts`**, no en `evaluacion.ts`. Es camino
  de captura, se mide con cronómetro y no comparte nada con configurar un ciclo —el
  mismo criterio por el que `asistencia.ts` vive aparte—.
- **El toque no lee la base.** `alternarEntrega` recibe el estado que la pantalla ya
  tiene por suscripción; un viaje extra por toque es justo lo que el presupuesto no
  paga.
- **Materializar es idempotente y no revierte.** Abrir dos veces no duplica, y si la
  lista creció, completa a los nuevos sin recrear a los que ya estaban.
- **En un trimestre cerrado, abrir no escribe** —consultar una actividad vieja es
  legítimo— pero tocar sí falla, y las filas salen deshabilitadas.

La fila muestra **con qué se califica**, por nombre de rúbrica o «entregada / no
entregada». Sin eso hay que abrir la actividad para saber qué pantalla te va a
tocar.

### ✅ C23 · `feat(evaluacion): calificar con rúbrica, alumno por alumno`

**Aceptación**
- [x] La lista muestra quién ya está calificado
- [x] «Siguiente» salta al siguiente alumno **sin calificar**
- [x] Se puede saltar a cualquier alumno fuera de orden
- [x] Salir y volver conserva todo lo calificado
- [x] Cada toque de nivel guarda de inmediato
- [x] El progreso es visible: «12 de 30»

Verificado en el navegador con una rúbrica de dos renglones —y luego con un tercero
de descriptores largos, para ver el ajuste de las columnas—: los cuatro niveles
salen con su descriptor; tocar uno marca el botón y sube el contador en el acto;
calificar los dos renglones deja al alumno como «Calificado» y el contador en
«1 de 30»; «Siguiente sin calificar» pasa del alumno 1 al 2 y del 2 al 3 aunque el
2 quedara a medias; tocar la fila del 30 entra fuera de orden; y recargar conserva
al 1 calificado y al 2 en «1 de 2 renglones».

Decisiones que salieron de construirlo:

- **Abrir no materializa nada**, al revés de C22. Allá el valor por omisión es el
  probable —casi todos entregan— y escribir los 30 hace que «cero registros ⇒ sin
  calificar» sea inequívoco. Aquí ningún nivel es el probable: 30 registros vacíos
  dejarían la actividad contando 30 capturas sin un solo toque. El registro nace
  con el primer nivel elegido.
- **Calificado es tener nivel en todos los renglones.** Un alumno a medias cuenta
  como pendiente y no entra en el «12 de 30»: su promedio saldría de menos
  renglones que el de los demás. La regla es `nivelesCompletos` y vive en
  `domain/`, no en la pantalla.
- **«Siguiente» da la vuelta.** Ella no recorre el grupo en un solo pase —se salta
  a quien no trajo el trabajo, atiende la puerta, vuelve— así que «siguiente»
  significa «el que falta», no «el que sigue en la lista». Y **avanza**: si el
  actual es el que falta, no se queda ahí.
- **La rúbrica se captura en tabla: renglones en filas, niveles en columnas.** Es
  la forma en que la rúbrica está en el papel, y deja los cuatro descriptores de un
  renglón a la vista al mismo tiempo, que es lo que hace comparable «Bien» con
  «Regular» sin ir y venir por la pantalla. `table-fixed` para que un descriptor
  largo no angoste las otras tres columnas, y la tabla scrollea dentro de su propio
  contenedor —no la página— cuando no cabe.
- **`calificarRenglon` escribe un renglón y conserva los demás.** El puerto no
  recibe el mapa completo: recibirlo haría que dos toques rápidos se pisaran el
  mapa que cada uno tenía en la mano.
- **La captura vive en `application/calificacion.ts`**, aparte de `entregas.ts`.
  Los dos son camino de captura, pero no comparten nada: allá una fila es un
  toque, aquí un alumno son tantos toques como renglones.
- El hook devuelve las dos listas **en crudo** y la pantalla las cruza. Cruzarlas
  necesita los renglones de la rúbrica, que salen del selector de la actividad y
  no de la suscripción.

### ✅ C24 · `feat(evaluacion): registrar aciertos de examen por campo formativo`

Se desbloqueó preguntando: **hay un examen por trimestre** y cuelga del
`CriterioTrimestre` (docs/DECISIONES.md D-018). También quedó decidido el redondeo
al presentar —un decimal—, que es de C28.

**Aceptación**
- [x] La captura usa teclado numérico **dentro de la app**, no el nativo
- [x] Ningún control provoca zoom de Safari
- [x] No se aceptan aciertos mayores al total de preguntas del campo
- [x] «Siguiente» avanza al siguiente alumno sin resultado

Verificado en el navegador: la sección del examen aparece con «sin preguntas» y
lleva a decirlas; se teclean 20 de Lenguajes y 15 de Saberes con el teclado de la
app y al guardar la pantalla pasa a la captura; en Bruno, teclear 1 y 9 deja 19 y
el siguiente dígito **no entra** —195 no cabe en 20—; borrar deja el campo sin
capturar y el contador vuelve a «0 de 30»; «Siguiente sin resultado» pasa al 2;
recargar conserva a Bruno con resultado. Medido en la misma pantalla: los 33
objetivos táctiles miden 44 px o más, la letra de todos es de 16 px, y no existe
ni un `input`, `textarea` o `select` —que es la forma dura de garantizar que Safari
no haga zoom ni levante el teclado nativo—.

Decisiones que salieron de construirlo:

- **El teclado es un componente que no escribe en ningún `input`.** Emite el
  dígito y quien lo usa decide qué hacer con él. Por eso sirve igual para decir
  cuántas preguntas trae el examen y para capturar aciertos, que escriben en
  lugares distintos —estado local y base de datos—.
- **El dígito que no cabe no entra.** `conDigito` devuelve `null` y el toque no
  escribe nada, en vez de guardar y mostrar un error. Con teclado en pantalla, un
  dígito rechazado se siente como no haberlo tocado; un error que hay que leer y
  descartar cuesta bastante más.
- **Decir las preguntas sí tiene botón de Guardar; capturar no.** Es la única
  pantalla de evaluación donde conviven las dos reglas, y la diferencia es la
  frecuencia: los totales se ponen una vez por trimestre y a medio teclear no
  deben quedar guardados; los aciertos se capturan treinta veces seguidas.
- **Bajar un total no borra lo capturado, pero no puede dejarlo fuera de rango.**
  Corregir «20» por «18» es normal —el examen traía otra cantidad—. Si alguien ya
  tenía 19, se rechaza y se dice por qué: conservarlo sería guardar una
  calificación imposible.
- **Cero aciertos es un dato, no una ausencia.** Por eso la caja vacía dice «—» y
  no «0», y borrar la última cifra deja el campo *sin capturar* en vez de en cero.
  El promedio los distingue: un campo sin capturar deja al alumno incomparable, un
  cero lo califica.
- **`registrarAciertos` escribe un campo y conserva los demás**, igual que
  `calificarRenglon` con su renglón. Y `siguienteSinCapturar` vive en `domain/`,
  compartido con la captura de rúbrica: es el mismo recorrido, no dos parecidos.

### ✅ C25 · `feat(evaluacion): registrar participación desde la asistencia`

**Ya no está pospuesto** (D-020). Se marca con un **modo**: un interruptor en la
pantalla de asistencia que cambia lo que hace el toque —prendido, tocar a un alumno
le suma una participación del día en vez de ciclar su asistencia—.

Necesita `db.version(3)` con la tabla `participaciones` (`[fecha+alumno_id]`,
contador `cantidad`), que sale junto con el renombre de la bitácora de `C12`.

Un modo es lo correcto aquí —la participación ocurre en rondas, no de una en una— y
lo que cuesta es que el mismo gesto signifique dos cosas. Eso se paga con las tres
cosas de la lista de abajo; sin ellas, un modo olvidado ensucia datos en silencio.

**Aceptación**
- [x] Se registra sin salir de la pantalla de asistencia
- [x] No agrega ningún toque al camino de pasar lista
- [x] El conteo del trimestre es visible por alumno
- [~] La normalización usa la meta configurada, no el máximo del grupo
- [x] Con el modo prendido, **la pantalla se ve distinta** y el contador cambia de
      significado: es imposible confundirla con la de pasar lista
- [x] El modo **se apaga solo** al salir de la pantalla y al cambiar de día
- [x] **Se puede deshacer** sin salir del modo: sostener el dedo resta una
- [x] Con el modo prendido, un toque **nunca** cambia la asistencia

La normalización queda a medias porque **la fórmula es de `C26`**: lo que existe aquí
es que la meta se lee del criterio del trimestre y se ve en cada fila —«3 de 5»—, así
que la pantalla ya no depende del máximo del grupo. El `mín(participaciones ÷ meta,
1)` es el commit siguiente, donde se repite este criterio.

Cómo quedó:

- **El modo se guarda como el día en que se prendió**, no como un booleano. Está
  prendido solo si ese día sigue siendo el que se ve, así que cambiar de día lo apaga
  sin un efecto que lo apague, y salir de la pantalla lo apaga porque es estado
  local.
- **Con el modo apagado no hay ni una suscripción de participaciones abierta**: el
  bloque del modo monta sus propios hooks al encenderse. Quien pasa lista y se va no
  paga nada.
- **La pantalla cambia de color, no de sitio.** Barras verdes en vez de azules, un
  aviso arriba y el contador grande contando participaciones del día —con «de cuántos
  alumnos» debajo, porque doce participaciones de tres alumnos es justo lo que el
  criterio existe para hacer visible—.
- **Sostener el dedo resta una**, con 500 ms y cancelando el `click` que llega
  después. Es la única pulsación larga de la app, así que el aviso del modo lo dice.
- **Es un contador y no una fila por marca**: tres toques son una fila con
  `cantidad: 3` y una sola entrada en la `outbox`. Restar nunca baja de cero, restar
  donde no hay nada no escribe, y deshacer deja la fila en cero en vez de borrarla.
- **Marcar no revisa si el trimestre está cerrado**, igual que la asistencia: la
  captura diaria no pregunta por trimestres y un trimestre cerrado lee su snapshot,
  así que no puede cambiar una calificación reportada.
- Si el trimestre no tiene el criterio de Participación —o no tiene meta—, el aviso
  lo dice y se marca igual: la atribución se deriva al leer, así que el criterio se
  puede agregar después y las marcas ya cuentan.

### ✅ C25b · `feat(evaluacion): configurar los criterios automáticos`

Los tres criterios automáticos entran al selector de *Criterios y pesos* con sus
parámetros. Sin esto, `C26` no tiene de dónde leer cuántos retardos hacen una falta
ni cuál es la meta de participación.

`retardos_por_falta` es un campo nuevo de `criterios_trimestre`; `meta_participacion`
ya existía desde C18 y por fin se usa. Ninguno es índice, así que no cuestan
migración.

**Aceptación**
- [x] Los tres tipos automáticos se pueden agregar al trimestre y quitar
- [x] Cada uno aparece **a lo más una vez** por trimestre
- [x] Puntualidad pide cuántos retardos hacen una falta, y admite «no cuentan»
- [x] Participación pide su meta, que **nace en 5**; una meta en 0 no se acepta
- [x] Conducta no pide nada: su escala es fija (0-1 → 10, 2 → 5, 3+ → 0)
- [x] La pantalla dice de dónde sale cada uno —asistencia, bitácora,
      participaciones— sin obligar a abrir otra pantalla para entenderlo
- [x] Cambiar un parámetro **no** toca nada capturado: los tres se derivan

Cómo quedó:

- **Los parámetros van debajo de la fila del criterio**, en *Criterios y pesos*, no
  en una pantalla aparte: son dos datos, y mandarla a otro lado para poner un número
  sería cobrarle un viaje por criterio.
- **Puntualidad se elige con botones** —*No cuentan · 1 · 2 · 3 · 4*— y no con un
  campo de texto: son cinco opciones, se leen sin teclado y `1` es válido a
  propósito, porque «un retardo es una falta» es la política de algunas escuelas.
- **Puntualidad nace en «no cuentan»**, no en 3. La convención de tres retardos por
  falta no está validada con nadie, y entre las dos formas de equivocarse, la que no
  castiga a un alumno sin que ella lo haya pedido es esta.
- **Participación nace con la meta en 5** —eso sí está validado (D-021)— y el campo
  no acepta 0: sería dividir entre cero. Sin meta, la fila lo dice en rojo: *la
  participación no califica*.
- **Los dos parámetros se escriben leyendo la fila completa**, así que fijar la meta
  no apaga la conversión de retardos ni al revés. Copiar el esquema al trimestre
  siguiente se los lleva.
- **El repetido se rechaza por tipo, no por nombre**: «Puntualidad» y «Asistencia
  puntual» serían el mismo cálculo dos veces.
- Ojo con lo que **todavía no pasa**: los tres siguen calificando `null` hasta `C26`,
  así que aparecen en el reparto con su peso y el reporte los excluye del promedio,
  igual que un criterio sin captura (D-019). El cálculo es el commit siguiente.

### ✅ C26 · `feat(evaluacion): calcular puntualidad, conducta y participación`

Las tres fórmulas en `domain/calculo.ts` y su composición en
`application/calificaciones.ts`, que hoy devuelve `null` para todo criterio
`auto_*`. Con esto los tres entran solos al reporte de C29 y al snapshot de C27, sin
tocar ninguna de las dos pantallas.

Depende de `C12` (bitácora), `C25` (participaciones) y `C25b` (parámetros).

**Aceptación**
- [x] Puntualidad, conducta y participación se derivan; no se almacenan
- [x] Los retardos se convierten en faltas según `retardos_por_falta`, y con `null`
      un retardo no penaliza
- [x] `justificada` no penaliza nunca
- [x] Conducta: 0 o 1 reportes → 10.0, 2 → 5.0, 3 o más → 0.0
- [x] **Conducta sin reportes vale 10, no `—`**: no tener reportes es el dato
- [x] Puntualidad sin días capturados vale `—`, no 0
- [x] Participación es **proporcional con tope**: `mín(participaciones ÷ meta, 1)`,
      así que con la meta en 5 una participación vale 2.0 y cinco o más valen 10.0
- [x] Sin una sola participación en el trimestre, el criterio vale `—` para todos;
      con marcas de alguien, quien no tiene ninguna saca 0.0
- [x] Los tres cuentan para el general del trimestre y **no** para ningún campo
      formativo
- [x] Los reportes y las participaciones se atribuyen al trimestre **por fecha**,
      derivado al leer

Cómo quedó:

- **Las tres fórmulas en `domain/calculo.ts`**, puras y con todo lo que necesitan
  como argumento. `valorParticipacion` recibe también el total del grupo, porque de
  ahí sale la única de las tres reglas que depende del grupo: sin una sola
  participación de nadie, el criterio no se usó.
- **La lectura entró en `CapturasDelTrimestre`**, que ahora trae asistencia,
  bitácora y participaciones recortadas por las fechas del trimestre. Va en la misma
  lectura y no por su cuenta para que `liveQuery` vuelva a emitir cuando se marca una
  falta o se anota un reporte: el reporte del trimestre se recalcula solo, sin que
  C29 se suscriba a nada nuevo.
- **Ninguna de las dos pantallas se tocó.** C29 y el cierre de C27 los recogieron
  solos, que era la prueba de que la composición estaba en el lugar correcto.
- Y la consecuencia que había que mirar antes de darla por buena, confirmada: con
  conducta configurada, **todo el grupo tiene 10.0 desde el primer día** y el
  trimestre pesa 100 aunque no haya una sola actividad capturada. Es correcto —no
  tener reportes es el dato— y hace que el aviso de «sobre cuánto» de C29 pase de
  útil a indispensable.

Una consecuencia que conviene mirar en la pantalla antes de darla por buena: con
conducta configurada, **todo el grupo tiene calificación desde el primer día** —10.0
de conducta— así que el reporte del trimestre dejará de mostrar `—` y empezará a
mostrar «10.0 sobre 15». Es correcto, pero es justo el caso donde el aviso de «sobre
cuánto» de C29 pasa de ser útil a ser indispensable.

### ✅ C27 · `feat(evaluacion): cerrar trimestre con snapshot de calificaciones`

**Aceptación**
- [x] No se puede cerrar si los pesos no suman 100
- [x] Al cerrar se escribe un `CierreTrimestre` por alumno
- [x] El snapshot guarda nombres y pesos como texto, no referencias
- [x] Un trimestre cerrado rechaza toda escritura
- [x] Renombrar un criterio después no altera el snapshot
- [x] Reabrir requiere confirmación explícita y queda registrado

Verificado en el navegador con el grupo de ejemplo: con 70 / 100 el botón de cerrar
está deshabilitado y dice por qué; al cuadrar los pesos, cerrar avisa que **29 de 30
alumnos se cerrarían sin calificación** y pide confirmar; al confirmar se escriben
los 30 cierres y el trimestre queda cerrado con su `cerrado_en`. El snapshot del
alumno con captura completa guardó `Entregables 40%` en 0.889 y `Examen 60%` en
0.771 —con su desglose por campo— y un final de 0.818, o **8.2** en base 10. Con el
trimestre cerrado desaparecen «Nueva actividad», «Preguntas» y «Siguiente», y las
once teclas del teclado del examen salen deshabilitadas; las filas siguen entrando,
porque consultar es legítimo. Reabrir pide confirmación aparte, deja los 30 cierres
borrados en suave y **conserva `cerrado_en`**.

Decisiones que salieron de construirlo:

- **El cierre vive en *Criterios y pesos*.** Es la única pantalla donde la cifra de
  los 100 está a la vista, y cerrar desde otro lado obligaría a explicar de nuevo
  por qué no se puede.
- **Cerrar es calcular y guardar el resultado**, así que vive en el mismo archivo
  que lee las calificaciones (`application/calificaciones.ts`). Ahí está también la
  regla de que **un trimestre cerrado no se recalcula**: sus números salen del
  snapshot, en un solo lugar, para que ninguna pantalla pueda saltárselo por
  descuido.
- **`capturasDelTrimestre` es la única lectura del puerto que devuelve datos en
  crudo.** Calcular una calificación necesita todo junto y el cálculo vive en
  `domain/`, que no sabe leer; resolverlo en el adaptador lo obligaría a importar la
  cadena de cálculo, y pedirlo por partes serían decenas de consultas por pantalla.
- **Un criterio sin calificación se guarda en el snapshot, con su peso y en `null`.**
  Sacarlo dejaría un hueco imposible de distinguir de un criterio que nunca existió.
  Por lo mismo `final` es `number | null`: un alumno que llegó la última semana se
  cierra sin calificación, y eso es un dato.
- **El desglose por campo formativo va en el snapshot.** Es la agrupación con la que
  ella reporta; recalcularlo sería justamente lo que el snapshot existe para no
  tener que hacer.
- **Reabrir borra el snapshot y conserva `cerrado_en`.** Con el trimestre abierto las
  calificaciones vuelven a calcularse, y dejar los cierres vivos dejaría dos
  verdades a la vez. `cerrado_en` con `estado: 'abierto'` es la huella de que estuvo
  cerrado: es lo único que registra la reapertura mientras no exista una bitácora.
  Volver a cerrar reescribe el mismo snapshot por alumno en vez de duplicarlo.

### ✅ C28 · `feat(evaluacion): calcular calificaciones por criterio y campo formativo`

Toda la cadena de cálculo, sin acceso a base de datos. **Vive en
`domain/calculo.ts`, no en `rules.ts`** como decía este plan: `rules.ts` es de
asistencia y `evaluacion.ts` es la estructura de la evaluación —qué trimestre le
toca a una fecha, si los pesos cierran—. Los números son una tercera cosa, se
cambian por razones distintas y se leen en momentos distintos.

**Aceptación**
- [x] Los valores intermedios se manejan en base 1; la conversión a base 10 ocurre solo al presentar
- [x] El general de un criterio es el promedio de **todas** sus actividades, no el promedio de los promedios por campo
- [x] El general del examen usa aciertos totales sobre preguntas totales
- [x] Una actividad sin ningún registro se excluye del promedio
- [x] Una rúbrica con todos los criterios en «Mal» da 0.0
- [x] Una rúbrica con todos los criterios en «Bien» da 8.3 en base 10
- [x] El nivel elegido se almacena como índice, no como valor
- [x] No existe piso de escala: una calificación menor a 5 se muestra tal cual
- [x] `valorCriterio([])` devuelve `null`, nunca `0`
- [x] No hay redondeo en ningún paso intermedio
- [x] La maestra ve base 10 en toda la interfaz; el porcentaje no aparece nunca

Este commit **no cambia nada de la interfaz**: es dominio puro, y lo que lo verifica
son sus 41 pruebas, no el navegador. La pantalla que muestra estos números es C29.
Entre ellas está el ejemplo trabajado de `docs/DATA-MODEL.md` —dos actividades de
Lenguajes y una de Saberes con rúbrica— que da 5.0, 8.3 y **6.1** de general, con
una prueba aparte que comprueba que el promedio de los promedios (6.7) *no* es lo
que devuelve.

El último criterio se cumple por construcción: la única función que produce texto
es `comoCalificacion`, que da base 10 con un decimal o `—`. No hay ninguna que
devuelva porcentaje.

Decisiones que salieron de construirlo:

- **Lo que no está capturado no vale cero: se excluye** (D-019). Una captura
  incompleta —tres de cuatro renglones, o un campo del examen sin cifra— devuelve
  `null` y el alumno queda fuera de esa actividad, igual que una actividad sin
  registros queda fuera del promedio. Promediar lo que hubiera daría un número que
  se ve final sacado de menos evidencia que el de los demás.
- **El trimestre se normaliza sobre los pesos que sí aportan** (D-019), y devuelve
  `pesoConsiderado` junto al valor. Sin normalizar, a mitad del trimestre un alumno
  con todo perfecto en Tareas (40%) saldría en 4.0. Con normalización sale 10.0,
  que es cierto pero incompleto, así que la cifra no viaja sola: C29 tiene que
  decir sobre cuánto está calculando.
- **`comoCalificacion` es el único lugar que redondea.** Por eso es el único que
  puede hacerlo sin acumular error, y por eso devuelve texto: una función que
  devolviera `number` redondeado invitaría a seguir calculando con él.
- **`null` y `0` no se mezclan nunca.** `promedioDe` ya lo hacía para asistencia;
  aquí la regla se repite en cada nivel de la cadena, y cada función dice en su
  documentación por qué su `null` no es un cero.

### ✅ C29 · `feat(evaluacion): consultar calificaciones por alumno y campo formativo`

La pantalla donde ella saca los números para la boleta. Cierra la Fase 4.

**Aceptación**
- [x] Muestra el **desglose por criterio**, no solo la calificación final
- [x] Muestra por campo formativo y en general, para cada criterio y para el trimestre
- [x] Todo en base 10; el porcentaje no aparece en ninguna parte de la interfaz
- [x] Un criterio sin actividades calificadas se muestra como «sin calificar», nunca como 0
- [x] Se consulta por alumno y por grupo
- [x] Indica con claridad cuando el trimestre aún está incompleto
- [x] En un trimestre cerrado, los números vienen del snapshot, no de recalcular

Verificado en el navegador con tres alumnos en tres estados distintos —uno con todo
capturado, uno con el examen a la mitad y uno con la rúbrica a medias—: la tabla del
grupo da 8.2, 6.4 y `—`, y las cifras cuadran a mano (Camila: Entregables 8.3 con
todo en Bien, examen 18 de 35 = 5.1, y 8.3 × 40 + 5.1 × 60 = **6.4**). En su
desglose, *Lenguajes* sale 5.0 y no 3.0 porque solo el examen evaluó ese campo y la
normalización es por columna. El alumno a medias dice «Sin calificar» en rojo, no un
cero.

El último criterio se verificó **de la forma dura**: se cerró el trimestre con un
snapshot que dice a propósito algo distinto de lo capturado —7.0 y un criterio
renombrado «Entregables de septiembre»— y la pantalla mostró 7.0 y ese nombre, no el
8.2 que daría recalcular ni el nombre vivo. También cambia el aviso de arriba: «son
las del corte» en vez de «se recalculan con cada captura».

Decisiones que salieron de construirlo:

- **`armarReporte` es la única función que decide entre snapshot y cálculo**, y por
  eso es pura: la usan la lectura de una vez y el hook reactivo. Con la decisión
  repetida en dos lados, cualquier pantalla podría recalcular un trimestre cerrado
  por descuido, y ese descuido cambia una calificación ya reportada.
- **Dos desgloses del grupo, no uno.** «Por campo formativo» es lo que se
  transcribe a la boleta; «por criterio» es lo que contesta «¿por qué salió esto?».
  Son la misma tabla con otras columnas, y elegir cuesta un toque.
- **La consulta se entra desde el final de la lista de captura**, no desde arriba:
  lo que se abre todos los días es qué falta calificar; los números se consultan al
  cortar el trimestre.
- **Un campo que nadie evaluó no tiene columna.** Una columna entera de `—` invita a
  buscar un dato que no existe.
- **El aviso de «sobre cuánto» va por alumno y también arriba.** Debajo de cada
  final aparece «sobre 40» cuando falta capturar, porque el pesoConsiderado es de
  cada alumno, no del grupo: uno puede tener el examen capturado y otro no.
- El único `%` de la pantalla es el **peso** de un criterio en el desglose del
  alumno, que es lo que permite reconstruir la cuenta a mano. La tabla del grupo no
  tiene ninguno.

El desglose no es un lujo: cuando un resultado no cuadre con su intuición —y va a
pasar— es lo único que dice si el error está en la fórmula o en la expectativa.
Sin él, el reporte que llega es «está mal» y no hay dónde buscar.

---

## Fase 6 — Herramientas de aula

Dos funciones que no son evaluación pero viven pegadas a ella: sortear quién
participa y formar equipos. Salieron de la usuaria el 2026-08-21
(docs/DECISIONES.md D-021).

Las dos son de **uso en clase, con los niños enfrente**, y eso manda en el diseño más
que en cualquier otra pantalla: se usan de pie, se proyectan o se muestran, y una
espera de tres segundos con treinta niños mirando no es lo mismo que una espera de
tres segundos en una pantalla de configuración.

`C30` necesita `C25` —escribe en `participaciones`—. `C31` no depende de nada.

### ✅ C30 · `feat(asistencia): sortear quién participa`

La ruleta, en la pantalla de asistencia, junto al modo de participación: es donde
está la lista y donde ya se sabe quién vino.

**Aceptación**
- [x] Sortea solo entre los presentes, y presente es `presente` o `retardo`
- [x] **No registra nada por sí solo**: sale un nombre y ella dice si participó
- [x] «Participó» suma una participación del día; «no participó» no escribe nada
- [x] Se puede volver a sortear sin cerrar nada
- [x] Pondera a favor de quien menos ha participado en el trimestre, con azar en los
      empates, y **dice que lo hace**
- [x] La animación **se puede saltar** y no pasa de un segundo y medio
- [x] El nombre sorteado se lee de lejos: es lo único que importa en la pantalla
- [x] Sin nadie presente —o sin lista cargada— lo dice en vez de sortear entre nadie

Cómo quedó:

- **El peso es `máximo + 1 − sus participaciones`.** El `+ 1` es lo que evita que
  quien va a la cabeza quede en cero y no pueda salir nunca: el sorteo favorece, no
  excluye. Con el grupo empatado todos pesan igual, que es el sorteo uniforme.
- **El azar entra como argumento** hasta la pantalla: `domain/sorteo.ts` y
  `application/sorteo.ts` son puros y se prueban con un número fijo, incluidos los
  bordes de cada tramo.
- **El sorteado se decide antes de la animación** y se deriva del número al azar
  guardado en estado. Por eso saltar la ruleta no cambia a quién le tocó, y «volver a
  sortear» es cambiar ese número.
- **La ruleta dura 1 200 ms, se salta con un botón** y no existe si el dispositivo
  pide menos movimiento (`prefers-reduced-motion`).
- **`justificada` no entra**, aunque cuente como asistencia. Salió de aquí
  `estaEnElSalon()` en `domain/rules.ts`, con nombre propio porque es la única
  excepción de la app —y `C31` la va a volver a usar—.
- Confirmar «sí» llama al **mismo caso de uso** que el modo de captura
  (`sumarParticipacion`), así que una participación sorteada y una marcada a mano son
  el mismo dato. Decir «no» no escribe nada.
- El diálogo monta su contenido solo cuando está abierto: cerrado no deja ni una
  suscripción de participaciones viva.

El tercer punto es el que sostiene la calificación: un sorteo que registra la
participación por haber salido sorteado mediría *salir sorteado*, y la participación
dejaría de significar lo que dice.

El de la ponderación es de aula, no de software: un sorteo uniforme repite —treinta
tiros y alguien sale tres veces mientras otro no sale ninguna— y los niños lo notan
antes que nadie. Ponderado se puede decir en voz alta: *le toca a quien menos ha
pasado*.

### ⬜ C31 · `feat(grupo): formar equipos`

Ella dice cuántos equipos o cuántos niños por equipo, y el sistema los arma. Vive en
la pestaña **Grupo**: es una herramienta sobre la composición del salón, no sobre el
día.

**Aceptación**
- [ ] Se puede pedir por **número de equipos** o por **niños por equipo**
- [ ] El sobrante se reparte: con 30 alumnos y 4 equipos toca 8, 8, 7 y 7
- [ ] Se arma con los presentes, y se puede pedir con todo el grupo
- [ ] «Volver a sortear» da un reparto distinto
- [ ] Los equipos se leen de lejos, para mostrarlos al grupo
- [ ] Pedir más equipos que alumnos no rompe nada: lo dice y no arma equipos vacíos
- [ ] **No guarda nada**: los equipos viven mientras la pantalla está abierta

El último no es pereza, es la regla de Zustand del proyecto: los equipos son estado
de interfaz, no un dato del salón. Guardarlos significa una tabla, una fecha y una
pantalla de historial, y eso solo se paga si va a volver a verlos. Si algún día pide
«los equipos de ayer», ahí se paga.
