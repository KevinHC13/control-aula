# Decisiones

Registro breve de las decisiones tomadas y por qué. El objetivo es que el yo de
dentro de tres semanas no las vuelva a discutir desde cero, y que si alguna se
revierte, sea a sabiendas de lo que se pierde.

---

## D-001 · Vite en lugar de Next.js

**Estado:** aceptada

Next.js está construido alrededor del renderizado en servidor. Esta app es
offline-first, sin backend, un solo usuario. Server Components, Server Actions,
streaming SSR, ISR y el caché de `fetch` no se usarían o estorbarían.

Con `output: 'export'` sí funcionaría, pero sería usar Next como generador de
sitios estáticos. Se estaría practicando el App Router, no el modelo mental que
hace valioso el framework.

**Lo que se pierde:** práctica con Next.js, que era un objetivo declarado.

**Dónde recuperarlo:** el SaaS para contratistas, donde hay auth, datos en
servidor y multiusuario. Ahí Next se justifica y enseña lo que las entrevistas
preguntan.

---

## D-002 · Dexie sobre IndexedDB como única fuente de verdad

**Estado:** aceptada

`localStorage` es síncrono, con límite bajo y malo para listas y meses de
registros. IndexedDB directo es una API incómoda; Dexie la vuelve usable con
tipado decente.

Supabase **no** es una implementación alternativa del repositorio. Si un
`guardarAsistencia()` pudiera aterrizar en local o en remoto según haya red, se
producirían dos verdades divergentes y condiciones de carrera. Supabase queda
abajo, alcanzado por un motor de sincronía aparte.

---

## D-003 · La reactividad es parte del contrato del puerto

**Estado:** aceptada — reemplaza un rechazo inicial a la reactividad

El planteamiento original fue: no usar `dexie-react-hooks` porque acopla los
componentes a Dexie, y usar Dexie solo para persistir.

El diagnóstico era correcto pero la conclusión iba de más. El acoplamiento es de
**ubicación**, no de concepto: el problema es que 30 componentes importen
`useLiveQuery`, no que exista reactividad.

Quitar la reactividad tiene un costo alto y poco visible: cada mutación tendría
que saber qué vistas refrescar. Marcar una falta debe actualizar el contador, el
porcentaje en la pantalla de Grupo y la lista de riesgo. Escrito a mano, olvidar
una invalidación produce una UI que miente en silencio. Ese es el problema que
resuelven React Query y SWR.

**Decisión:** el puerto declara `observarDia(fecha): Suscribible<T[]>`. El
adaptador de Dexie lo implementa con `liveQuery`; uno de Supabase lo haría con
Realtime; uno de SQLite con un emisor propio. Los componentes consumen hooks
propios y nunca importan nada de Dexie.

**Verificación:**
`grep -rn "from.*data/dexie" src/ui src/application` debe dar cero resultados.

---

## D-004 · Sin TanStack Query en la v1

**Estado:** aceptada, revisable

TanStack Query resolvería la portabilidad y la invalidación de una vez. Pero con
`observarDia` en el puerto no hay invalidación manual que resolver, y una caché
en memoria sobre IndexedDB no compra nada: IndexedDB ya es local y rápido.

**Cuándo revisar:** cuando exista red real y latencia real. En el SaaS de
contratistas es la opción obvia.

---

## D-005 · Sin notificaciones push

**Estado:** aceptada

Web Push existe en iOS desde 16.4 para PWA instaladas, pero **no existe
Notification Triggers**: no hay notificaciones locales agendadas. La única forma
de que suene un aviso un día específico es que un servidor lo mande.

Eso implica: guardar la suscripción push, llaves VAPID, un cron diario y red
obligatoria en el momento del envío. Convierte una app sin servidor en una app
con infraestructura, por un aviso de cumpleaños.

**Alternativa adoptada:** aviso dentro de la app en la pantalla de asistencia,
que ella abre todos los días a primera hora, con vista semanal anticipada. Cero
infraestructura, funciona sin señal, y avisar el lunes es más útil que avisar el
mismo día a las 7:40.

**Cuándo revisar:** si aparece algo que ella necesite saber con la app cerrada y
donde el retraso importe de verdad — un recordatorio de junta con padres, por
ejemplo. Y cuando ya haya backend por otras razones.

---

## D-006 · Sin sincronía bidireccional

**Estado:** aceptada

Un usuario, un dispositivo. No hay dos personas editando el mismo alumno, así
que no hay conflictos reales que resolver.

Solo dos operaciones:

- **Subir**: empujar los pendientes de la `outbox` a Supabase
- **Restaurar**: bajar todo de golpe, una sola vez, al cambiar de iPad o
  reinstalar

Sin last-write-wins, sin vectores de versión, sin merge. Es la diferencia entre
dos días de trabajo y dos semanas.

**Cuándo revisar:** si alguna vez hay un segundo dispositivo o una segunda
persona. Entonces sí hace falta el aparato completo.

---

## D-007 · Captura de calificaciones con botones, no con teclado

**Estado:** reemplazada por [D-015](#d-015--la-evaluación-se-modela-con-rúbricas-trimestres-y-pesos) — 2026-08-20

Seis botones de 5 a 10 en lugar de `<input type="number">`. Evita el teclado, el
desplazamiento y el zoom automático de Safari. Es un toque por calificación.

**El riesgo se materializó.** Se anotó así: *solo permite enteros; si ella usa 8.5
o la evaluación de su grado es descriptiva por niveles de desempeño en lugar de
numérica, esta decisión se cae*. La validación después de la pausa dijo que la
evaluación es por niveles con descriptores, y la escala 5–10 desapareció del
modelo.

**Lo que sigue en pie:** nada de `<input type="number">` en el camino de captura.
Se cumple mejor que antes —se toca un nivel de rúbrica— y sigue aplicando al
único lugar donde hay que teclear cifras, los aciertos de examen (C24), que usa
un teclado numérico dentro de la app.

---

## D-008 · Sin CRUD de alumnos

**Estado:** aceptada, revocada en parte por [D-014](#d-014--la-lista-puede-entrar-por-importación-asistida-por-ia)

La lista real se carga una vez, por el desarrollador, desde un archivo de semilla.
Ella no importa nada ni teclea 30 nombres. Cuando cambie el ciclo escolar, se
edita el archivo y se despliega.

Una pantalla de alta de alumnos es trabajo de construcción y de uso que nadie
necesita para un solo grupo.

**Lo que sigue en pie:** no hay alta, baja ni edición de alumnos uno por uno. La
lista entra completa o no entra.

**Lo que revoca D-014:** que la cargue solo el desarrollador. Ella puede subir la
lista oficial desde Ajustes.

---

## D-013 · Navegar un día no escribe; materializarlo es explícito

**Estado:** aceptada

Abrir un día muestra a todos presentes **sin escribir nada**: `filasDelDia` cruza
el grupo con los registros que haya y rellena con `presente` lo que falta. Ir y
venir por la tira de días es de solo lectura, así que hojear la semana no llena
la base de días que nadie pasó.

Pero el porcentaje de asistencia se calcula sobre registros, y ahí la ausencia de
registro es ambigua. Si un día solo existiera la fila del único ausente, ese
alumno tendría un día en su denominador y sus compañeros ninguno: los
porcentajes dejarían de comparar lo mismo. Por eso existe `pasarLista(fecha)`,
que deja al grupo completo registrado en `presente` en **una** transacción, sin
tocar lo ya capturado, y es idempotente.

**Consecuencia para la pantalla (C8):** hay que decidir cuándo se llama.

| Momento | Costo |
|---|---|
| Al abrir el día | hojear la semana escribe días que nadie pasó |
| Con un botón *Pasar lista* | un toque extra en el camino diario |
| Al primer toque del día | ninguno visible; el día se materializa junto con la primera falta |

La tercera es la que respeta el presupuesto de 15 segundos: la maestra toca al
primer ausente y el día queda completo sin que ella haga nada más. Un día que
nadie tocó queda sin registros, que es la verdad — ese día no se pasó lista.

**Lo que se acepta:** un día en que todos asistieron y ella no toca nada no
queda registrado. Si eso importa para el informe, se resuelve con un toque
explícito en la interfaz, no cambiando esta regla.

---

## D-012 · Vitest para el dominio y los adaptadores, no para la interfaz

**Estado:** aceptada

Hasta C2 no había runner de tests y los criterios de aceptación de las reglas
puras —`promedioDe([])` es null, `porcentajeAsistencia([])` es 100— se
verificaban a mano. Eso funciona una vez; no sobrevive a C5, donde hay que
comprobar que cada mutación escribe `updated_at` y encola en el `outbox` **en la
misma transacción**, ni al refactor que en tres semanas cambie un umbral.

Vitest reutiliza la configuración de Vite: el alias `@/` y el pipeline de
TypeScript ya funcionan sin duplicar nada.

**Alcance acordado, para que la suite no se vuelva el proyecto:**

| Se prueba | No se prueba |
|---|---|
| `domain/rules.ts` — funciones puras | Componentes de shadcn (código ajeno) |
| Adaptadores de Dexie: transacción, `outbox`, `updated_at` | Estilos y layout |
| Casos de uso de `application/` | Estado de Zustand por sí mismo |

Las pruebas van **junto al archivo que prueban** (`rules.test.ts` al lado de
`rules.ts`), en entorno `node`, importando `describe`/`it`/`expect`
explícitamente de `vitest`. Sin `globals: true`: evita configurar tipos globales
en tsconfig y una excepción en ESLint.

**Lo que no cubre:** el zoom de Safari, el objetivo táctil de 44 px, el service
worker y `crypto.randomUUID()` en contexto seguro no se pueden probar aquí. Esos
siguen verificándose en el iPad con `docs/PWA-IOS.md`. Una suite verde no
significa que la app funcione en el dispositivo.

---

## D-011 · Tipografías auto-hospedadas, no desde Google Fonts

**Estado:** aceptada

`Archivo` y `DM Mono` se sirven desde el propio bundle (`@fontsource-variable/archivo`
y `@fontsource/dm-mono`), nunca con un `<link>` a `fonts.googleapis.com`.

Una fuente remota contradice el offline-first: en un salón sin red, la primera
carga sin caché se cae al fallback, y con `font-display: swap` eso significa que
la app se ve distinta el día que se instala. Además agrega dos dominios ajenos al
camino crítico de arranque.

**Se declaran los `@font-face` a mano** en `src/index.css` en vez de importar el
CSS de `@fontsource`. Los paquetes traen los subsets vietnamita y latin-ext y un
`.woff` legacy que Safari no necesita; importarlos mete seis archivos al bundle y
al precaché del service worker. El español entra completo en el subset latino
(`U+0000-00FF` cubre á é í ó ú ñ ü ¿ ¡).

Total embarcado: tres woff2, ~65 KB — Archivo variable 400-700 en un solo archivo,
DM Mono en 400 y 500.

**Consecuencia:** al actualizar cualquiera de los dos paquetes hay que revisar que
los nombres de archivo en `files/` no hayan cambiado; el `url()` los referencia
directo y un cambio de nombre rompe el build, no la apariencia en silencio.

**Costo asumido:** si más adelante hace falta un peso o un idioma fuera del
subset latino, hay que agregar el `@font-face` a mano.

---

## D-010 · shadcn/ui para primitivos, componentes propios para la identidad

**Estado:** aceptada

shadcn/ui no es una dependencia sino código copiado al repositorio. Eso es
decisivo aquí: los defaults de shadcn **violan** dos requisitos de
[UX.md](./UX.md) — `Button` es `h-9` (36 px) contra un piso de 44 px, e `Input`
y `Select` usan `text-sm` (14 px) contra un piso de 16 px por el zoom de Safari.

Con una librería normal eso significaría pelear con estilos ajenos. Con shadcn se
edita el `cva` del componente una vez, al agregarlo.

**Regla de reparto:**

| Usar shadcn | Componente propio |
|---|---|
| `ToggleGroup` — niveles de rúbrica | Fila de asistencia con barra bicolor |
| `Select` — alumno en el anecdotario | Barra de pestañas inferior |
| `Sonner` — avisos | Tira de días |
| `Textarea`, `Button`, `Dialog` | Contador de presentes |

shadcn para primitivos con comportamiento complejo: foco, teclado, portales,
ARIA. Componentes propios para todo lo que carga la identidad del producto.

**No usar:** `Card` en las filas de asistencia (su padding pelea con la
densidad), `Table` en calificaciones (son botones, no una tabla de datos),
`Tabs` para navegación principal (está pensado para tabs de contenido, no para
una barra tipo app nativa con `safe-area-inset`).

**Color:** los tokens del bicolor son la fuente de verdad y viven en `@theme`.
Las variables semánticas de shadcn (`--primary`, `--destructive`,
`--background`) se apuntan a ellos. Nunca al revés. Correr los dos sistemas en
paralelo produce dos azules distintos en la misma pantalla.

**Corrección obligatoria al agregar cada componente:**

- [ ] Alturas a 44 px mínimo en el `cva`
- [ ] `text-base` en cualquier control editable
- [ ] Alias de salida a `src/ui/components/ui` en `components.json`

---

## D-009 · Capa de aplicación y puertos, aun siendo sobredimensionado

**Estado:** aceptada, con reconocimiento explícito

Capa de aplicación más interfaz de repositorio es más estructura de la que una
app de un salón pide. Se acepta a sabiendas por dos razones: es práctica directa
de puertos y adaptadores, y es el andamiaje que se reutiliza en el SaaS de
contratistas, donde sí hay multiusuario y conflictos reales.

**Límite acordado:** los puertos declaran solo los métodos que alguna pantalla
usa hoy. **No** crear `BaseRepository<T>` ni genéricos especulativos. Si la capa
empieza a ser indirección sin contenido, se colapsa.

---

## D-014 · La lista puede entrar por importación asistida por IA

**Estado:** aceptada — 2026-08-18

Desde el tab Grupo, un botón de ajustes lleva a una pantalla donde la maestra
sube un PDF o una foto de la lista oficial y una IA extrae nombre, número de
lista y fecha de nacimiento. Revisa el resultado y guarda.

**Qué revoca.** De [D-008](#d-008--sin-crud-de-alumnos), que la lista la cargue
el desarrollador una vez al año: eso funciona mientras siga disponible cada
ciclo escolar, y esa es una dependencia que la app no tiene por qué tener. De
"Cero configuración" (`docs/UX.md` §4), que no exista ninguna pantalla fuera del
camino diario. La regla real nunca fue *ninguna pantalla*, era *ninguna pantalla
en el camino diario*: cargar la lista se hace una vez al año, no todas las
mañanas, y Ajustes está a dos toques de distancia de él.

**Por qué la clave vive en el servidor.** Una clave de Gemini en el bundle es
una clave publicada: cualquiera abre las DevTools y la copia, y la factura la
paga el proyecto. La llamada pasa por una Edge Function de Supabase que la
guarda como secret. Esto adelanta la infraestructura que C16 ya contemplaba, así
que no compra deuda nueva.

**Por qué la revisión es obligatoria.** La IA lee bien los nombres sencillos y
falla justo en los que importan: acentos y apellidos compuestos. Como no hay
edición de alumnos, lo que se guarde mal se queda mal todo el ciclo escolar. La
pantalla de revisión marca las filas con problema —nombre vacío, número
repetido, fecha que no es `AAAA-MM-DD`— y guardar está deshabilitado mientras
quede una.

**Por qué no se convierte una fecha como `12/03/2015`.** Es 12 de marzo o 3 de
diciembre según quién la escribió. Se marca para que la corrija quien sí sabe.

**Por qué sí se bajan las MAYÚSCULAS.** Las listas oficiales vienen así, y ese
texto acaba en la pantalla que se lee todos los días. Se capitaliza al extraer,
respetando las partículas del apellido (`De la Cruz Ríos`), y solo cuando el
nombre no trae ninguna minúscula: uno con mezcla ya viene bien, o lo está
tecleando ella.

Los **acentos no se restituyen**: `RIOS` sale `Rios`, no `Ríos`. Es el mismo
criterio que la fecha —no adivinar lo que el documento no dice— y es exactamente
lo que la revisión existe para atrapar.

De ahí que `normalizarExtraccion()` y `revalidar()` sean dos funciones. La
pantalla revalida en cada tecla; recortar espacios o recapitalizar ahí le pelea
al teclado a media palabra.

**Fusión.** Se reutiliza `sembrar()` sin cambiarlo: fusiona por `numero_lista`
conservando el `id`, así que reimportar con un nombre corregido no pierde la
asistencia ya capturada, y nadie desaparece del grupo por no venir en el archivo
nuevo. La contrapartida es que la semilla, que fusiona igual, pisaría lo
importado en el siguiente arranque; por eso ahora solo corre con la base vacía.

**Sin CURP.** No existe en el modelo y agregarla obligaría a `db.version(2)`
sobre datos reales del salón. No hay nada hoy que la use.

---

## D-015 · La evaluación se modela con rúbricas, trimestres y pesos

**Estado:** aceptada — 2026-08-20. Reemplaza a [D-007](#d-007--captura-de-calificaciones-con-botones-no-con-teclado)

Salió de la semana de uso real y de la validación con la usuaria, que era
exactamente para lo que existía la pausa después de C10. El plan anterior
—`Calificacion` con un entero de 5 a 10, capturado con seis botones— no se
parecía a cómo evalúa.

Lo que hay en su lugar: `Ciclo → Trimestre → CriterioTrimestre → Actividad →
Entrega | EvaluacionRubrica`, con pesos por criterio, rúbricas de cuatro niveles
y cierre de trimestre con snapshot. El modelo completo está en
[DATA-MODEL.md](./DATA-MODEL.md).

**Qué revoca.** De D-007, la escala 5–10 y los seis botones: no existe ninguna
escala de cinco a diez en el modelo nuevo. Lo que sí sobrevive de D-007 es su
razón de fondo —nada de `<input type="number">` en el camino de captura— y de
hecho se cumple mejor: se toca un nivel de rúbrica, no se teclea un número. De
[README.md](./README.md), que «motor de rúbricas y ponderaciones configurables» y
«multi-ciclo escolar» estuvieran fuera de alcance. Los dos entraron.

**Por qué las actividades cuelgan de `CriterioTrimestre` y no del criterio.**
Es lo que resuelve el cambio de trimestre por construcción. Un trimestre nuevo
nace con filas nuevas de `CriterioTrimestre` y por lo tanto cero actividades: no
hay que borrar nada ni filtrar por fecha, y cambiar un peso en T2 no puede tocar
lo ya calculado en T1. La alternativa —actividades colgadas del criterio global,
filtradas por fecha— habría dejado que un cambio de fechas moviera calificaciones
de un trimestre a otro en silencio.

**Por qué el cierre congela y guarda snapshot.** Sin eso, editar un porcentaje en
enero cambiaría retroactivamente una calificación ya reportada en la boleta de
diciembre, y la app dejaría de coincidir con el papel. El snapshot guarda nombres
y pesos como **texto**, no referencias, para que renombrar o borrar un criterio
después no reescriba la historia.

**Por qué base 1 en todo el cálculo y base 10 solo al presentar.** Redondear en
un paso intermedio y volver a redondear al final produce números que no cuadran
con la suma a mano, y ella *va* a comprobarlos a mano. El porcentaje no aparece
en ninguna pantalla: es representación interna, no algo que ella tenga que
traducir.

**Por qué no hay piso de escala.** El modelo es de puntos: 3 de 10 tareas es 3.0.
Un piso en 5 mentiría sobre el trabajo entregado, y el ajuste que ella quiera
hacer al reportar es suyo, no de la app.

**Por qué «Mal» vale 0 y no 1.** `VALOR_NIVEL = [3, 2.5, 2, 0]` deja los tres
niveles superiores a menos de dos puntos de distancia en base 10 y abre un
acantilado de 6.7 entre Regular y Mal. Es deliberado: «Mal» codifica que el
trabajo no vale nada, no que valga poco. La consecuencia a tener presente es que
tres criterios en Excelente y uno en Mal (7.5) queda por debajo de todo en Bien
(8.3). Si eso resulta indeseable, la palanca es la tabla `VALOR_NIVEL`, nunca la
fórmula: guardamos el **índice** del nivel, así que cambiar los valores no migra
un solo registro.

**Por qué el general no es el promedio de los promedios por campo.** Todas las
actividades valen lo mismo, así que un campo con seis actividades pesa el triple
que uno con dos. Promediar los cuatro campos les daría el mismo peso y le
quitaría significado a haber trabajado más un campo que otro.

**Por qué abrir una actividad escribe 30 filas.** Es lo contrario de
[D-013](#d-013--navegar-un-día-no-escribe-materializarlo-es-explícito), y a
propósito: en asistencia se hojean días para consultar, así que navegar no debe
escribir; a una actividad no se entra si no es a calificarla. Además hace
inequívoco el criterio de «actividad sin calificar»: cero registros significa que
no se abrió, y esa actividad se excluye del promedio en lugar de hundirlo.

**Qué queda pospuesto.** Puntualidad, conducta y participación, por decisión de
ella. `TipoCriterio` conserva los tres valores `auto_*` para no migrar el esquema
cuando se retomen, pero no hay pantallas ni cálculo, y `Nota` sigue sin `signo`.
El diseño de referencia queda escrito en DATA-MODEL.md; no es trabajo pendiente.

**Costo asumido.** El alcance de la v1 crece bastante: quince tablas donde había
seis, y una migración a `db.version(2)` sobre un iPad con datos reales del salón.
Se acepta porque la alternativa es una pantalla de calificaciones que ella no
usaría, y en ese caso el resto de la app tampoco sobrevive: si sigue evaluando en
el cuaderno, la asistencia acaba de vuelta ahí también.

---

## D-016 · La rúbrica cuelga de la actividad, no del criterio

**Estado:** aceptada — 2026-08-20. Corrige a [D-015](#d-015--la-evaluación-se-modela-con-rúbricas-trimestres-y-pesos)

El modelo validado puso `rubrica_id` en `CriterioTrimestre`. Está mal, y lo señaló
la usuaria del repositorio revisando C21: **un criterio tiene muchas actividades y
una actividad tiene una rúbrica.** La cardinalidad correcta es la de la actividad.

**El argumento de dominio.** Dentro de un mismo criterio «Entregables» caben un
texto escrito y una exposición, que no se evalúan con la misma rúbrica. Con la
rúbrica en el criterio, además, el criterio fuerza uniformidad: no podría tener una
tarea de palomita junto a un proyecto con rúbrica, que es un caso perfectamente
normal.

**El argumento que lo vuelve un defecto y no una preferencia.**
`EvaluacionRubrica.niveles` se indexa por `rubrica_criterio_id`. Con la rúbrica en
el criterio, cambiarla a mitad del trimestre deja las evaluaciones ya capturadas
apuntando a renglones de la rúbrica vieja: la pantalla de captura mostraría los
renglones nuevos vacíos y `valorConRubrica` promediaría sobre lo que quedara. Una
calificación ya dada desaparece **sin avisar**, que es exactamente la clase de
falla que este proyecto trata como inaceptable —una UI que miente en silencio—.

**Qué se descarta.** Se consideró dejar `rubrica_id` en el criterio como *valor por
omisión* y añadir el autoritativo en la actividad. Se rechazó: son dos lugares
donde vive la misma idea, y cambiar el default sin que las actividades existentes se
muevan se lee como que la app ignoró el cambio. El default sale de la **actividad
anterior del mismo criterio**, que es un valor derivado y no configuración, y
además suele ser mejor: lo último que usó es más probable que lo que configuró en
agosto.

**Momento.** Se corrigió antes de C21b, con cero actividades en la base, así que no
hubo datos que migrar. `rubrica_id` nunca estuvo indexado en ninguna de las dos
tablas, así que tampoco hizo falta una versión nueva del esquema.

**Costo asumido.** El selector de rúbrica de *Criterios y pesos* —construido en
C21— se retiró, y la asignación no existe hasta C21b. Mientras tanto el criterio de
aceptación «una rúbrica en uso no se puede borrar» solo se verifica en Vitest: no
hay camino en la interfaz para dejar una rúbrica en uso.

---

## D-017 · El ciclo se abre con un solo trimestre

**Estado:** aceptada — 2026-08-20. Ajusta a [D-015](#d-015--la-evaluación-se-modela-con-rúbricas-trimestres-y-pesos)

C19 pedía las fechas de los tres trimestres para poder abrir el ciclo. Es un
requisito que la realidad no cumple: en agosto la escuela ha publicado el
calendario del primer trimestre y nada más.

**Lo que costaba.** Para empezar a pasar lista —lo único que la app tiene que
permitir el primer día— había que inventar dos rangos. Y una fecha inventada es
peor que una ausente: atribuye registros a un trimestre equivocado sin decir nada,
y el error solo aparece meses después, al no cuadrar el reporte.

**Por qué se puede sin romper nada.** Porque la atribución **no se almacena**. Un
`RegistroAsistencia` guarda `fecha`; el trimestre sale de `trimestreDeFecha` cada
vez que se lee. Los días capturados antes de abrir el trimestre que los contiene se
atribuyen solos en el momento en que se abre, sin migración ni recálculo. Si la
atribución fuera un campo, este cambio habría exigido una pasada de reparación
sobre datos reales.

**Lo que sí hubo que resolver.** Que «fuera de los trimestres» dejara de ser una
sola cosa. Un día de vacaciones y un día cuyo trimestre no se ha abierto los dos
atribuyen a `null`, pero el segundo se arregla y el primero no. La etiqueta de
asistencia ahora los distingue: «Fuera de los trimestres» contra «El trimestre de
este día no se ha abierto». Sin esa distinción, ella iría a buscar el error donde
no está.

**Orden.** Los trimestres se abren en secuencia, cada uno después del anterior y
sin traslape. El número es una etiqueta y desordenarlos no rompería el cálculo,
pero una pantalla que ofrece «abrir el trimestre 3» con el 2 sin abrir no se
entiende.

## D-018 · Un examen por trimestre, y se presenta con un decimal

**Estado:** aceptada — 2026-08-21. Cierra dos `[POR VALIDAR]` de
[D-015](#d-015--la-evaluación-se-modela-con-rúbricas-trimestres-y-pesos)

Las dos preguntas se le hicieron a la usuaria antes de escribir C24, porque las dos
cambiaban código y una cambiaba el modelo.

**Un examen por trimestre.** `ResultadoExamen` y `ExamenConfig` cuelgan del
`CriterioTrimestre`, no de una actividad. Es lo que el modelo ya asumía, así que no
hubo migración: se confirmó antes de construir encima, que era el punto de
preguntar.

Lo que se decidió **no** hacer: volver el examen una actividad más «por si acaso».
Habría duplicado la captura —una pantalla de aciertos por actividad más el promedio
del criterio— para un caso que no existe, y el examen no se parece a un entregable:
no tiene rúbrica, tiene denominador.

Si algún día hay dos, el criterio de examen admite dos filas de
`CriterioTrimestre` con pesos distintos, que es como quedó resuelto en el código:
`examenesDeTrimestre` devuelve una lista, no un objeto. No es la solución completa
—serían dos criterios, no dos exámenes de uno— pero evita que la pantalla asuma
que hay exactamente uno.

**Se presenta con un decimal.** 8.3, no 8. El cálculo sigue sin redondeo intermedio
y en base 1; el decimal es solo al mostrar. Un entero borraría la diferencia entre
8.4 y 8.6, que es exactamente la comparación que ella hace al decidir una
calificación de boleta.

## D-019 · Lo que no está capturado no vale cero: se excluye

**Estado:** aceptada — 2026-08-21. Completa a
[D-015](#d-015--la-evaluación-se-modela-con-rúbricas-trimestres-y-pesos)

C28 tenía que decidir qué hace el cálculo con lo que está a medias. La regla quedó
en una sola frase: **`null` significa «no hay dato», nunca cero**, y se aplica en
los tres niveles de la cadena.

- **Una captura incompleta no produce calificación.** Un alumno con tres de cuatro
  renglones de la rúbrica, o con un campo del examen sin cifra, no tiene valor en
  esa actividad: se excluye, igual que una actividad sin ningún registro. La
  alternativa era promediar lo que hubiera, y eso daría un número que se ve final
  sacado de menos evidencia que el de los demás, sin que nada lo distinga. La
  pantalla de captura ya lo llamaba «sin calificar»; ahora el cálculo dice lo
  mismo.
- **El trimestre se normaliza sobre los pesos que sí aportan.** Con Tareas al 40%
  capturado y el resto vacío, un alumno con todo perfecto tiene 10.0 de lo que se
  ha calificado, no 4.0. Sumar `valor × peso` sobre pesos incompletos no da una
  calificación parcial: da una calificación equivocada, y a mitad del trimestre es
  la única que hay. Es la misma razón por la que una actividad sin registros se
  excluye del promedio (docs/DATA-MODEL.md), un nivel más arriba.

**Lo que la normalización obliga a mostrar.** Una cifra normalizada sin contexto
también miente, por optimista: 10.0 sobre el 40% del trimestre no es un 10 de
boleta. Por eso `calificacionDeTrimestre` devuelve `pesoConsiderado` junto al
valor, y la pantalla de C29 tiene que decir sobre cuánto está calculando. Al
cerrar, los pesos suman 100 y todos los criterios tienen valor, así que
`pesoConsiderado` sale en 100 y normalizar no cambia nada — el snapshot del cierre
no depende de esta decisión.

Queda **por confirmar con la usuaria** el primer punto: si ella espera que tres de
cuatro renglones ya den calificación, es una línea de `valorDeEvaluacion`. Nada de
la boleta depende todavía de esto, porque la pantalla de consulta es C29.

## D-020 · Los tres criterios automáticos se retoman, con reglas de ella

**Estado:** aceptada — 2026-08-21. Revierte la postergación anunciada en
[D-015](#d-015--la-evaluación-se-modela-con-rúbricas-trimestres-y-pesos)

Puntualidad, conducta y participación estaban pospuestas por decisión de la usuaria
y vuelven al alcance, ahora **con las reglas dictadas por ella** en vez del diseño
de referencia que había en `DATA-MODEL.md`. Los tres siguen siendo configurables por
lo que ya existe: un criterio se usa si tiene fila en el trimestre, y pesa lo que
diga su peso.

**Puntualidad: el retardo se convierte en falta, y cuántos lo decide ella.** Dos
niveles de configuración, no uno: si el criterio existe, la puntualidad se califica;
y `retardos_por_falta` dice cuántos retardos hacen una falta —`null` significa que un
retardo no penaliza en absoluto—. Es lo que ella pidió literalmente: *si se debe
tomar en cuenta un retardo o no, y si sí, cuántos retardos generan una falta.*

Lo que se descartó: el `VALOR_PUNTUALIDAD` del diseño viejo, que le daba 0.5 a cada
retardo. Es una regla inventada y además no se parece a cómo se lleva en el papel:
en la libreta los retardos se acumulan hasta convertirse en una falta, no valen medio
día cada uno.

**Conducta: sale de la bitácora, y todos sus reportes son negativos.** La pantalla
que se llamaba *Notas* pasa a llamarse **Bitácora**, y el cambio de nombre es la
decisión: no es un anecdotario sin consecuencias, es un registro de reportes, y todo
lo que se anota ahí cuenta. La escala la dio ella:

| Reportes en el trimestre | Conducta |
|---|---|
| 0 o 1 | 1.0 → **10.0** |
| 2 | 0.5 → **5.0** |
| 3 o más | 0.0 → **0.0** |

El primer reporte se deja pasar a propósito. Con eso desaparece el `signo` que el
diseño viejo quería agregarle a cada nota: si todo lo de la bitácora es un reporte,
marcar el signo sería marcar siempre lo mismo.

**Lo que esta decisión sí cuesta**, y conviene tenerlo escrito: la bitácora deja de
ser un lugar sin consecuencias para apuntar cosas. Anotar «se le olvidó el suéter»
cuenta igual que un reporte de conducta. El riesgo real es que ella escriba menos, y
la mitigación es que la pantalla lo diga sin rodeos —*un reporte aquí afecta la
calificación de conducta*— en vez de esconderlo.

**Participación: un modo, no un botón por fila.** Se marca desde la pantalla de
asistencia con un interruptor que cambia lo que hace el toque: prendido, tocar a un
alumno le suma una participación en vez de ciclar su asistencia. Es la propuesta de
ella y es la correcta para este caso: la participación no ocurre de una en una, ocurre
en rondas —«a ver, quién quiere pasar»— y un modo es exactamente la forma de hacer
muchas veces la misma cosa sin un toque extra por vez.

Lo que un modo cuesta es que el mismo gesto significa dos cosas, así que se paga con
tres cosas obligatorias: **se ve imposible de ignorar** (la pantalla cambia de
color y el contador cambia de significado), **se apaga solo** al salir de la
pantalla o al cambiar de día, y **se puede deshacer** —sostener el dedo resta una—.
Sin esas tres, un modo olvidado ensucia datos en silencio, que es el peor tipo de
error en una app sin auditoría.

Alternativas descartadas: un botón «+» por fila —un objetivo táctil más en la
pantalla más apretada, y treinta oportunidades de tocarlo sin querer mientras se pasa
lista— y deslizar la fila —gesto invisible, y en iOS compite con el de navegación—.

**La ausencia de datos no significa lo mismo en los tres.** Es la parte del diseño
que hay que cuidar al calcular (D-019):

- **Conducta sin reportes es un 10**, no un hueco: no tener reportes es el dato.
- **Puntualidad sin días capturados es `null`**: no hay de dónde sacarla.
- **Participación sin una sola marca en el trimestre es `null`** para todo el grupo
  —ella no usó el criterio—, pero si alguien tiene marcas, quien no tiene ninguna
  saca 0. Esta última es la única de las tres que conviene confirmarle antes de que
  salga en una boleta.

## D-021 · La meta de participación es 5, y entran dos herramientas de aula

**Estado:** aceptada — 2026-08-21. Completa a [D-020](#d-020--los-tres-criterios-automáticos-se-retoman-con-reglas-de-ella)

**La participación se califica proporcional con tope, y la meta nace en 5.** Cinco
participaciones o más dan el 100 %; menos valen lo proporcional —una es 2.0, tres son
6.0—. Con eso queda contestada la pregunta que estaba abierta desde D-020, y el
criterio no premia volumen sin límite: el sexto turno no vale más que el quinto,
porque si valiera, la participación se volvería una carrera entre los tres de
siempre.

**Sortear la participación.** Una función para elegir al azar quién pasa, en la
pantalla de asistencia. Tres decisiones de diseño que no son de adorno:

- **El sorteo no registra la participación por sí solo.** Sale un nombre y ella dice
  si participó o no. Registrarlo automáticamente mediría *salir sorteado*, que no es
  lo que la calificación dice medir.
- **Sortea entre los que están**, y estar es `presente` o `retardo`. `justificada`
  cuenta como asistencia para el porcentaje —ese es el trato con la escuela— pero el
  niño no está en el salón. Es el único lugar de la app donde esos dos estados no son
  lo mismo, y por eso queda escrito.
- **Pondera a favor de quien menos ha participado**, con azar en los empates. Un
  sorteo uniforme repite y los niños lo notan antes que nadie —«siempre le toca a
  ella»—; ponderado, empuja hacia donde el criterio quiere llegar y se puede decir en
  voz alta: *le toca a quien menos ha pasado*. Si ella prefiere azar puro, es un
  cambio de una función.

Y una advertencia de forma: la ruleta tiene que **poder saltarse**. Una animación de
tres segundos es divertida la primera vez y un estorbo la décima, con treinta niños
esperando.

**Formar equipos.** Ella dice cuántos equipos o cuántos niños por equipo —el mismo
dato visto al revés— y el sistema los arma con los presentes. El sobrante se reparte:
con 30 alumnos y 4 equipos toca 8, 8, 7 y 7, nunca 8, 8, 8 y 6.

**Los equipos no se guardan.** Viven en Zustand mientras la pantalla está abierta,
como el calendario del mes o la pestaña activa: son estado de interfaz, no un dato
del salón. Guardarlos significaría una tabla, una fecha y una pantalla de historial,
y eso solo se paga si va a volver a verlos; para armar equipos en el momento, no.
Es la decisión a revisar el día que pida «los equipos de ayer».

---

## D-022 · El respaldo se restaura mezclando, y no encola en la outbox

**Estado:** aceptada — 2026-08-21. Sale de construir `C14`.

El respaldo en JSON es un archivo con las dieciséis tablas sincronizables y la
versión del esquema dentro. Tres decisiones que no se ven en la pantalla y que
conviene no volver a discutir:

**Restaurar mezcla, no reemplaza.** Es un upsert por `id` y no borra lo que el
archivo no trae. El caso que existe es *recuperar lo que se perdió*, no *dejar el
iPad como estaba el 18 de diciembre*; y como los `id` son UUID del cliente, el
mismo archivo dos veces actualiza las mismas filas en vez de duplicarlas. Quien
quiera empezar de cero desinstala la app, que en iPadOS se lleva IndexedDB con
ella. Lo que se pierde: no hay forma de deshacer una restauración de un archivo
equivocado —solo de volver a restaurar el correcto—.

**El respaldo lleva los registros borrados.** El borrado es suave: un archivo que
filtrara `deleted_at` resucitaría al restaurar a un alumno dado de baja y a los
reportes que ella quitó. El respaldo es la base tal como está, no la base como se
ve.

**Restaurar no encola en la `outbox`**, y es la única excepción a la regla de que
toda escritura encola su cambio en la misma transacción. Restaurar no es una
mutación del salón: es meter de vuelta lo que ya se había capturado. Qué debe pasar
cuando un dispositivo restaurado se conecte por primera vez es una decisión del
motor de sincronía —`C16`, que tiene su propio «restaurar todo»— y resolverla aquí
sería inventar la semántica de un servidor que todavía no existe. La consecuencia a
tener presente: hoy, un iPad nuevo restaurado desde archivo **no** sube nada solo.

Y una de forma: exportar usa `navigator.share({ files })` cuando el navegador lo
tiene, porque en iPadOS esa hoja es la que trae *Guardar en Archivos*; en el
escritorio cae a una descarga por ancla. Es lo único de `C14` que no se puede
verificar sin el dispositivo en la mano.

---

## D-023 · La sincronía entra con login, y la sesión se queda

**Estado:** aceptada — 2026-08-21. Decisión del usuario al empezar `C16`.

El proyecto dice «no hay login», y sigue siendo verdad para **usar la app**: pasar
lista, calificar, anotar en la bitácora y armar equipos no piden nada a nadie. El
login aparece solo cuando los datos van a **salir del iPad**.

**Cómo queda:**

- **Supabase Auth con correo y contraseña**, una cuenta, y la sesión guardada en el
  dispositivo (`persistSession` + `autoRefreshToken`). Ella entra **una vez**; no hay
  pantalla de login en el arranque ni cada mañana.
- **Sin sesión la app funciona idéntico** contra los datos locales. La nube es un
  respaldo, no una dependencia: un `.env` sin llenar, una sesión caducada o un iPad
  sin red no cambian nada de lo que se hace en clase.
- **El login se pide en el momento de subir o restaurar**, no antes, y solo en la
  pantalla de la nube.

**Por qué no las otras dos.** Con **RLS abierta a `anon`**, cualquiera que abra el
bundle —la clave publicable viaja ahí por diseño— podría leer y borrar los nombres y
las calificaciones de treinta menores; el proyecto ni siquiera permite esos nombres en
el repositorio, así que no puede permitirlos en una tabla pública. Un **secreto de
dispositivo pegado en Ajustes** protegía igual y evitaba el login, pero es
criptografía casera: un secreto compartido que no caduca, no se puede revocar sin
tocar el código y termina copiado en una nota. Auth es el camino aburrido y probado.

**Lo que cuesta:** una pantalla de login que existe aunque casi nunca se vea, y
`@supabase/supabase-js` en el bundle. Y una tarea que no es código: **apagar los
registros públicos** en el proyecto de Supabase después de crear su cuenta. Con
`signup` abierto, cualquiera puede crear un usuario; las políticas solo dejan ver las
filas propias, así que no vería nada de ella, pero no hay razón para dejar la puerta.

**Consecuencia sobre el respaldo:** restaurar de la nube usa el **mismo camino** que
restaurar del archivo JSON (`RespaldoRepo.restaurar`, D-022): upsert por `id`, sin
encolar en la `outbox`. Y con eso se cierra el pendiente que dejó `C14` — un iPad
restaurado desde archivo no subía nada solo—: después de restaurar, la subida se pide
a mano una vez.

---

## D-024 · Fuera la semilla de ejemplo: la app arranca vacía

**Estado:** aceptada — 2026-08-24. Decisión del usuario al empezar el uso real.

Hasta hoy, `main.tsx` llamaba a `sembrarGrupo()` al arrancar y, si la base estaba
vacía, escribía los **treinta alumnos inventados** de `src/data/seed/grupo.example.ts`.
Fue el andamio correcto mientras no había otra forma de meter una lista: sin él, la
pantalla de asistencia no se podía ni mirar.

**Por qué se retira.** Ya hay dos puertas propias para la lista real —la carga
asistida por IA (D-014) y restaurar un respaldo (D-022)—, así que la semilla no
sostiene nada. Y sí cuesta: con datos reales, treinta nombres inventados son ruido que
hay que distinguir del grupo, y un `grupo.ts` olvidado en el disco de cualquiera
repuebla la base en **cualquier arranque futuro**, en silencio y sin que nada se vea
roto. La condición de «solo si la base está vacía» protegía de pisar lo importado,
pero no de eso.

**Cómo queda.** Desaparecen `src/data/seed/` entera, `src/application/grupo.ts` y la
llamada del arranque. `abrirBase()` ya no encadena nada. La app arranca en cero
alumnos y las pantallas ya tenían su mensaje —«Todavía no hay alumnos registrados. La
lista del grupo se carga en Grupo → Ajustes → Cargar lista de alumnos»—, que hasta
ahora era casi inalcanzable.

**Lo que no se va.** `AlumnosRepo.sembrar()`, que es la vía por la que entra la lista
desde Ajustes. Los casos que probaban su semántica —idempotencia, fusión por
`numero_lista` conservando el `id`, revivir un borrado, no dar de baja a quien falte en
el archivo— vivían colgados de la semilla en `application/grupo.test.ts` y **se
movieron a `data/dexie/alumnos.adapter.test.ts`**, que es donde les tocaba: prueban el
puerto, no la semilla.

**Consecuencia sobre los nombres inventados.** Con el ejemplo fuera, el repositorio ya
no versiona ninguna lista de alumnos, ni siquiera falsa; los nombres inventados que
quedan viven dentro del archivo de prueba que los usa. La regla de «nada de nombres
reales en el repositorio» deja de depender de acordarse de un `.gitignore`.

---

## D-025 · Varios ciclos guardados, uno abierto

**Estado:** aceptada — 2026-08-24. Decisión del usuario al empezar el uso real.

La app no soportaba un ciclo nuevo, y el hueco era más hondo de lo que parecía.
`Ciclo.estado` admitía `'cerrado'` desde `C18`, pero **nada en el código lo escribía
jamás**: `db.ciclos` solo recibía un `add`, así que ese valor era inalcanzable y la
rama de apertura de `CicloEscolar` quedaba muerta para siempre en cuanto se abría el
primer ciclo.

**Lo que no se veía.** `Alumno` no tenía ningún campo que lo atara a un ciclo, y
`lista()` devolvía la tabla entera. Con dos generaciones dentro, la pantalla diaria
las habría mezclado —eso se nota—, pero lo grave es lo que no se nota: `sembrar()`
fusiona **por `numero_lista` conservando el `id`**. Cargar la lista del año nuevo le
habría colgado al alumno 1 de este año la asistencia y las calificaciones del alumno 1
del anterior. No es un hueco de funcionalidad: es corrupción silenciosa de historia, y
del tipo que solo aparece meses después, al no cuadrar una boleta.

**Cómo queda.**

- `Alumno.ciclo_id`, con el índice `[ciclo_id+numero_lista]` en `version(4)`. El índice
  no es de rendimiento: es la **identidad** de un alumno al fusionar la lista.
- El acote vive en el **adaptador**, no en el puerto ni en las pantallas. Todas leen el
  grupo por `lista()`/`observarLista()`, así que acotarlo en un solo lugar las acota
  todas y ninguna puede saltárselo por olvido. El precio es que el adaptador de alumnos
  lee `db.ciclos`, que no es «su» tabla; es más barato que repartir la decisión por seis
  pantallas.
- `ciclo_id: null` significa «capturado antes de que hubiera ciclo», no «huérfano».
  **Abrir un ciclo adopta a los sueltos**, que es la misma idea de [D-017](#d-017--el-ciclo-se-abre-con-un-solo-trimestre):
  lo capturado antes de configurar el periodo que lo contiene se acomoda solo. Sin esto,
  pasar lista el primer día y abrir el ciclo el segundo dejaría al grupo entero fuera de
  la lista.
- **Cerrar el ciclo exige todos sus trimestres cerrados.** La calificación de un
  trimestre abierto se calcula al vuelo desde los criterios y los pesos del ciclo en
  curso, así que un ciclo cerrado con trimestres abiertos dentro tendría números que
  ninguna pantalla podría volver a producir. El snapshot del cierre es lo que los vuelve
  consultables para siempre.
- Cerrar **no borra nada**. Los alumnos, su asistencia y sus calificaciones se quedan
  enteros; lo que cambia es que las pantallas del camino diario amanecen limpias.

**Lo que no se ató a un ciclo, y por qué.** `asistencia`, `bitacora` y `participaciones`
siguen sin campo de ciclo: cuelgan de `alumno_id`, que ahora sí es por ciclo, y su
atribución al trimestre se **deriva por fecha** (D-017). Meterles un `ciclo_id` sería
almacenar dos veces el mismo hecho. `criterios` sigue siendo catálogo global a
propósito: existe justo para que «Tareas» sea el mismo criterio en los tres trimestres y
en los ciclos que vengan.

**Lo que sí hubo que cerrar.** La guarda de `abrirCicloEscolar` preguntaba
`cicloEnCurso() !== null`, y `cicloEnCurso()` **solo ve los abiertos**: habría dejado
abrir un segundo ciclo abierto justo el día en que la app empieza a tener historia. Y
`traslapes()` salta a propósito los pares de ciclos distintos, lo cual era inocuo con un
solo ciclo y deja de serlo con dos, porque la asistencia se atribuye por fecha: un rango
repetido contaría los días del año pasado dentro del trimestre de este. Ahora abrir un
ciclo rechaza el nombre repetido y el traslape con cualquier ciclo anterior.

**El histórico se limita a calificaciones.** *Ajustes → Ciclos anteriores* enseña el
reporte por trimestre desde el snapshot, y nada más: es lo que hace falta para una
aclaración de boleta. Reutiliza `ReporteDelTrimestre` sin cambiarla —ya sabía pintar
desde el snapshot— y **no toca ninguna de las cuatro pestañas**: el camino diario no
puede pagar un selector de ciclo que se usa dos veces al año. Asistencia y bitácora del
año pasado quedan fuera de alcance a sabiendas; si hicieran falta, salen del respaldo.

**Lo que costó.** Una migración de esquema sobre datos reales —`version(4)`, con su
prueba propia en `migracion-ciclo.test.ts`, que levanta una base v3 con su ciclo y la
abre— y una columna nueva en Supabase. La migración asigna los alumnos al único ciclo
que haya, que es el caso real del iPad; con dos o más no adivina y los deja en `null`,
que es visible y corregible, en vez de repartidos mal y en silencio.

---

## D-026 · Administrar alumnos uno por uno

**Estado:** aceptada — 2026-08-24. Decisión del usuario. Revierte una parte de
[D-009](#d-009--capa-de-aplicación-y-puertos-aun-siendo-sobredimensionado).

El proyecto decía, y estaba escrito en el puerto y en `docs/DATA-MODEL.md`: «no hay
CRUD de alumnos en la v1; la lista entra completa o no entra». La razón era buena —un
CRUD de treinta filas es una pantalla que se usa una vez al año y que hay que mantener
todo el año— y la carga asistida por IA (D-014) la hacía innecesaria para el caso
normal.

**Por qué se revierte.** Porque el caso normal no es el único. Un grupo de primaria se
mueve durante el año: llega alguien en noviembre, otro se cambia de escuela en febrero.
Y hay un tercero que la carga tampoco resuelve: el apellido que el OCR leyó mal y nadie
notó hasta diciembre. Para las tres cosas, la única respuesta que había era volver a
cargar la lista entera, que es desproporcionado y además no sabe dar de baja a nadie —
`sembrar()` no borra, a propósito—.

**Lo que cuesta.** Una pantalla más que mantener, seis métodos más en el puerto, y la
regla «la lista entra completa» deja de ser cierta, así que ya no se puede razonar
sobre el grupo asumiendo que viene de un solo sitio. Se acepta a sabiendas.

**Lo que no cambia.** *Cargar lista de alumnos* sigue siendo el camino para meter
treinta nombres sin teclear ninguno, y esta pantalla lo dice en su primera línea. Nada
de esto entra al camino diario: vive en Ajustes, como todo lo que se hace dos veces al
año.

**Las tres decisiones que tuvo dentro:**

1. **La baja es suave y no borra nada suyo.** `deleted_at`, como todo en el proyecto.
   Su asistencia y sus calificaciones se quedan, y su `id` sigue siendo válido: dar de
   baja significa «ya no está en el grupo», no «nunca estuvo».

2. **Un dado de baja sigue apareciendo en los trimestres ya cerrados.** Es la
   consecuencia menos obvia y la que más importa. Con el filtro de siempre, dar de baja
   en noviembre habría borrado a ese alumno del trimestre 1 que se cerró en octubre y
   cuya boleta ya se entregó — la app habría dejado de coincidir con el papel, que es
   justo lo que el cierre con snapshot existe para evitar. La decisión de quién entra
   vive en **`armarReporte`**, en el mismo sitio donde ya se decide entre el snapshot y
   el cálculo, porque es la misma bifurcación: cerrado, entran todos; abierto, solo los
   vigentes. Repetirla fuera sería tenerla mal en uno de los dos sitios. El precio son
   dos métodos de lectura más en el puerto —`conBajas()` y `deCicloConBajas()`—, que
   entregan el conjunto completo para que esa decisión no se reparta.

3. **El número de lista no se recicla ni se recorre a nadie.** Al agregar se propone el
   siguiente al más alto y ella puede cambiarlo; si el que escribe ya está tomado, se lo
   dice y no guarda. Único **dentro del ciclo y contando a los dados de baja**, porque
   `sembrar()` fusiona por ese número sobre todos los del ciclo, borrados incluidos —así
   es como revive a quien vuelve—, de modo que dos alumnos con el mismo número harían
   que recargar la lista escribiera sobre cualquiera de los dos, al azar. Y no se
   recorre a los demás al insertar: el alumno 14 sigue siendo el 14 todo el año, porque
   ella pasa lista por esos números.

**Un botón de Guardar, al revés que en las pantallas de captura.** La regla «cada toque
escribe» es de la captura diaria, donde el dato es un estado y el toque es la captura
entera. Un nombre a medio escribir no es un dato, y escribir en cada tecla llenaría la
`outbox` de versiones intermedias de un apellido.

**Lo que sigue pendiente y no es un fallo:** volver a cargar la lista con IA **revive**
a un alumno dado de baja si aparece en el archivo nuevo. Es el comportamiento correcto
—si la escuela lo trae en la lista oficial, está inscrito— pero conviene saberlo antes
de que sorprenda.
