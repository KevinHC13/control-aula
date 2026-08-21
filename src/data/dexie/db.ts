import Dexie, { type EntityTable } from 'dexie'

import type {
  Actividad,
  Alumno,
  CierreTrimestre,
  Ciclo,
  Criterio,
  CriterioTrimestre,
  Entrega,
  EvaluacionRubrica,
  ExamenConfig,
  Participacion,
  RegistroAsistencia,
  Reporte,
  ResultadoExamen,
  Rubrica,
  RubricaCriterio,
  Trimestre,
} from '@/domain/entities'
import type { Id, Instante } from '@/domain/values'

/**
 * Las tablas cuyo contenido se sincroniza. `outbox` no está: es local y efímera.
 *
 * Existe como arreglo y no como unión escrita a mano para que agregar una tabla
 * se haga en un solo lugar. Con dieciséis tablas, mantener al día una unión
 * literal aparte del esquema es trabajo que no compra nada.
 */
export const TABLAS_SINCRONIZABLES = [
  'alumnos',
  'asistencia',
  'bitacora',
  'participaciones',
  'ciclos',
  'trimestres',
  'criterios',
  'criterios_trimestre',
  'rubricas',
  'rubrica_criterios',
  'actividades',
  'entregas',
  'eval_rubrica',
  'examen_config',
  'resultados_examen',
  'cierres',
] as const

export type TablaSincronizable = (typeof TABLAS_SINCRONIZABLES)[number]

/**
 * La versión del esquema local. Vive junto al esquema y no como un número
 * escrito a mano en el respaldo: el archivo lo lleva dentro para poder rechazar
 * uno hecho con una versión más nueva de la app (C14).
 */
export const VERSION_ESQUEMA = 3

/**
 * Una fila de la bitácora de cambios por subir. Vive en la capa de datos y no
 * en `domain/`: es un detalle local del dispositivo, nunca se sincroniza como
 * contenido y desaparece cuando el motor de sincronía la sube.
 */
export interface CambioPendiente {
  seq?: number
  tabla: TablaSincronizable
  registro_id: Id
  op: 'upsert' | 'delete'
  at: Instante
}

export const db = new Dexie('palomita') as Dexie & {
  alumnos: EntityTable<Alumno, 'id'>
  asistencia: EntityTable<RegistroAsistencia, 'id'>
  bitacora: EntityTable<Reporte, 'id'>
  participaciones: EntityTable<Participacion, 'id'>

  ciclos: EntityTable<Ciclo, 'id'>
  trimestres: EntityTable<Trimestre, 'id'>
  criterios: EntityTable<Criterio, 'id'>
  criterios_trimestre: EntityTable<CriterioTrimestre, 'id'>

  rubricas: EntityTable<Rubrica, 'id'>
  rubrica_criterios: EntityTable<RubricaCriterio, 'id'>

  actividades: EntityTable<Actividad, 'id'>
  entregas: EntityTable<Entrega, 'id'>
  eval_rubrica: EntityTable<EvaluacionRubrica, 'id'>
  examen_config: EntityTable<ExamenConfig, 'id'>
  resultados_examen: EntityTable<ResultadoExamen, 'id'>
  cierres: EntityTable<CierreTrimestre, 'id'>

  outbox: EntityTable<CambioPendiente, 'seq'>
}

db.version(1).stores({
  alumnos: 'id, numero_lista, deleted_at',
  asistencia: 'id, fecha, alumno_id, [fecha+alumno_id], deleted_at',
  actividades: 'id, fecha, campo, deleted_at',
  calificaciones: 'id, actividad_id, alumno_id, [actividad_id+alumno_id], deleted_at',
  notas: 'id, alumno_id, fecha, deleted_at',
  outbox: '++seq, tabla, registro_id',
})

/**
 * La jerarquía de evaluación (docs/DATA-MODEL.md). Va completa en una sola
 * versión a propósito: es una migración sobre el iPad con los datos reales del
 * salón, y hacerla por partes multiplica las ocasiones de romperlo.
 *
 * `calificaciones` se elimina y `actividades` se redefine: la `Actividad` del
 * prototipo no tenía `criterio_trimestre_id`, así que ninguna fila vieja sería
 * válida en el modelo nuevo. No hay conversión que escribir porque no hay nada
 * que convertir — la pantalla de calificaciones nunca se construyó y **ninguna
 * ruta de código escribió jamás en esas dos tablas**, así que están vacías por
 * construcción, no por suposición. El `clear()` del upgrade es el cinturón sobre
 * los tirantes.
 *
 * `participaciones` no entra: el criterio está pospuesto y una tabla vacía no se
 * agrega por adelantado. Cuando se retome será `version(3)`, que es una
 * migración barata.
 */
db.version(2)
  .stores({
    calificaciones: null,

    ciclos: 'id, estado, deleted_at',
    trimestres: 'id, ciclo_id, numero, inicio, fin, estado, deleted_at',
    criterios: 'id, tipo, deleted_at',
    criterios_trimestre:
      'id, trimestre_id, criterio_id, [trimestre_id+orden], deleted_at',

    rubricas: 'id, deleted_at',
    rubrica_criterios: 'id, rubrica_id, [rubrica_id+orden], deleted_at',

    actividades: 'id, criterio_trimestre_id, campo, fecha, deleted_at',
    entregas: 'id, actividad_id, alumno_id, [actividad_id+alumno_id], deleted_at',
    eval_rubrica: 'id, actividad_id, alumno_id, [actividad_id+alumno_id], deleted_at',
    examen_config: 'id, criterio_trimestre_id, deleted_at',
    resultados_examen:
      'id, criterio_trimestre_id, alumno_id, [criterio_trimestre_id+alumno_id], deleted_at',
    cierres: 'id, trimestre_id, alumno_id, [trimestre_id+alumno_id], deleted_at',
  })
  .upgrade(async (tx) => {
    const viejas = await tx.table('actividades').count()
    if (viejas > 0) {
      // No debería pasar: no existe código que las haya escrito. Si pasa, queda
      // dicho en la consola en vez de desaparecer en silencio.
      console.warn(
        `[palomita] version(2) descartó ${viejas} actividades del prototipo, ` +
          'sin criterio_trimestre_id.',
      )
      await tx.table('actividades').clear()
    }
  })

/**
 * La bitácora y las participaciones (docs/DECISIONES.md D-020).
 *
 * `notas` pasa a llamarse `bitacora` porque cambió de significado, no solo de
 * nombre: todo lo que se anota ahí es un **reporte** y de ahí sale la
 * calificación de conducta. La tabla nunca tuvo pantalla —el placeholder no
 * escribía— así que está vacía en el iPad; el `upgrade` copia igual las filas que
 * hubiera antes de que Dexie borre la tabla vieja, porque una migración que da por
 * hecho que no hay nada que migrar es la que pierde datos.
 *
 * `participaciones` entra aquí y no cuando se use (C25): la migración del
 * dispositivo se hace una vez, y partirla en dos versiones multiplica las
 * ocasiones de romper la base por una tabla vacía.
 *
 * `retardos_por_falta` en `criterios_trimestre` no aparece abajo porque es un
 * campo, no un índice: Dexie no lo declara y las filas viejas lo leen como
 * `undefined`, que el cálculo trata igual que `null` —un retardo no penaliza—.
 */
db.version(VERSION_ESQUEMA)
  .stores({
    notas: null,
    bitacora: 'id, alumno_id, fecha, deleted_at',
    participaciones: 'id, fecha, alumno_id, [fecha+alumno_id], deleted_at',
  })
  .upgrade(async (tx) => {
    const viejas = await tx.table('notas').toArray()
    if (viejas.length === 0) return

    await tx.table('bitacora').bulkAdd(viejas)
    console.warn(`[palomita] version(3) movió ${viejas.length} notas a bitacora.`)
  })

/**
 * ID de un registro nuevo. Siempre UUID del cliente, nunca autoincremento: con
 * enteros locales dos dispositivos generan el mismo `id: 1` y el respaldo se
 * corrompe al restaurar (docs/DATA-MODEL.md).
 *
 * Ojo: `crypto.randomUUID()` requiere contexto seguro. Funciona en HTTPS y en
 * `localhost`, pero **no** en `http://192.168.x.x`, así que probar en el iPad
 * por red local rompe la creación del primer registro (docs/PWA-IOS.md).
 */
export function nuevoId(): Id {
  return crypto.randomUUID()
}

/**
 * Marca de tiempo para `updated_at`, en ISO 8601 UTC. Se escribe en cada
 * mutación, sin excepción: es lo único que le dice al motor de sincronía qué
 * falta subir (docs/DATA-MODEL.md).
 *
 * Existe como función, y no como `new Date().toISOString()` suelto en cada
 * adaptador, para que el formato sea uno solo y las pruebas puedan congelarlo.
 */
export function ahora(): Instante {
  return new Date().toISOString()
}
