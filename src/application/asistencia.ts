import { repos } from '@/data'
import type { Alumno, RegistroAsistencia } from '@/domain/entities'
import { diasDelMes } from '@/domain/fechas'
import { cuentaComoAsistencia, siguienteEstado } from '@/domain/rules'
import type { EstadoAsistencia, Fecha, Id, Mes } from '@/domain/values'

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

/** Los que faltaron, partidos por sexo. */
export interface FaltantesPorSexo {
  ninos: number
  ninas: number
  /** Los que faltaron y todavía no tienen sexo asignado. */
  sinAsignar: number
}

/**
 * Cuántos niños y cuántas niñas faltaron hoy.
 *
 * Es la cifra que la hoja oficial pide al pie de cada día —«H: __  M: __  T:
 * __»— y que hasta ahora se contaba a mano sobre la pantalla.
 *
 * **Solo `ausente`.** Retardo y justificada cuentan como asistencia
 * (`cuentaComoAsistencia`), y lo que se copia a la hoja es quién no vino.
 *
 * `sinAsignar` sale aparte y no se reparte entre los otros dos: un alumno sin
 * sexo no es medio niño. Vale más un hueco que se ve que dos cifras que suman
 * bien y mienten.
 *
 * Función pura: no lee la base.
 */
export function contarFaltantesPorSexo(filas: FilaAsistencia[]): FaltantesPorSexo {
  const faltaron = filas.filter((f) => f.estado === 'ausente')

  return {
    ninos: faltaron.filter((f) => f.alumno.sexo === 'H').length,
    ninas: faltaron.filter((f) => f.alumno.sexo === 'M').length,
    sinAsignar: faltaron.filter((f) => f.alumno.sexo === null).length,
  }
}

/**
 * Un día visto desde el calendario. `registrado` distingue un día que todavía no
 * se capturó de uno capturado sin faltas: el primero es un hueco, el segundo es
 * un día bueno, y pintarlos igual sería mentir.
 */
export interface DiaDelMes {
  fecha: Fecha
  registrado: boolean
  ausentes: number
  total: number
}

/**
 * Un renglón por día del mes, tenga registros o no. Los días sin capturar salen
 * en la lista porque el mosaico los pinta como huecos.
 *
 * Función pura: no lee la base.
 */
export function resumenDelMes(mes: Mes, registros: RegistroAsistencia[]): DiaDelMes[] {
  const porFecha = new Map<Fecha, RegistroAsistencia[]>()
  for (const registro of registros) {
    const delDia = porFecha.get(registro.fecha)
    if (delDia) delDia.push(registro)
    else porFecha.set(registro.fecha, [registro])
  }

  return diasDelMes(mes).map((fecha) => {
    const delDia = porFecha.get(fecha) ?? []
    return {
      fecha,
      registrado: delDia.length > 0,
      // Por la regla de dominio y no comparando contra 'ausente': retardo y
      // justificada cuentan como asistencia.
      ausentes: delDia.filter((r) => !cuentaComoAsistencia(r.estado)).length,
      total: delDia.length,
    }
  })
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
