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

/** Campos base de todo registro sincronizable */
export interface Sincronizable {
  id: Id
  updated_at: Instante
  deleted_at: Instante | null
}
```

## Entidades

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

export interface Actividad extends Sincronizable {
  nombre: string
  campo: CampoFormativo    // [POR VALIDAR]
  fecha: Fecha
}

export interface Calificacion extends Sincronizable {
  alumno_id: Id
  actividad_id: Id
  valor: number            // entero 5–10 [POR VALIDAR]
}

export interface Nota extends Sincronizable {
  alumno_id: Id
  fecha: Fecha
  texto: string
}
```

### `[POR VALIDAR]` — campos formativos

```ts
export type CampoFormativo =
  | 'lenguajes'
  | 'saberes_pensamiento_cientifico'
  | 'etica_naturaleza_sociedades'
  | 'humano_comunitario'
```

Estos son los cuatro campos formativos de la Nueva Escuela Mexicana según mi
entendimiento, pero **no está confirmado** que sea así como su escuela organiza
la evaluación, ni que la agrupación por campo le sirva de algo en la práctica.
Confirmar antes de construir la pantalla de calificaciones.

### `[POR VALIDAR]` — escala de calificación

El prototipo asume enteros de 5 a 10, capturados con seis botones. Es la
decisión de UX más consecuente del proyecto (ver [UX.md](./UX.md)). Si ella usa
decimales — 8.5 — la captura por botones deja de funcionar y hay que rediseñar.

Confirmar también si en su grado la evaluación es numérica o descriptiva por
niveles de desempeño. Si es descriptiva, el modelo de `Calificacion` cambia por
completo.

## Esquema de Dexie

```ts
// data/dexie/db.ts
import Dexie, { type EntityTable } from 'dexie'

export const db = new Dexie('palomita') as Dexie & {
  alumnos: EntityTable<Alumno, 'id'>
  asistencia: EntityTable<RegistroAsistencia, 'id'>
  actividades: EntityTable<Actividad, 'id'>
  calificaciones: EntityTable<Calificacion, 'id'>
  notas: EntityTable<Nota, 'id'>
  outbox: EntityTable<CambioPendiente, 'seq'>
}

db.version(1).stores({
  alumnos:        'id, numero_lista, deleted_at',
  asistencia:     'id, fecha, alumno_id, [fecha+alumno_id], deleted_at',
  actividades:    'id, fecha, campo, deleted_at',
  calificaciones: 'id, actividad_id, alumno_id, [actividad_id+alumno_id], deleted_at',
  notas:          'id, alumno_id, fecha, deleted_at',
  outbox:         '++seq, tabla, registro_id',
})
```

Notas sobre los índices:

- `[fecha+alumno_id]` es el índice que sostiene la pantalla de asistencia:
  garantiza un solo registro por alumno por día y permite el upsert directo.
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
export interface CambioPendiente {
  seq?: number
  tabla: 'alumnos' | 'asistencia' | 'actividades' | 'calificaciones' | 'notas'
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

## Reglas de dominio

Funciones puras en `domain/rules.ts`. Sin acceso a base de datos, testeables
sin montar nada.

```ts
/** Retardo y justificada cuentan como asistencia. */
export function cuentaComoAsistencia(estado: EstadoAsistencia): boolean {
  return estado !== 'ausente'
}

export function porcentajeAsistencia(registros: RegistroAsistencia[]): number

/** null cuando no hay calificaciones. Nunca 0. */
export function promedioDe(valores: number[]): number | null

/** [POR VALIDAR] umbrales */
export function enRiesgo(pct: number, promedio: number | null): boolean
```

El umbral de riesgo del prototipo (asistencia < 90 %, promedio < 6) es una
suposición. Ella sabe cuál es el criterio que su escuela usa.

## Semilla

La lista real de sus alumnos se carga **una vez, por el desarrollador**, desde
un archivo en `src/data/seed/grupo.ts`. Ella no importa nada, no teclea 30
nombres y no pasa por una pantalla de alta.

Cuando cambie el ciclo escolar, se edita el archivo y se despliega. No hay CRUD
de alumnos en la v1.
