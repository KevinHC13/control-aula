import { repos } from '@/data'
import type { Alumno, RegistroAsistencia } from '@/domain/entities'
import { cuentaComoAsistencia, siguienteEstado } from '@/domain/rules'
import type { EstadoAsistencia, Fecha, Id } from '@/domain/values'

/**
 * Una fila de la pantalla de asistencia. `registrado` distingue "presente
 * porque así se capturó" de "presente porque es el valor por defecto y nadie
 * ha tocado este día": lo primero es un dato, lo segundo todavía no.
 */
export interface FilaAsistencia {
  alumno: Alumno
  estado: EstadoAsistencia
  registrado: boolean
}

/**
 * Cruza el grupo con los registros del día. Un alumno sin registro sale
 * `presente`: al abrir el día todos están presentes y solo se toca a los dos o
 * tres que faltaron (docs/UX.md).
 *
 * Función pura: no lee la base. Abrir un día sin registros no falla ni escribe
 * nada — navegar entre días es de solo lectura.
 */
export function filasDelDia(
  alumnos: Alumno[],
  registros: RegistroAsistencia[],
): FilaAsistencia[] {
  const porAlumno = new Map(registros.map((r) => [r.alumno_id, r]))

  return alumnos.map((alumno) => {
    const registro = porAlumno.get(alumno.id)
    return {
      alumno,
      estado: registro?.estado ?? 'presente',
      registrado: registro !== undefined,
    }
  })
}

/** Presentes sobre total del día, que es la única cifra de la pantalla. */
export function contarPresentes(filas: FilaAsistencia[]): {
  presentes: number
  total: number
} {
  return {
    presentes: filas.filter((f) => cuentaComoAsistencia(f.estado)).length,
    total: filas.length,
  }
}

/** El día completo, listo para pintar. */
export async function asistenciaDelDia(fecha: Fecha): Promise<FilaAsistencia[]> {
  const [alumnos, registros] = await Promise.all([
    repos.alumnos.lista(),
    repos.asistencia.porDia(fecha),
  ])
  return filasDelDia(alumnos, registros)
}

/**
 * Avanza el estado de un alumno un paso en el ciclo y lo guarda. Devuelve el
 * estado que quedó, para que quien llama no tenga que recalcularlo.
 *
 * Recibe el estado actual en vez de leerlo: la pantalla ya lo tiene fresco por
 * suscripción, y un viaje extra a la base por cada toque es justo lo que el
 * presupuesto de 15 segundos no puede pagar.
 */
export async function marcarEstado(
  alumnoId: Id,
  fecha: Fecha,
  estadoActual: EstadoAsistencia,
): Promise<EstadoAsistencia> {
  const nuevo = siguienteEstado(estadoActual)
  await repos.asistencia.marcar(alumnoId, fecha, nuevo)
  return nuevo
}

/**
 * Deja el día registrado: los alumnos sin registro quedan en `presente`, los
 * que ya tienen uno no se tocan. Idempotente — llamarlo dos veces no duplica ni
 * revierte lo capturado.
 */
export async function pasarLista(fecha: Fecha): Promise<void> {
  const alumnos = await repos.alumnos.lista()
  await repos.asistencia.pasarLista(
    fecha,
    alumnos.map((a) => a.id),
  )
}
