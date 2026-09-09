import { repos } from '@/data'
import type { Alumno, RegistroAsistencia } from '@/domain/entities'
import { rangoDeLaSemana } from '@/domain/fechas'
import type { Fecha } from '@/domain/values'
import type { DocumentoPdf } from '@/services/pdf'

import { contarAsistentesPorSexo, filasDelDia } from './asistencia'

/**
 * Las asistencias de la semana, partidas por sexo.
 *
 * Es la cuenta que la hoja oficial pide al pie de cada día —«H: __ M: __ T: __»—
 * sumada de lunes a viernes, que hasta ahora se hacía a mano sobre la pantalla de
 * asistencia día por día.
 *
 * **Cuenta asistencias, no faltas** (docs/DECISIONES.md D-032): lo que la hoja
 * pregunta es cuántos niños y cuántas niñas vinieron, y ese dato no debería
 * depender de a quién le tocó faltar. La falta sigue estando, como cifra
 * secundaria y **sin corte por sexo**: un solo desglose, o vuelven a ser dos
 * números que hay que explicar.
 *
 * **Asistir es no estar ausente.** El retardo y la justificada cuentan, igual que
 * en el contador diario (`cuentaComoAsistencia`). Una segunda definición de
 * asistencia en la misma app sería un número que no cuadra con el otro y que
 * nadie sabría cuál creer.
 *
 * **Cuenta asistencias, no alumnos**: quien vino lunes y martes suma dos. Es lo
 * que hace que los días sumen exactamente el total de la semana, así que la
 * cuenta se verifica a la vista sin tener que explicarla (docs/UX.md).
 */

/** Un día de la semana, con su cuenta. Solo existe si hubo registros. */
export interface AsistenciasDelDia {
  fecha: Fecha
  asistencias: number
  ninos: number
  ninas: number
  /** Los que asistieron y todavía no tienen sexo asignado. */
  sinAsignar: number
  /** Cuántos alumnos había ese día: `asistencias + faltas`, por construcción. */
  posibles: number
  /** Los que no vinieron. Sin corte por sexo, a propósito: el desglose es uno. */
  faltas: number
  /**
   * **Quiénes** faltaron ese día, en el orden del grupo —alfabético, D-030—.
   *
   * Se nombra al que faltó y no al que vino, aunque la cifra sea de asistencias:
   * dos o tres nombres son el dato accionable de la semana, y los otros treinta
   * llenarían tres hojas para repetir lo que la cifra ya dijo.
   */
  ausentes: Alumno[]
}

/** La semana entera: el total arriba y el detalle debajo. */
export interface ReporteDeAsistencias {
  desde: Fecha
  hasta: Fecha
  /** Asistencias de toda la semana. Es la suma exacta de `dias`. */
  asistencias: number
  ninos: number
  ninas: number
  sinAsignar: number
  /** El total posible de la semana, que es el denominador de la cifra grande. */
  posibles: number
  faltas: number
  /**
   * Un renglón por día **con registros**. Un festivo o un día que todavía no se
   * captura no sale en cero: «vinieron todos» y «no se pasó lista» no son lo
   * mismo, y un cero diría la primera cuando pasa la segunda.
   */
  dias: AsistenciasDelDia[]
}

/**
 * Cruza el grupo con los registros de la semana.
 *
 * Cada día se arma con las mismas dos funciones que pintan la pantalla de
 * asistencia —`filasDelDia` y `contarAsistentesPorSexo`—, así que el reporte y el
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
export function armarAsistenciasDeLaSemana(
  alumnos: readonly Alumno[],
  registros: readonly RegistroAsistencia[],
  lunes: Fecha,
): ReporteDeAsistencias {
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
      const { ninos, ninas, sinAsignar } = contarAsistentesPorSexo(filas)
      // De las mismas filas que la cuenta, y con el mismo criterio que
      // `contarAsistentesPorSexo`: falta es solo `ausente`. Dos maneras de
      // decidir quién vino acabarían en una lista que no cuadra con su cifra.
      const ausentes = filas.filter((f) => f.estado === 'ausente').map((f) => f.alumno)
      return {
        fecha,
        asistencias: ninos + ninas + sinAsignar,
        ninos,
        ninas,
        sinAsignar,
        posibles: filas.length,
        faltas: ausentes.length,
        ausentes,
      }
    })

  const sumar = (campo: keyof Omit<AsistenciasDelDia, 'fecha' | 'ausentes'>) =>
    dias.reduce((total, d) => total + d[campo], 0)

  return {
    desde,
    hasta,
    asistencias: sumar('asistencias'),
    ninos: sumar('ninos'),
    ninas: sumar('ninas'),
    sinAsignar: sumar('sinAsignar'),
    posibles: sumar('posibles'),
    faltas: sumar('faltas'),
    dias,
  }
}

/**
 * La semana completa, lista para pintar. La única función del módulo que lee.
 *
 * Lee `lista()` y no `conBajas()`: quien ya no está en el grupo ni asiste ni
 * falta. Es lo mismo que hace el contador diario, y lo correcto para una semana
 * en curso —el reporte del trimestre, que sí tiene que enseñar a los que se
 * fueron, lo decide en `armarReporte` y por su cuenta (D-026)—.
 */
export async function asistenciasDeLaSemana(lunes: Fecha): Promise<ReporteDeAsistencias> {
  const { desde, hasta } = rangoDeLaSemana(lunes)
  const [alumnos, registros] = await Promise.all([
    repos.alumnos.lista(),
    repos.asistencia.porRango(desde, hasta),
  ])
  return armarAsistenciasDeLaSemana(alumnos, registros, lunes)
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
 * «2 niños · 1 niña · 3 faltas»: junta las partes que traen algo.
 *
 * Filtrar antes de unir es la misma regla de `frasePorSexo`, y por lo mismo: una
 * parte vacía sin filtrar deja un separador suelto, y «2 niños · » en una hoja
 * impresa parece que se perdió algo.
 */
function unaLinea(partes: (string | undefined)[]): string {
  return partes.filter((p) => p !== undefined && p.trim() !== '').join(' · ')
}

/**
 * El reporte en papel.
 *
 * Vive aquí y no en la pantalla porque es el mismo reporte: si la pantalla armara
 * el PDF por su cuenta, tarde o temprano dirían números distintos, y el que se
 * entrega en dirección sería el que nadie revisó. Aquí se prueba con el resto.
 *
 * Es una función pura y recibe ya escrito lo que se lee —las fechas, la frase por
 * sexo, la de faltas—: `application/` no formatea fechas ni concuerda plurales,
 * eso vive en `ui/lib/` (docs/ARCHITECTURE.md). Lo que pone aquí es **qué** va en
 * la hoja y en qué orden, que es la decisión del reporte y no de la pantalla.
 */
export function asistenciasComoDocumento(
  reporte: ReporteDeAsistencias,
  textos: {
    /** El periodo, escrito como se dice: «del 7 al 11 de septiembre de 2026». */
    periodo: string
    /** El nombre que la usuaria le puso al grupo, si le puso alguno. */
    grupo: string
    /** «2 niños · 1 niña · 1 sin asignar», de toda la semana. */
    porSexo: string
    /** «3 faltas», de toda la semana. Vacío si no hubo ninguna. */
    faltas: string
    /** Cada día, con su fecha escrita, su frase por sexo y sus faltas. */
    dias: { fecha: string; porSexo: string; faltas: string }[]
    nota: string
  },
): DocumentoPdf {
  const detalleDeLaSemana = unaLinea([textos.porSexo, textos.faltas])

  return {
    titulo: 'Asistencias de la semana',
    // El grupo primero, porque una hoja impresa se separa de su iPad: fuera de la
    // pantalla, «del 7 al 11» no dice de quién es.
    subtitulo:
      textos.grupo.trim() === '' ? textos.periodo : `${textos.grupo} · ${textos.periodo}`,
    bloques: [
      {
        tipo: 'cifra',
        // Con denominador: «138» sola no se puede juzgar y «138 / 150» sí. Es la
        // misma forma que la cifra grande de la pantalla de asistencia, que ya se
        // lee así todos los días.
        valor: `${reporte.asistencias} / ${reporte.posibles}`,
        leyenda: reporte.asistencias === 1 ? 'asistencia esta semana' : 'asistencias esta semana',
        // Vacío no se pinta: un renglón en blanco en una hoja impresa parece que
        // se perdió algo.
        ...(detalleDeLaSemana === '' ? {} : { detalle: detalleDeLaSemana }),
      },
      {
        tipo: 'tabla',
        encabezados: { izquierda: 'día', derecha: 'asisten' },
        filas: reporte.dias.map((dia, i) => {
          const detalle = unaLinea([textos.dias[i]?.porSexo, textos.dias[i]?.faltas])
          return {
            etiqueta: textos.dias[i]?.fecha ?? dia.fecha,
            valor: String(dia.asistencias),
            ...(detalle === '' ? {} : { detalle }),
            // Los nombres se arman aquí y no los pasa la pantalla: un número y un
            // nombre no son un formato, son el dato. Lo que sí pasa la pantalla es
            // lo que hay que escribir en español —las fechas, las frases—.
            ...(dia.ausentes.length === 0 ? {} : { lineas: dia.ausentes.map(comoRenglon) }),
          }
        }),
      },
      { tipo: 'nota', texto: textos.nota },
    ],
  }
}
