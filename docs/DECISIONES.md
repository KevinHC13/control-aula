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

**Estado:** aceptada

La lista real se carga una vez, por el desarrollador, desde un archivo de semilla.
Ella no importa nada ni teclea 30 nombres. Cuando cambie el ciclo escolar, se
edita el archivo y se despliega.

Una pantalla de alta de alumnos es trabajo de construcción y de uso que nadie
necesita para un solo grupo.

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
