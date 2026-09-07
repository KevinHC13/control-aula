import { repos } from '@/data'
import type { Alumno, RegistroAsistencia } from '@/domain/entities'
import { rangoDeLaSemana } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'

import { contarFaltantesPorSexo, filasDelDia } from './asistencia'

/**
 * Las faltas de la semana, partidas por sexo.
 *
 * Es la cuenta que la hoja oficial pide al pie de cada día —«H: __ M: __ T: __»—
 * sumada de lunes a viernes, que hasta ahora se hacía a mano sobre la pantalla de
 * asistencia día por día.
 *
 * **Falta es solo `ausente`.** Un retardo y una justificada cuentan como
 * asistencia (`cuentaComoAsistencia`), igual que en el contador diario: una
 * segunda definición de «falta» en la misma app sería un número que no cuadra con
 * el otro y que nadie sabría cuál creer.
 *
 * **Cuenta faltas, no alumnos**: quien faltó lunes y martes suma dos. Es lo que
 * hace que los días sumen exactamente el total de la semana, así que la cuenta se
 * verifica a la vista sin tener que explicarla (docs/UX.md).
 */

/** Un día de la semana, con su cuenta. Solo existe si hubo registros. */
export interface FaltasDelDia {
  fecha: Fecha
  faltas: number
  ninos: number
  ninas: number
  /** Los que faltaron y todavía no tienen sexo asignado. */
  sinAsignar: number
}

/** La semana entera: el total arriba y el detalle debajo. */
export interface ReporteDeFaltas {
  desde: Fecha
  hasta: Fecha
  /** Faltas de toda la semana. Es la suma exacta de `dias`. */
  faltas: number
  ninos: number
  ninas: number
  sinAsignar: number
  /**
   * Un renglón por día **con registros**. Un festivo o un día que todavía no se
   * captura no sale en cero: «nadie faltó» y «no se pasó lista» no son lo mismo,
   * y un cero diría la primera cuando pasa la segunda.
   */
  dias: FaltasDelDia[]
}

/**
 * Cruza el grupo con los registros de la semana.
 *
 * Cada día se arma con las mismas dos funciones que pintan la pantalla de
 * asistencia —`filasDelDia` y `contarFaltantesPorSexo`—, así que el reporte y el
 * contador diario no pueden discrepar: es literalmente la misma cuenta.
 *
 * Los totales son la **suma de los días** y no un recuento aparte. Dos caminos
 * hacia el mismo número es como aparece un total que no cuadra con su desglose.
 *
 * `sinAsignar` va por su lado y no se reparte: un alumno sin sexo no es medio
 * niño, y vale más un hueco que se ve que dos cifras que suman bien y mienten
 * (docs/DECISIONES.md D-029).
 *
 * Función pura: no lee la base.
 */
export function armarFaltasDeLaSemana(
  alumnos: readonly Alumno[],
  registros: readonly RegistroAsistencia[],
  lunes: Fecha,
): ReporteDeFaltas {
  const { desde, hasta } = rangoDeLaSemana(lunes)

  const porFecha = new Map<Fecha, RegistroAsistencia[]>()
  for (const registro of registros) {
    // Se acota aquí y no se confía en quien llamó: la pura tiene que dar el
    // mismo resultado le pasen la semana justa o el mes entero.
    if (registro.fecha < desde || registro.fecha > hasta) continue
    const delDia = porFecha.get(registro.fecha)
    if (delDia) delDia.push(registro)
    else porFecha.set(registro.fecha, [registro])
  }

  const dias = [...porFecha.entries()]
    // Comparar `Fecha` como cadena ordena bien: ISO-8601 con ceros a la
    // izquierda es lexicográficamente igual que cronológicamente.
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, delDia]) => {
      const { ninos, ninas, sinAsignar } = contarFaltantesPorSexo(
        filasDelDia([...alumnos], delDia),
      )
      return { fecha, faltas: ninos + ninas + sinAsignar, ninos, ninas, sinAsignar }
    })

  return {
    desde,
    hasta,
    faltas: dias.reduce((total, d) => total + d.faltas, 0),
    ninos: dias.reduce((total, d) => total + d.ninos, 0),
    ninas: dias.reduce((total, d) => total + d.ninas, 0),
    sinAsignar: dias.reduce((total, d) => total + d.sinAsignar, 0),
    dias,
  }
}

/**
 * La semana completa, lista para pintar. La única función del módulo que lee.
 *
 * Lee `lista()` y no `conBajas()`: quien ya no está en el grupo no falta. Es lo
 * mismo que hace el contador diario, y lo correcto para una semana en curso —el
 * reporte del trimestre, que sí tiene que enseñar a los que se fueron, lo decide
 * en `armarReporte` y por su cuenta (D-026)—.
 */
export async function faltasDeLaSemana(lunes: Fecha): Promise<ReporteDeFaltas> {
  const { desde, hasta } = rangoDeLaSemana(lunes)
  const [alumnos, registros] = await Promise.all([
    repos.alumnos.lista(),
    repos.asistencia.porRango(desde, hasta),
  ])
  return armarFaltasDeLaSemana(alumnos, registros, lunes)
}
