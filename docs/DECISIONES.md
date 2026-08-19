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

**Estado:** aceptada, con riesgo abierto

Seis botones de 5 a 10 en lugar de `<input type="number">`. Evita el teclado, el
desplazamiento y el zoom automático de Safari. Es un toque por calificación.

**Riesgo:** solo permite enteros. Si ella usa 8.5 o la evaluación de su grado es
descriptiva por niveles de desempeño en lugar de numérica, esta decisión se cae y
hay que rediseñar la captura.

**Bloqueante:** validar con ella antes de construir la pantalla.

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
| `ToggleGroup` — botones 5 a 10 | Fila de asistencia con barra bicolor |
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
