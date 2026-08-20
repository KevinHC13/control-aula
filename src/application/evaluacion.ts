import { repos } from '@/data'
import type { CicloEnCurso, EsquemaTrimestre, PeriodoNuevo } from '@/data/ports/evaluacion'
import type { TipoCriterio, Trimestre } from '@/domain/entities'
import {
  aceptaEscrituras,
  pesosSuman100,
  rangoValido,
  seTraslapan,
  sumaDePesos,
  trimestreDeFecha,
} from '@/domain/evaluacion'
import { fechaValida } from '@/domain/fechas'
import type { Fecha, Id } from '@/domain/values'

const NUMEROS = [1, 2, 3] as const

/**
 * Un trimestre en la pantalla de configuración: las fechas como texto —lo que
 * hay en el campo mientras se escribe— más lo que está mal con él.
 *
 * Mismo patrón que la pantalla de revisión de la lista (D-014): la validación
 * marca y no corrige, y guardar se bloquea mientras quede una marca. Corregir
 * mientras ella teclea le pelea al teclado a media palabra.
 */
export interface Periodo {
  numero: 1 | 2 | 3
  inicio: string
  fin: string
  /** Ausente cuando el periodo está bien. Mensaje para mostrar tal cual. */
  problema?: string
}

/** Los tres trimestres en blanco, que es como arranca la pantalla. */
export function periodosVacios(): Periodo[] {
  return NUMEROS.map((numero) => ({ numero, inicio: '', fin: '' }))
}

/** Los trimestres ya configurados, en la forma que la pantalla edita. */
export function periodosDe(trimestres: Trimestre[]): Periodo[] {
  return NUMEROS.map((numero) => {
    const trimestre = trimestres.find((t) => t.numero === numero)
    return {
      numero,
      inicio: trimestre?.inicio ?? '',
      fin: trimestre?.fin ?? '',
    }
  })
}

/**
 * Recalcula los problemas de los tres periodos. Corre en cada tecla, así que no
 * toca el texto: solo lo juzga.
 *
 * El traslape depende de los tres a la vez —revisar un periodo suelto no lo
 * detecta— y por eso la función recibe la lista completa, igual que `revalidar`
 * necesita la lista entera para marcar un número de lista repetido.
 */
export function revisarPeriodos(periodos: Periodo[]): Periodo[] {
  const completos = periodos.filter((p) => fechaValida(p.inicio) && fechaValida(p.fin))

  return periodos.map((periodo) => {
    const { numero, inicio, fin } = periodo
    const limpio = { numero, inicio, fin }
    const problema = revisar(limpio, completos)
    return problema ? { ...limpio, problema } : limpio
  })
}

function revisar(periodo: Periodo, completos: Periodo[]): string | undefined {
  if (periodo.inicio === '' || periodo.fin === '') return 'Faltan las fechas'
  if (!fechaValida(periodo.inicio) || !fechaValida(periodo.fin)) {
    return 'La fecha debe ser AAAA-MM-DD'
  }
  if (!rangoValido(periodo)) return 'Termina antes de empezar'

  const choque = completos.find(
    (otro) => otro.numero !== periodo.numero && seTraslapan(periodo, otro),
  )
  if (choque) return `Se traslapa con el trimestre ${choque.numero}`

  return undefined
}

/** Si los tres periodos están listos para guardarse. */
export function periodosCompletos(periodos: Periodo[]): boolean {
  return periodos.length === NUMEROS.length && periodos.every((p) => p.problema === undefined)
}

/**
 * El nombre del ciclo escolar al que pertenece una fecha: "2026–2027".
 *
 * El corte va en agosto porque el ciclo escolar mexicano empieza ahí. Es un valor
 * por omisión para no hacerla teclear lo que se puede deducir; el campo queda
 * editable porque el nombre es suyo, no del calendario.
 */
export function nombreDeCicloEn(fecha: Fecha): string {
  const anio = Number(fecha.slice(0, 4))
  const mes = Number(fecha.slice(5, 7))
  const primero = mes >= 8 ? anio : anio - 1
  return `${primero}–${primero + 1}`
}

/**
 * El trimestre al que pertenece una fecha, o `null` si cae fuera de todos.
 *
 * `null` es un resultado normal, no un error: las vacaciones y los puentes caen
 * fuera de todo rango. La atribución es automática —ella captura por fecha y
 * nunca elige trimestre— porque elegirlo sería un toque más en el camino diario
 * y una ocasión más de equivocarse.
 */
export function trimestreDe(fecha: Fecha, ciclo: CicloEnCurso | null): Trimestre | null {
  if (!ciclo) return null
  return trimestreDeFecha(fecha, ciclo.trimestres)
}

export async function cicloEnCurso(): Promise<CicloEnCurso | null> {
  return repos.evaluacion.cicloEnCurso()
}

/**
 * Abre el ciclo escolar con sus tres trimestres.
 *
 * Se niega si ya hay uno abierto: dos ciclos abiertos harían ambigua la
 * atribución de una fecha, que es justo lo que este commit existe para volver
 * inequívoco. Cambiar de ciclo es cerrar el anterior, y eso llega con el cierre
 * de trimestre (C27).
 */
export async function abrirCicloEscolar(nombre: string, periodos: Periodo[]): Promise<void> {
  const revisados = revisarPeriodos(periodos)
  if (!periodosCompletos(revisados)) {
    throw new Error('Los trimestres tienen fechas inválidas o traslapadas')
  }
  if (nombre.trim() === '') throw new Error('El ciclo necesita un nombre')

  if ((await repos.evaluacion.cicloEnCurso()) !== null) {
    throw new Error('Ya hay un ciclo escolar abierto')
  }

  await repos.evaluacion.abrirCiclo(
    nombre.trim(),
    revisados.map(
      (p): PeriodoNuevo => ({ numero: p.numero, inicio: p.inicio, fin: p.fin }),
    ),
  )
}

/**
 * Cambia el rango de un trimestre abierto.
 *
 * Un trimestre cerrado los rechaza: sus calificaciones ya salieron en una boleta,
 * y mover sus fechas movería registros de asistencia de un trimestre a otro
 * después del hecho. La pantalla además deshabilita los campos, pero la regla
 * vive aquí —el caso de uso es la única puerta a la escritura, y una pantalla
 * puede tener un error de un solo `disabled` olvidado—.
 */
export async function ajustarFechasTrimestre(
  trimestre: Trimestre,
  inicio: Fecha,
  fin: Fecha,
): Promise<void> {
  if (!aceptaEscrituras(trimestre)) {
    throw new Error('Un trimestre cerrado no admite cambios de fecha')
  }
  if (!fechaValida(inicio) || !fechaValida(fin)) {
    throw new Error('Las fechas deben ser AAAA-MM-DD')
  }
  if (!rangoValido({ inicio, fin })) {
    throw new Error('El trimestre no puede terminar antes de empezar')
  }

  await repos.evaluacion.ajustarFechas(trimestre.id, inicio, fin)
}

/**
 * Guarda los cambios de fechas de un ciclo ya configurado. Escribe solo los
 * trimestres que cambiaron y salta los cerrados sin fallar: guardar la pantalla
 * completa no debe reventar porque uno de los tres ya esté cerrado.
 */
export async function guardarFechas(
  ciclo: CicloEnCurso,
  periodos: Periodo[],
): Promise<void> {
  const revisados = revisarPeriodos(periodos)
  if (!periodosCompletos(revisados)) {
    throw new Error('Los trimestres tienen fechas inválidas o traslapadas')
  }

  for (const periodo of revisados) {
    const trimestre = ciclo.trimestres.find((t) => t.numero === periodo.numero)
    if (!trimestre) continue
    if (!aceptaEscrituras(trimestre)) continue
    if (trimestre.inicio === periodo.inicio && trimestre.fin === periodo.fin) continue

    await ajustarFechasTrimestre(trimestre, periodo.inicio, periodo.fin)
  }
}

/*
 * Criterios y pesos del trimestre (C20)
 * =====================================
 */

/**
 * Los tipos de criterio que la pantalla ofrece hoy.
 *
 * `personalizado` existe en el modelo pero no se ofrece: no tiene forma de
 * captura definida, y dejarla elegirlo la llevaría a crear un criterio que
 * después no tiene pantalla donde llenarse. Los `auto_*` están pospuestos por
 * decisión suya (docs/DECISIONES.md D-015).
 */
export const TIPOS_OFRECIDOS = [
  { tipo: 'entregable', etiqueta: 'Entregable', ayuda: 'Tareas, trabajos, portafolio' },
  { tipo: 'examen', etiqueta: 'Examen', ayuda: 'Aciertos por campo formativo' },
] as const satisfies readonly { tipo: TipoCriterio; etiqueta: string; ayuda: string }[]

export async function esquemaDelTrimestre(trimestreId: Id): Promise<EsquemaTrimestre | null> {
  return repos.evaluacion.esquemaDeTrimestre(trimestreId)
}

/**
 * Cómo va el reparto de pesos.
 *
 * `cierra` es la única condición dura, y **no** bloquea guardar: editar pasa
 * siempre por estados intermedios inválidos, y exigir 100 para poder guardar
 * obligaría a dejar la pantalla cuadrada antes de poder salir de ella. Lo que se
 * bloquea con esto es el cierre del trimestre (C27).
 */
export function estadoDelReparto(esquema: EsquemaTrimestre | null): {
  total: number
  cierra: boolean
  faltan: number
} {
  const criterios = esquema?.criterios.map((c) => c.ponderado) ?? []
  const total = sumaDePesos(criterios)
  return {
    total,
    cierra: criterios.length > 0 && pesosSuman100(criterios),
    faltan: 100 - total,
  }
}

/**
 * Agrega un criterio al trimestre. El nombre se recorta aquí y no en cada tecla:
 * es un campo que se envía, no uno que se revalida mientras se escribe.
 */
export async function agregarCriterio(
  trimestre: Trimestre,
  nombre: string,
  tipo: TipoCriterio,
): Promise<void> {
  if (!aceptaEscrituras(trimestre)) {
    throw new Error('Un trimestre cerrado no admite criterios nuevos')
  }
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  if (limpio === '') throw new Error('El criterio necesita un nombre')

  await repos.evaluacion.agregarCriterio(trimestre.id, limpio, tipo)
}

/**
 * Deja el peso de una fila. Acepta cualquier valor de 0 a 100, incluido un
 * reparto que no sume 100: solo el cierre exige que cuadre.
 */
export async function ajustarPeso(
  trimestre: Trimestre,
  criterioTrimestreId: Id,
  peso: number,
): Promise<void> {
  if (!aceptaEscrituras(trimestre)) {
    throw new Error('Un trimestre cerrado no admite cambios de peso')
  }
  if (!Number.isFinite(peso) || peso < 0 || peso > 100) {
    throw new Error('El peso va de 0 a 100')
  }

  await repos.evaluacion.ajustarPeso(criterioTrimestreId, peso)
}

export async function quitarCriterio(
  trimestre: Trimestre,
  criterioTrimestreId: Id,
): Promise<void> {
  if (!aceptaEscrituras(trimestre)) {
    throw new Error('Un trimestre cerrado no admite quitar criterios')
  }
  await repos.evaluacion.quitarCriterio(criterioTrimestreId)
}

/**
 * Copia el reparto de otro trimestre del mismo ciclo.
 *
 * Trae criterios, pesos y rúbricas; nunca actividades ni calificaciones. Son
 * filas nuevas, así que cambiar un peso aquí después no puede alterar nada de lo
 * ya calculado en el trimestre de origen.
 */
export async function copiarEsquemaDe(
  origen: Trimestre,
  destino: Trimestre,
): Promise<void> {
  if (!aceptaEscrituras(destino)) {
    throw new Error('Un trimestre cerrado no admite copiar un esquema')
  }
  if (origen.id === destino.id) throw new Error('No se copia un trimestre sobre sí mismo')
  if (origen.ciclo_id !== destino.ciclo_id) {
    throw new Error('Solo se copia entre trimestres del mismo ciclo')
  }

  await repos.evaluacion.copiarEsquema(origen.id, destino.id)
}

/**
 * El trimestre del que conviene ofrecer la copia: el anterior por número, si
 * tiene algo que copiar. Devuelve `null` cuando no hay de dónde.
 */
export function trimestreParaCopiar(
  destino: Trimestre,
  ciclo: CicloEnCurso,
): Trimestre | null {
  return ciclo.trimestres.find((t) => t.numero === destino.numero - 1) ?? null
}
