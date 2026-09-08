import { repos } from '@/data'
import type { Alumno, RegistroAsistencia } from '@/domain/entities'
import { rangoDeLaSemana } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'
import type { DocumentoPdf } from '@/services/pdf'

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
  /**
   * **Quiénes** faltaron ese día, en el orden del grupo —alfabético, D-030—.
   *
   * Es lo que convierte el reporte en algo que se puede discutir: una cifra dice
   * que faltaron tres, y solo los nombres dejan comprobar cuáles tres. Sale de
   * las mismas filas que la cuenta, así que `ausentes.length` es `faltas` por
   * construcción y no por casualidad.
   */
  ausentes: Alumno[]
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
      const filas = filasDelDia([...alumnos], delDia)
      const { ninos, ninas, sinAsignar } = contarFaltantesPorSexo(filas)
      return {
        fecha,
        faltas: ninos + ninas + sinAsignar,
        ninos,
        ninas,
        sinAsignar,
        // De las mismas filas que la cuenta, y con el mismo criterio que
        // `contarFaltantesPorSexo`: solo `ausente`. Dos maneras de decidir quién
        // faltó acabarían en una lista que no cuadra con su cifra.
        ausentes: filas.filter((f) => f.estado === 'ausente').map((f) => f.alumno),
      }
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

/**
 * Un alumno en la lista de ausentes: el número primero, como en la hoja oficial.
 *
 * El número no sobra por llevar el nombre al lado: es por donde se cotejan estas
 * faltas contra la lista de la escuela, que va numerada.
 */
function comoRenglon(alumno: Alumno): string {
  // El número, ajustado a dos cifras: sin esto, «1» y «39» empiezan el nombre en
  // sitios distintos y la lista se lee en zigzag. Un espacio de Helvetica no mide
  // lo mismo que un dígito, así que no cuadra al pelo —quedan tres milésimas de
  // diferencia, que a diez puntos no se ven—.
  return `${String(alumno.numero_lista).padStart(2, ' ')} · ${alumno.nombre}`
}

/**
 * El reporte en papel.
 *
 * Vive aquí y no en la pantalla porque es el mismo reporte: si la pantalla armara
 * el PDF por su cuenta, tarde o temprano dirían números distintos, y el que se
 * entrega en dirección sería el que nadie revisó. Aquí se prueba con el resto.
 *
 * Es una función pura y recibe ya escrito lo que se lee —las fechas, la frase por
 * sexo—: `application/` no formatea fechas, eso vive en `ui/lib/fechas.ts`
 * (docs/ARCHITECTURE.md). Lo que pone aquí es **qué** va en la hoja y en qué
 * orden, que es la decisión del reporte y no de la pantalla.
 */
export function faltasComoDocumento(
  reporte: ReporteDeFaltas,
  textos: {
    /** El periodo, escrito como se dice: «del 7 al 11 de septiembre de 2026». */
    periodo: string
    /** El nombre que la usuaria le puso al grupo, si le puso alguno. */
    grupo: string
    /** «2 niños · 1 niña · 1 sin asignar», de toda la semana. */
    porSexo: string
    /** Cada día, con su fecha escrita y su frase por sexo. */
    dias: { fecha: string; porSexo: string }[]
    nota: string
  },
): DocumentoPdf {
  return {
    titulo: 'Faltas de la semana',
    // El grupo primero, porque una hoja impresa se separa de su iPad: fuera de la
    // pantalla, «del 7 al 11» no dice de quién es.
    subtitulo:
      textos.grupo.trim() === '' ? textos.periodo : `${textos.grupo} · ${textos.periodo}`,
    bloques: [
      {
        tipo: 'cifra',
        valor: String(reporte.faltas),
        leyenda: reporte.faltas === 1 ? 'falta esta semana' : 'faltas esta semana',
        // Vacío no se pinta: un renglón en blanco en una hoja impresa parece que
        // se perdió algo.
        ...(textos.porSexo === '' ? {} : { detalle: textos.porSexo }),
      },
      {
        tipo: 'tabla',
        encabezados: { izquierda: 'día', derecha: 'faltas' },
        filas: reporte.dias.map((dia, i) => ({
          etiqueta: textos.dias[i]?.fecha ?? dia.fecha,
          valor: String(dia.faltas),
          ...(textos.dias[i]?.porSexo === undefined || textos.dias[i]?.porSexo === ''
            ? {}
            : { detalle: textos.dias[i]!.porSexo }),
          // Los nombres se arman aquí y no los pasa la pantalla: un número y un
          // nombre no son un formato, son el dato. Lo que sí pasa la pantalla es
          // lo que hay que escribir en español —las fechas, la frase por sexo—.
          ...(dia.ausentes.length === 0 ? {} : { lineas: dia.ausentes.map(comoRenglon) }),
        })),
      },
      { tipo: 'nota', texto: textos.nota },
    ],
  }
}
