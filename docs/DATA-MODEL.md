# Modelo de datos

## Invariantes no negociables

Estas cuatro reglas van desde el primer commit. Son las únicas que **no se
pueden agregar retroactivamente** sin migrar datos reales del salón de clases.

### 1. IDs generados en el cliente con UUID

```ts
const id = crypto.randomUUID()
```

Nunca autoincremento (`++id` en Dexie). Con enteros locales, dos dispositivos
generan el mismo `id: 1` y el respaldo se corrompe al restaurar.

`crypto.randomUUID()` requiere contexto seguro: funciona en HTTPS y en
`localhost`, pero **no** en `http://192.168.x.x`. Al probar en el iPad por red
local, esto falla. Ver [PWA-IOS.md](./PWA-IOS.md).

### 2. `updated_at` en cada registro

ISO 8601 UTC. Es lo único que le dice al motor de sincronía qué falta subir.
Se escribe en cada mutación, sin excepción.

### 3. Borrado suave con `deleted_at`

Un registro borrado de verdad no se puede sincronizar: el servidor nunca se
enteraría. Toda lectura filtra `deleted_at === null`.

### 4. Tabla `outbox`

Existe desde el primer commit aunque nadie la lea todavía. Cada mutación
encola su cambio en la misma transacción de Dexie.

## Tipos base

```ts
// domain/values.ts

/** ISO 8601, solo fecha: "2026-08-18" */
export type Fecha = string

/** UUID v4 */
export type Id = string

/** ISO 8601 completo en UTC */
export type Instante = string

export type EstadoAsistencia =
  | 'presente'
  | 'ausente'
  | 'retardo'
  | 'justificada'

export const CICLO_ESTADOS: EstadoAsistencia[] = [
  'presente',
  'ausente',
  'retardo',
  'justificada',
]

export type CampoFormativo =
  | 'lenguajes'
  | 'saberes_pensamiento_cientifico'
  | 'etica_naturaleza_sociedades'
  | 'humano_comunitario'

/** Campos base de todo registro sincronizable */
export interface Sincronizable {
  id: Id
  updated_at: Instante
  deleted_at: Instante | null
}
```

Los cuatro campos formativos **quedaron validados** con la usuaria: son la
agrupación con la que ella reporta. Dejaron de ser `[POR VALIDAR]`.

---

# Alumnos y registro diario

Esta parte está construida y en uso.

```ts
// domain/entities.ts

export interface Alumno extends Sincronizable {
  nombre: string          // "Apellidos, Nombres" — orden de la lista oficial
  numero_lista: number    // orden en la lista, 1-based
  fecha_nacimiento: Fecha | null
}

export interface RegistroAsistencia extends Sincronizable {
  alumno_id: Id
  fecha: Fecha
  estado: EstadoAsistencia
}

export interface Nota extends Sincronizable {
  alumno_id: Id
  fecha: Fecha
  texto: string
}
```

`Nota` **no lleva campo `signo`**. Se agrega solo si se retoma el criterio de
conducta, que está pospuesto (ver más abajo).

---

# Jerarquía de evaluación

Reemplaza por completo las entidades `Actividad` y `Calificacion` del prototipo,
y con ellas la escala 5–10 de botones. La validación con la usuaria está en
[DECISIONES.md](./DECISIONES.md) D-015.

La estructura resuelve el problema del cambio de trimestre **por construcción**,
no con limpieza de datos:

```
Ciclo
└─ Trimestre                 fechas · abierto/cerrado
   └─ CriterioTrimestre      peso %  ──→ Criterio (catálogo)
      └─ Actividad
         └─ Entrega / EvaluacionRubrica
```

Las actividades cuelgan de `CriterioTrimestre`, no del criterio global. Un
trimestre nuevo nace con filas nuevas de `CriterioTrimestre` y, por lo tanto,
**cero actividades**. No se borra ni se filtra nada por fecha.

## Ciclo y trimestre

```ts
export interface Ciclo extends Sincronizable {
  nombre: string                          // "2026–2027"
  estado: 'abierto' | 'cerrado'
}

export interface Trimestre extends Sincronizable {
  ciclo_id: Id
  numero: 1 | 2 | 3
  inicio: Fecha
  fin: Fecha
  estado: 'abierto' | 'cerrado'
  cerrado_en: Instante | null
}
```

### El ciclo se abre con el primer trimestre nada más

En agosto nadie sabe las fechas de los otros dos: la escuela publica su calendario
por partes. Exigir los tres rangos para poder abrir el ciclo obligaría a inventar
dos, y una fecha inventada es peor que una ausente —atribuye registros a un
trimestre equivocado en silencio—.

Así que `Ciclo` nace con un solo `Trimestre`, y los demás se agregan cuando se
sepan. **Un ciclo con uno o dos trimestres es un estado válido**, no uno a medias.

Lo que lo vuelve seguro es que **la atribución no se guarda: se deriva de la fecha
al leer**. Un `RegistroAsistencia` solo tiene `fecha`; el trimestre se calcula con
`trimestreDeFecha` cada vez que se lee. Los días capturados antes de abrir el
trimestre que los contiene quedan sin atribuir a la vista —y la pantalla lo dice,
«El trimestre de este día no se ha abierto»— y **quedan atribuidos en el momento en
que se abre**, sin migrar ni recalcular nada.

Reglas de la apertura:

- Se abren en orden: el 2 después del 1. El número es una etiqueta y desordenarlos
  no rompería el cálculo, pero volvería incomprensible la pantalla.
- El nuevo empieza después de que termina el anterior, y no se traslapa con
  ninguno.
- Corregir las fechas de los que ya existen no requiere que estén los tres.

### Para qué sirven las fechas

No son decorativas. Son lo que **atribuye automáticamente** los registros
diarios a un trimestre: la asistencia y las participaciones se capturan por
fecha, sin que ella elija trimestre, y el rango decide a cuál pertenecen.

Reglas:

- Los rangos de trimestres del mismo ciclo no se traslapan.
- Un registro con fecha fuera de todo rango (vacaciones, puentes) existe pero no
  cuenta para ningún trimestre. Ojo: eso no es lo mismo que una fecha posterior al
  último trimestre **abierto**, que se resuelve abriendo el siguiente.
- Cambiar las fechas de un trimestre **abierto** recalcula los criterios
  automáticos. Cambiarlas en uno **cerrado** está prohibido.

### Cerrar un trimestre lo congela

Al cerrar:

1. Los pesos de sus `CriterioTrimestre` quedan inmutables.
2. No se aceptan calificaciones nuevas ni cambios a las existentes.
3. Se escribe un snapshot de calificaciones finales.

Sin esto, editar un porcentaje después de entregar la boleta cambiaría
retroactivamente una calificación ya reportada, y la app dejaría de coincidir
con el papel.

```ts
export interface CierreTrimestre extends Sincronizable {
  trimestre_id: Id
  alumno_id: Id
  final: number | null
  desglose: {
    criterio: string      // nombre al momento del cierre
    peso: number
    calificacion: number | null
    porCampo: Partial<Record<CampoFormativo, number>>
  }[]
}
```

El snapshot guarda nombres y pesos como texto, no referencias. Es la verdad
histórica aunque después se renombre o se borre un criterio. Todo en **base 1**,
como el resto de la cadena.

`final` y `calificacion` admiten `null` porque un criterio puede quedar sin nada
capturado al cerrar —y un alumno que llegó la última semana, sin nada en ninguno—.
El criterio se guarda igual, con su peso: sacarlo del desglose dejaría un hueco
imposible de distinguir de un criterio que nunca existió. `porCampo` va en el
snapshot porque el reporte es por campo formativo, y recalcularlo sería lo que el
snapshot existe para no tener que hacer.

**Reabrir** borra el snapshot en suave y conserva `cerrado_en`: con el trimestre
abierto las calificaciones vuelven a calcularse de lo capturado, y dejar los cierres
vivos dejaría dos verdades a la vez. `cerrado_en` con `estado: 'abierto'` es la
huella de que el trimestre estuvo cerrado. Volver a cerrar reescribe el mismo
registro por alumno.

## Criterios

```ts
export type TipoCriterio =
  | 'entregable'           // tareas, trabajos en clase, portafolio
  | 'examen'
  | 'auto_puntualidad'
  | 'auto_conducta'
  | 'auto_participacion'
  | 'personalizado'

export interface Criterio extends Sincronizable {
  nombre: string
  tipo: TipoCriterio
}

export interface CriterioTrimestre extends Sincronizable {
  trimestre_id: Id
  criterio_id: Id
  peso: number                       // 0–100
  orden: number
  meta_participacion: number | null  // solo auto_participacion
}
```

**Invariante:** la suma de `peso` de un trimestre debe ser 100 **para poder
cerrarlo**. Durante la edición se permite cualquier suma —editar siempre pasa
por estados intermedios inválidos— pero el total corriente se muestra en
pantalla.

### Copiar el esquema de un trimestre a otro

Al abrir un trimestre nuevo se ofrece copiar del anterior. Se copia:

- Filas de `CriterioTrimestre` con sus pesos
- La meta de participación

**No** se copia: actividades, entregas, evaluaciones ni resultados de examen. Y por
lo tanto tampoco rúbricas: cuelgan de la actividad, no del criterio.

Son filas nuevas, así que cambiar un peso en T2 no toca lo ya calculado en T1.

## Actividades y rúbricas

```ts
export interface Actividad extends Sincronizable {
  criterio_trimestre_id: Id
  nombre: string
  campo: CampoFormativo
  ejes: string[]                     // ejes articuladores
  fecha: Fecha
  rubrica_id: Id | null              // null ⇒ captura entregada/no entregada
}

export interface Rubrica extends Sincronizable {
  nombre: string
  /** Desactivada: sale del selector, pero sigue resolviendo lo ya calificado. */
  activa: boolean
}

export interface RubricaCriterio extends Sincronizable {
  rubrica_id: Id
  nombre: string
  descriptores: [string, string, string, string]   // uno por nivel
  orden: number
}
```

### Qué criterios se llenan con actividades

Solo los de tipo `entregable`. El examen se captura por aciertos sobre el
`CriterioTrimestre` —hay uno por trimestre, no una actividad por examen— y los
`auto_*` se derivan en vez de capturarse. `personalizado` existe en el tipo pero no
tiene forma de captura definida, así que tampoco admite actividades hasta que la
tenga. La regla es `admiteActividades(tipo)` en `domain/evaluacion.ts`.

### Los ejes articuladores

`Actividad.ejes` es `string[]` y son **opcionales**: la actividad se guarda sin
ninguno. La pantalla ofrece los siete de la NEM como lista —para no teclear en el
iPad— pero se guardan como texto, así que corregir la lista no obliga a migrar
nada.

Los niveles son fijos y los mismos para toda rúbrica:

```ts
// domain/values.ts
export const NIVELES = ['Excelente', 'Bien', 'Regular', 'Mal'] as const
export const VALOR_NIVEL = [3, 2.5, 2, 0] as const  // paralelo a NIVELES
export const NIVEL_MAXIMO = 3
```

Todos los criterios de una rúbrica pesan lo mismo. No hay ponderación interna.

### La rúbrica cuelga de la actividad

`rubrica_id` vive en `Actividad` y **no** en `CriterioTrimestre`. Un criterio tiene
muchas actividades y cada una se evalúa con lo que le corresponde: dentro de
«Entregables» caben un texto escrito y una exposición, que no comparten rúbrica, y
una tarea de palomita junto a un proyecto con rúbrica.

La razón dura es otra. `EvaluacionRubrica.niveles` se indexa por
`rubrica_criterio_id`. Con la rúbrica en el criterio, cambiarla a mitad del
trimestre dejaría las evaluaciones ya capturadas apuntando a renglones de la
rúbrica vieja: la pantalla de captura mostraría los renglones nuevos vacíos y
`valorConRubrica` promediaría sobre lo que quedara. Una calificación ya dada
desaparecería sin avisar. Anclada a la actividad, eso no puede pasar.

Al crear una actividad, la rúbrica llega precargada con la de la **actividad
anterior del mismo criterio**. Es un valor derivado, no configuración: cero toques
extra en el caso normal, y nada que ajustar en Ajustes.

### Desactivar no es borrar

`activa` existe aparte de `deleted_at` porque son dos cosas distintas:

- **Desactivar** (`activa: false`) saca la rúbrica del selector de criterios, pero
  la deja resolviendo por `id` todo lo que ya se calificó con ella. Es la salida
  para una rúbrica en uso que ella ya no quiere volver a usar.
- **Borrar** (`deleted_at`) se reserva para una rúbrica que **nadie** usa. Ahí no
  hay historia que respetar.

Una rúbrica que alguna `Actividad` referencia no se borra. Hacerlo dejaría a esa
actividad apuntando a nada y su captura pasaría a binaria de un día para otro,
cambiando calificaciones ya dadas.

El `id` de cada `RubricaCriterio` es la clave de `EvaluacionRubrica.niveles`, así
que editar una rúbrica **conserva los ids** de los renglones que sobreviven: se
actualizan en su lugar y solo los que desaparecen se borran en suave. Recrearlos
dejaría huérfano todo lo ya calificado.

---

# Cálculo de calificaciones

Toda calificación intermedia se maneja en **base 1**. La conversión a base 10
ocurre **una sola vez, al presentar**. Nunca se redondea en pasos intermedios.

## Actividad

```ts
/** Con rúbrica: promedio de niveles ÷ 3. Mínimo posible 0. */
export function valorConRubrica(niveles: number[]): number {
  const suma = niveles.reduce((a, b) => a + b, 0)
  return suma / niveles.length / NIVEL_MAXIMO
}

/** Sin rúbrica: binario. */
export function valorSinRubrica(entregada: boolean): number {
  return entregada ? 1 : 0
}
```

**Consecuencia:** la escala no solo abre el piso en 0, también se endurece en los
niveles intermedios.

| Nivel | Valor base 1 | Base 10 |
|---|---|---|
| Excelente | 1.000 | 10.0 |
| Bien | 0.833 | 8.3 |
| Regular | 0.667 | 6.7 |
| Mal | 0.000 | 0.0 |

Los tres niveles superiores están separados por menos de dos puntos, pero de
Regular a Mal se caen 6.7. **«Mal» es un acantilado deliberado:** codifica que el
trabajo no vale nada, no que valga poco.

Consecuencia a tener presente: en una rúbrica de cuatro criterios, tres en
Excelente y uno en Mal da 7.5 — por debajo de todo en Bien (8.3). Si ese
comportamiento no es el deseado, la palanca es `VALOR_NIVEL`, nunca la fórmula.

Los valores no son enteros, pero eso no afecta el almacenamiento:
`EvaluacionRubrica.niveles` guarda el **índice** del nivel elegido (0–3), no su
valor. Cambiar la tabla no requiere migrar datos.

`niveles` puede quedar **incompleto**: la pantalla de captura escribe renglón por
renglón, y salir a media rúbrica deja un mapa con menos entradas que renglones. La
interfaz trata eso como *sin calificar* —`nivelesCompletos` en `domain/`— y no lo
cuenta en el «12 de 30».

**El cálculo dice lo mismo** (D-019): `valorDeEvaluacion` devuelve `null` con un
mapa incompleto y el alumno queda excluido de esa actividad. Promediar tres
renglones de cuatro daría un número que se ve final sacado de menos evidencia que
el de los demás.

## Criterio

Todas las actividades de un criterio valen lo mismo. El valor del criterio es el
promedio simple de sus actividades:

```ts
export function valorCriterio(valores: number[]): number | null {
  if (valores.length === 0) return null
  return valores.reduce((a, b) => a + b, 0) / valores.length
}
```

Se calcula dos veces: **por campo formativo** (filtrando las actividades de ese
campo) y **en general** (con todas).

**El general no es el promedio de los promedios por campo.** Es el promedio de
todas las actividades. Si todas las actividades valen lo mismo, un campo con seis
actividades pesa el triple que uno con dos — y así debe ser.

Con tres actividades: dos de Lenguajes sin rúbrica (una entregada, otra no) y una
de SPC con rúbrica de cuatro criterios calificados Bien, Excelente, Regular, Bien
→ (2.5 + 3 + 2 + 2.5) ÷ 4 = 2.5 → 2.5 ÷ 3 = 0.833.

| | Cálculo | Valor | Base 10 |
|---|---|---|---|
| Lenguajes | (1.00 + 0.00) ÷ 2 | 0.500 | 5.0 |
| SPC | 0.833 ÷ 1 | 0.833 | 8.3 |
| **General** | (1.00 + 0.00 + 0.833) ÷ 3 | **0.611** | **6.1** |

El promedio de los promedios daría 0.667 (6.7). Es incorrecto para este modelo.

## Examen

Mismo principio:

```ts
/** Por campo: aciertos del campo ÷ preguntas del campo */
export function valorExamenPorCampo(aciertos: number, preguntas: number): number

/** General: aciertos totales ÷ preguntas totales */
export function valorExamenGeneral(res: ResultadoExamen, cfg: ExamenConfig): number
```

El general se calcula sobre los totales, no promediando los cuatro campos. Un
campo con 30 preguntas pesa más que uno con 20, que es el comportamiento
correcto.

## Trimestre

```ts
export function calificacionDeTrimestre(
  parciales: readonly { peso: number; valor: number | null }[]
): { valor: number | null; pesoConsiderado: number }
```

Los criterios con valor se ponderan por su peso y el resultado se **normaliza sobre
los pesos que sí aportan** (D-019):

```
valor = Σ(valor × peso) ÷ Σ(peso)      sobre los criterios con valor y peso > 0
```

Sin normalizar, a mitad del trimestre —solo Tareas capturado, 40%— un alumno con
todo perfecto saldría en 0.4, o 4.0 en base 10. El criterio que todavía no tiene
nada capturado no vale cero: no está.

`pesoConsiderado` viaja con el valor porque una cifra normalizada sin contexto
también miente, por optimista: 10.0 sobre el 40% del trimestre no es un 10 de
boleta. Al cerrar, los pesos suman 100 y todos los criterios tienen valor, así que
sale en 100 y normalizar no cambia nada.

## Presentación en base 10

```ts
export function aBase10(valor: number): number {
  return valor * 10
}
```

**Sin piso.** El rango completo es 0 a 10. Una calificación menor a 5 es un
resultado válido y se muestra tal cual: el modelo es de puntos, y 3 de 10 tareas
equivale a 3.0.

El porcentaje **no aparece nunca** en la interfaz. Ella ve base 10 en todas las
pantallas.

**Validado el 2026-08-21: un decimal** (D-018). `comoCalificacion` es el único
lugar de la cadena que redondea —de ahí que sea el único que puede hacerlo sin
acumular error— y devuelve `—` cuando no hay dato, nunca `0.0`.

## Actividades sin calificar

Una actividad **sin ningún registro** se excluye del promedio. De lo contrario el
promedio de medio trimestre siempre se vería hundido por lo que aún no se
califica.

Para que no exista ambigüedad, **al abrir la pantalla de captura de una actividad
se escriben los registros de los 30 alumnos de golpe** (todos `entregada: true`),
igual que `pasarLista()` crea el día completo de asistencia.

Así:

- Cero registros ⇒ actividad no calificada ⇒ se excluye
- Con registros ⇒ actividad calificada ⇒ no hay huecos posibles

Nótese que esto es lo **contrario** de la regla de asistencia (D-013): ahí abrir
un día no escribe nada, aquí abrir una actividad escribe 30 filas. La diferencia
es que en asistencia se hojean días para consultar, y en una actividad no se
entra si no es a calificarla.

---

## Registros de evaluación

Tres formas, según el tipo de criterio:

```ts
/** Criterio entregable sin rúbrica */
export interface Entrega extends Sincronizable {
  actividad_id: Id
  alumno_id: Id
  entregada: boolean
}

/** Criterio entregable con rúbrica */
export interface EvaluacionRubrica extends Sincronizable {
  actividad_id: Id
  alumno_id: Id
  niveles: Record<Id, number>        // rubrica_criterio_id → índice de nivel
}

/** Criterio de tipo examen */
export interface ResultadoExamen extends Sincronizable {
  criterio_trimestre_id: Id
  alumno_id: Id
  aciertos: Partial<Record<CampoFormativo, number>>
}

export interface ExamenConfig extends Sincronizable {
  criterio_trimestre_id: Id
  preguntas: Partial<Record<CampoFormativo, number>>
}
```

**Validado el 2026-08-21: hay un examen por trimestre** (docs/DECISIONES.md
D-018). `ResultadoExamen` y `ExamenConfig` apuntan al `CriterioTrimestre` y ahí se
quedan. Un trimestre con dos exámenes de pesos distintos se modela con dos filas de
`CriterioTrimestre` de tipo `examen`, no con actividades: por eso
`examenesDeTrimestre` devuelve una lista.

`preguntas` es un mapa parcial a propósito: un examen que no evaluó *De lo humano y
lo comunitario* simplemente no trae ese campo, y un campo sin preguntas no se
captura —sería dividir entre cero—. Corregir un total no borra los aciertos ya
capturados, pero bajarlo por debajo de lo capturado se rechaza: dejaría una
calificación por arriba de 10.

## Criterios automáticos — POSPUESTOS

**No se desarrollan por ahora.** Puntualidad y asistencia, conducta y
participación quedan fuera del alcance actual por decisión de la usuaria.

El tipo `TipoCriterio` conserva sus valores (`auto_puntualidad`,
`auto_conducta`, `auto_participacion`) para no migrar el esquema después, pero no
hay pantallas ni cálculo. Los pesos del trimestre se reparten entre los criterios
que sí existen y la validación de suma 100 sigue aplicando.

Las notas mantienen su forma actual, **sin campo `signo`**. Se agrega solo si
conducta se retoma.

Lo que sigue es diseño de referencia para ese momento, no trabajo pendiente.

### Puntualidad y asistencia

El retardo debe penalizar. Si contara como asistencia plena, el criterio sería
idéntico al de asistencia:

```ts
const VALOR_PUNTUALIDAD: Record<EstadoAsistencia, number> = {
  presente: 1,
  justificada: 1,
  retardo: 0.5,      // [POR VALIDAR]
  ausente: 0,
}
```

Se convierte a base 10 con la misma regla que el resto: `proporcion × 10`, sin
piso. Un alumno con 0 % de asistencia obtiene 0.

### Conducta

Requiere agregar un signo a las notas:

```ts
export interface Nota extends Sincronizable {
  alumno_id: Id
  fecha: Fecha
  texto: string
  signo: 'positiva' | 'neutral' | 'negativa'   // por defecto neutral
}
```

**El signo es opcional y por defecto neutral.** Solo cuenta lo que ella marque
explícitamente.

La razón no es técnica: si toda nota afectara una calificación, ella escribiría
menos notas o las escribiría estratégicamente. El anecdotario vale justamente
porque es un espacio sin consecuencias para recordar cosas. Evaluar conducta
tiene que ser un acto deliberado, no un efecto secundario de escribir.

`[POR VALIDAR]` — la fórmula. Punto de partida: arrancar en 10 y descontar por
nota negativa.

### Participación

```ts
export interface Participacion extends Sincronizable {
  alumno_id: Id
  fecha: Fecha
}
```

Se captura desde la **pantalla de asistencia**, no en una pantalla propia: ella
ya está ahí todos los días con la lista enfrente.

La normalización usa `meta_participacion` del trimestre —por ejemplo, 10
participaciones equivalen a 10— y no el máximo del grupo. Contra el máximo, un
alumno muy participativo hunde la calificación de todos los demás.

`[POR VALIDAR]` — Y una pregunta previa para ella: ¿quiere premiar volumen de
participación, o su criterio es otro?

---

# Esquema de Dexie

`version(1)` es lo que está desplegado hoy: cinco tablas de dominio más la
`outbox`. Las tablas de evaluación entran en `version(2)`, y es una migración
sobre datos reales del salón, así que se hace una sola vez, completa (C18).

```ts
// data/dexie/db.ts

db.version(1).stores({
  alumnos:        'id, numero_lista, deleted_at',
  asistencia:     'id, fecha, alumno_id, [fecha+alumno_id], deleted_at',
  actividades:    'id, fecha, campo, deleted_at',
  calificaciones: 'id, actividad_id, alumno_id, [actividad_id+alumno_id], deleted_at',
  notas:          'id, alumno_id, fecha, deleted_at',
  outbox:         '++seq, tabla, registro_id',
})

db.version(2).stores({
  alumnos:              'id, numero_lista, deleted_at',
  asistencia:           'id, fecha, alumno_id, [fecha+alumno_id], deleted_at',
  notas:                'id, alumno_id, fecha, deleted_at',

  ciclos:               'id, estado, deleted_at',
  trimestres:           'id, ciclo_id, numero, inicio, fin, estado, deleted_at',
  criterios:            'id, tipo, deleted_at',
  criterios_trimestre:  'id, trimestre_id, criterio_id, [trimestre_id+orden], deleted_at',

  rubricas:             'id, deleted_at',
  rubrica_criterios:    'id, rubrica_id, [rubrica_id+orden], deleted_at',

  actividades:          'id, criterio_trimestre_id, campo, fecha, deleted_at',
  entregas:             'id, actividad_id, alumno_id, [actividad_id+alumno_id], deleted_at',
  eval_rubrica:         'id, actividad_id, alumno_id, [actividad_id+alumno_id], deleted_at',
  examen_config:        'id, criterio_trimestre_id, deleted_at',
  resultados_examen:    'id, criterio_trimestre_id, alumno_id, [criterio_trimestre_id+alumno_id], deleted_at',
  cierres:              'id, trimestre_id, alumno_id, [trimestre_id+alumno_id], deleted_at',

  outbox:               '++seq, tabla, registro_id',
})
```

`version(2)` **elimina** `calificaciones` y redefine `actividades`: la
`Actividad` del prototipo no tenía `criterio_trimestre_id`, así que ninguna fila
vieja es válida en el modelo nuevo. No hay conversión que escribir porque no hay
nada que convertir: la pantalla de calificaciones nunca se construyó y **ninguna
ruta de código escribió jamás en esas dos tablas** —no existió adaptador, puerto
ni caso de uso que las tocara—, así que están vacías por construcción y no por
suposición. El `upgrade()` limpia `actividades` de todos modos y avisa por consola
si encontró algo, que es el cinturón sobre los tirantes.

La migración está probada en `src/data/dexie/migracion.test.ts`: levanta una base
con el esquema viejo y un mes de asistencia capturada, la abre con el esquema
nuevo y verifica que no se pierda un solo registro. Es la única forma de ensayar
esto sin arriesgar el ciclo escolar en el dispositivo real.

Las tablas de participación (`participaciones`) **no entran** en `version(2)`:
el criterio está pospuesto y una tabla vacía no se agrega por adelantado. Cuando
se retome, será `version(3)` — agregar una tabla nueva sí es una migración
barata.

Notas sobre los índices:

- `[fecha+alumno_id]` es el índice que sostiene la pantalla de asistencia:
  garantiza un solo registro por alumno por día y permite el upsert directo.
- `[actividad_id+alumno_id]` y `[criterio_trimestre_id+alumno_id]` hacen lo mismo
  para la captura de evaluación: un registro por alumno por actividad, upsert
  directo, sin duplicados posibles.
- `outbox` es la única tabla con clave autoincremental, y es correcto: es local,
  efímera y nunca se sincroniza como contenido.
- Los índices sobre `deleted_at` **no** sirven para encontrar los registros
  vivos: IndexedDB no admite `null` como clave, así que un registro con
  `deleted_at: null` simplemente no aparece en ese índice. Sirven para lo
  contrario —listar los borrados— y el filtro de vivos se hace en memoria, que
  con 30 alumnos no cuesta nada. Si algún día la tabla crece, la salida es un
  campo `vivo: 0 | 1` indexable, no este índice.

## Outbox

```ts
export const TABLAS_SINCRONIZABLES = ['alumnos', 'asistencia', /* … */] as const
export type TablaSincronizable = (typeof TABLAS_SINCRONIZABLES)[number]

export interface CambioPendiente {
  seq?: number
  tabla: TablaSincronizable
  registro_id: Id
  op: 'upsert' | 'delete'
  at: Instante
}
```

Toda mutación encola en la **misma transacción** que la escritura. Si la
transacción falla, no queda un cambio pendiente huérfano:

```ts
await db.transaction('rw', db.asistencia, db.outbox, async () => {
  await db.asistencia.put(registro)
  await db.outbox.add({
    tabla: 'asistencia',
    registro_id: registro.id,
    op: 'upsert',
    at: new Date().toISOString(),
  })
})
```

Con quince tablas, la unión escrita a mano se cambió por un arreglo `as const`
junto al esquema: agregar una tabla se hace en un solo lugar y el tipo sigue
cerrado, así que un `tabla: 'califcaciones'` mal escrito sigue siendo un error de
compilación. `outbox` no está en la lista: es local y nunca se sincroniza como
contenido.

# Reglas de dominio

Funciones puras, sin acceso a base de datos, testeables sin montar nada. Todas
devuelven `null` cuando no hay datos suficientes, nunca `0`.

Están repartidas en tres archivos por cohesión, igual que `fechas.ts` se separó
de `rules.ts`: `rules.ts` para asistencia, `evaluacion.ts` para la estructura de
la evaluación —qué trimestre le toca a una fecha, si los pesos cierran, si un
periodo acepta escrituras— y la cadena de cálculo de calificaciones, que llega en
C28.

Construidas hoy, en `rules.ts`:

```ts
/** Retardo y justificada cuentan como asistencia. */
export function cuentaComoAsistencia(estado: EstadoAsistencia): boolean {
  return estado !== 'ausente'
}

export function porcentajeAsistencia(registros: RegistroAsistencia[]): number

/** null cuando no hay calificaciones. Nunca 0. */
export function promedioDe(valores: number[]): number | null
```

Construidas hoy, en `evaluacion.ts` (C18):

```ts
export function sumaDePesos(cts: CriterioTrimestre[]): number
export function pesosSuman100(cts: CriterioTrimestre[]): boolean
export function rangoValido(t: Trimestre): boolean
export function contieneFecha(t: Trimestre, f: Fecha): boolean
export function trimestreDeFecha(f: Fecha, ts: Trimestre[]): Trimestre | null
export function seTraslapan(a: Trimestre, b: Trimestre): boolean
export function traslapes(ts: Trimestre[]): [Trimestre, Trimestre][]
export function aceptaEscrituras(t: Trimestre): boolean
export function puedeCerrarse(t: Trimestre, cts: CriterioTrimestre[]): boolean
```

Los parámetros piden solo los campos que usan (`Pick<...>`) en lugar de la
entidad completa: una entidad la satisface por estructura, así que no cuesta nada
en los llamadores, y las pruebas no tienen que inventar `id`, `updated_at` y
`deleted_at` para preguntar si dos rangos se traslapan.

`traslapes()` devuelve los pares y no un booleano para que la pantalla pueda decir
*cuáles* chocan. Compara solo trimestres del mismo `ciclo_id`: en una base con
historia, dos ciclos distintos no compiten por una fecha.

Pendientes, la cadena de cálculo de C28:

```ts
export function valorConRubrica(niveles: number[]): number
export function valorSinRubrica(entregada: boolean): number
export function valorCriterio(valores: number[]): number | null
export function valorExamenPorCampo(aciertos: number, preguntas: number): number
export function valorExamenGeneral(res: ResultadoExamen, cfg: ExamenConfig): number
export function valorTrimestre(parciales: { peso: number; valor: number }[]): number | null
export function aBase10(valor: number): number
```

Pospuestas con los criterios automáticos:

```ts
export function valorPuntualidad(registros: RegistroAsistencia[]): number | null
export function valorConducta(notas: Nota[]): number | null
export function valorParticipacion(n: number, meta: number): number
```

`enRiesgo(pct, promedio)` sigue con el umbral del prototipo (asistencia < 90 %,
promedio < 6) y sigue siendo una suposición: el umbral real es uno de los
`[POR VALIDAR]` abiertos.

# Semilla

La lista entra por uno de dos caminos, y por ninguno se teclean 30 nombres:

1. **La semilla**, `src/data/seed/grupo.ts`, que carga el desarrollador. Corre al
   arrancar **solo si la base está vacía**: si ya hay grupo, no se toca.
2. **La carga desde Ajustes**, donde ella sube un PDF o una foto de la lista
   oficial y una IA la extrae (D-014). Revisa el resultado antes de guardar.

Los dos caminos terminan en `sembrar()`, que fusiona por `numero_lista`
conservando el `id`. La condición de "base vacía" del primero existe por eso: sin
ella, la semilla pisaría lo importado en el siguiente arranque, en silencio.

No hay CRUD de alumnos en la v1: no existe alta, baja ni edición uno por uno. La
lista entra completa o no entra.
