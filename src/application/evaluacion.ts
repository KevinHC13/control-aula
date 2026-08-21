import { repos } from '@/data'
import type {
  ActividadConEstado,
  ActividadesDelCriterio,
  CicloEnCurso,
  DatosActividad,
  EsquemaTrimestre,
  RubricaConCriterios,
} from '@/data/ports/evaluacion'
import type { Criterio, TipoCriterio, Trimestre } from '@/domain/entities'
import {
  aceptaEscrituras,
  admiteActividades,
  descriptoresCompletos,
  pesosSuman100,
  rangoValido,
  rubricaCompleta,
  seTraslapan,
  sumaDePesos,
  trimestreDeFecha,
} from '@/domain/evaluacion'
import { fechaValida } from '@/domain/fechas'
import { NIVELES } from '@/domain/values'
import type { CampoFormativo, Fecha, Id } from '@/domain/values'

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

/**
 * El periodo en blanco con el que arranca un trimestre por abrir.
 *
 * Abrir el ciclo pide **solo las fechas del primero**. Las de los otros dos no se
 * saben todavía —la escuela publica el calendario por partes— y exigirlas sería
 * hacerla inventar dos rangos para poder empezar a pasar lista.
 */
export function periodoVacio(numero: 1 | 2 | 3): Periodo {
  return { numero, inicio: '', fin: '' }
}

/** Los trimestres que ya existen, en la forma que la pantalla edita. */
export function periodosDe(trimestres: Trimestre[]): Periodo[] {
  return [...trimestres]
    .sort((a, b) => a.numero - b.numero)
    .map((t) => ({ numero: t.numero, inicio: t.inicio, fin: t.fin }))
}

/**
 * El número del siguiente trimestre por abrir, o `null` si ya están los tres.
 *
 * Se abren en orden: el 2 después del 1. Numerarlos al revés no rompería el
 * cálculo —el número es una etiqueta— pero volvería incomprensible la pantalla.
 */
export function siguienteNumero(ciclo: CicloEnCurso): 1 | 2 | 3 | null {
  const usados = new Set(ciclo.trimestres.map((t) => t.numero))
  return NUMEROS.find((n) => !usados.has(n)) ?? null
}

/**
 * Si la fecha cae después del último trimestre abierto y todavía falta abrir
 * alguno.
 *
 * Es la diferencia entre «este día no cuenta para ningún trimestre» —vacaciones— y
 * «el trimestre de este día no se ha abierto todavía». Los dos dan `null` al
 * atribuir, pero el segundo se arregla abriendo el trimestre, y decirlo evita que
 * ella busque el error en otra parte.
 *
 * No se pierde nada mientras tanto: la atribución se calcula de la fecha al leer,
 * no se guarda, así que abrir el trimestre después atribuye lo ya capturado.
 */
export function faltaAbrirTrimestre(fecha: Fecha, ciclo: CicloEnCurso | null): boolean {
  if (!ciclo || siguienteNumero(ciclo) === null) return false
  if (trimestreDeFecha(fecha, ciclo.trimestres) !== null) return false

  const ultimoFin = ciclo.trimestres.reduce((max, t) => (t.fin > max ? t.fin : max), '')
  return fecha > ultimoFin
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

/** Si los periodos recibidos están listos para guardarse. */
export function periodosCompletos(periodos: Periodo[]): boolean {
  return periodos.length > 0 && periodos.every((p) => p.problema === undefined)
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
 * Abre el ciclo escolar con su **primer** trimestre.
 *
 * Solo el primero: las fechas de los otros dos no se saben en agosto, y pedirlas
 * para poder empezar sería hacerla inventarlas. Los siguientes entran con
 * `abrirTrimestreSiguiente` cuando la escuela publica su calendario.
 *
 * Se niega si ya hay un ciclo abierto: dos ciclos abiertos harían ambigua la
 * atribución de una fecha. Cambiar de ciclo es cerrar el anterior, y eso llega con
 * el cierre de trimestre (C27).
 */
export async function abrirCicloEscolar(nombre: string, primero: Periodo): Promise<void> {
  const [revisado] = revisarPeriodos([{ ...primero, numero: 1 }])
  if (!revisado || revisado.problema !== undefined) {
    throw new Error(revisado?.problema ?? 'El primer trimestre necesita sus fechas')
  }
  if (nombre.trim() === '') throw new Error('El ciclo necesita un nombre')

  if ((await repos.evaluacion.cicloEnCurso()) !== null) {
    throw new Error('Ya hay un ciclo escolar abierto')
  }

  await repos.evaluacion.abrirCiclo(nombre.trim(), [
    { numero: 1, inicio: revisado.inicio, fin: revisado.fin },
  ])
}

/**
 * Revisa un trimestre por abrir contra los que ya existen: fechas válidas, rango
 * en orden, sin traslape y **después** del último.
 *
 * Devuelve el mensaje del problema, o `undefined` si se puede abrir. Se reutiliza
 * `revisarPeriodos` para el traslape: es la misma regla, y tenerla en dos lugares
 * es tenerla mal en uno de los dos.
 */
export function revisarNuevoTrimestre(
  ciclo: CicloEnCurso,
  periodo: Periodo,
): string | undefined {
  const existentes = periodosDe(ciclo.trimestres)
  const revisados = revisarPeriodos([...existentes, periodo])
  const nuevo = revisados.find((p) => p.numero === periodo.numero)
  if (nuevo?.problema !== undefined) return nuevo.problema

  const ultimoFin = ciclo.trimestres.reduce((max, t) => (t.fin > max ? t.fin : max), '')
  if (periodo.inicio <= ultimoFin) return 'Tiene que empezar después del trimestre anterior'

  return undefined
}

/** Abre el siguiente trimestre del ciclo, con sus fechas. */
export async function abrirTrimestreSiguiente(
  ciclo: CicloEnCurso,
  periodo: Periodo,
): Promise<void> {
  const numero = siguienteNumero(ciclo)
  if (numero === null) throw new Error('El ciclo ya tiene sus tres trimestres')
  if (periodo.numero !== numero) {
    throw new Error(`El siguiente trimestre por abrir es el ${numero}`)
  }

  const problema = revisarNuevoTrimestre(ciclo, periodo)
  if (problema) throw new Error(problema)

  await repos.evaluacion.abrirTrimestre(ciclo.ciclo.id, {
    numero,
    inicio: periodo.inicio,
    fin: periodo.fin,
  })
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
  // Solo los trimestres que existen: los que faltan por abrir no son un error de
  // captura, y marcarlos como incompletos impediría guardar una corrección al
  // primero mientras los otros dos no tengan fechas.
  const abiertos = new Set(ciclo.trimestres.map((t) => t.numero))
  const revisados = revisarPeriodos(periodos.filter((p) => abiertos.has(p.numero)))
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

/*
 * Rúbricas (C21)
 * ==============
 */

/**
 * Un renglón de rúbrica en el editor, con lo que está mal con él.
 *
 * Mismo patrón que los periodos y que la revisión de la lista: la validación
 * marca y no corrige, y guardar se bloquea mientras quede una marca.
 */
export interface RenglonEnEdicion {
  id?: Id
  nombre: string
  descriptores: [string, string, string, string]
  problema?: string
}

/** Una rúbrica en el editor. */
export interface RubricaEnEdicion {
  id?: Id
  nombre: string
  renglones: RenglonEnEdicion[]
}

export function renglonVacio(): RenglonEnEdicion {
  return { nombre: '', descriptores: ['', '', '', ''] }
}

/**
 * Una rúbrica nueva arranca con un solo renglón, no con cuatro en blanco: cuatro
 * campos vacíos parecen una obligación, uno parece un ejemplo.
 */
export function rubricaVacia(): RubricaEnEdicion {
  return { nombre: '', renglones: [renglonVacio()] }
}

/** Una rúbrica guardada, en la forma que el editor manipula. */
export function rubricaEnEdicion(guardada: RubricaConCriterios): RubricaEnEdicion {
  return {
    id: guardada.rubrica.id,
    nombre: guardada.rubrica.nombre,
    renglones: guardada.criterios.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      descriptores: [...c.descriptores] as [string, string, string, string],
    })),
  }
}

/** Recalcula los problemas de cada renglón. Corre en cada tecla: no toca el texto. */
export function revisarRubrica(rubrica: RubricaEnEdicion): RubricaEnEdicion {
  return {
    ...rubrica,
    renglones: rubrica.renglones.map((renglon) => {
      const limpio: RenglonEnEdicion = {
        ...renglon,
        problema: undefined,
      }
      delete limpio.problema

      if (renglon.nombre.trim() === '') {
        return { ...limpio, problema: 'Falta el nombre del renglón' }
      }
      if (!descriptoresCompletos(renglon.descriptores)) {
        const faltan = renglon.descriptores
          .map((d, i) => (d.trim() === '' ? NIVELES[i] : null))
          .filter((n): n is (typeof NIVELES)[number] => n !== null)
        return { ...limpio, problema: `Falta el descriptor de ${faltan.join(', ')}` }
      }
      return limpio
    }),
  }
}

/** Si la rúbrica se puede guardar. */
export function rubricaLista(rubrica: RubricaEnEdicion): boolean {
  return rubricaCompleta({
    nombre: rubrica.nombre,
    criterios: rubrica.renglones,
  })
}

export async function rubricas(): Promise<RubricaConCriterios[]> {
  return repos.evaluacion.rubricas()
}

/**
 * Guarda la rúbrica. Recorta el texto aquí y no en cada tecla: recapitalizar o
 * recortar mientras ella escribe le pelea al teclado a media palabra.
 */
export async function guardarRubrica(rubrica: RubricaEnEdicion): Promise<Id> {
  if (!rubricaLista(rubrica)) {
    throw new Error('La rúbrica necesita nombre y un descriptor por nivel en cada renglón')
  }

  return repos.evaluacion.guardarRubrica(
    { id: rubrica.id, nombre: rubrica.nombre.trim() },
    rubrica.renglones.map((r) => ({
      id: r.id,
      nombre: r.nombre.trim(),
      descriptores: r.descriptores.map((d) => d.trim()) as [string, string, string, string],
    })),
  )
}

/**
 * Desactiva la rúbrica: sale del selector, pero sigue resolviendo lo que ya se
 * calificó con ella. Es la salida para una rúbrica en uso que ella ya no quiere
 * usar más.
 */
export async function desactivarRubrica(rubricaId: Id): Promise<void> {
  await repos.evaluacion.cambiarActivaRubrica(rubricaId, false)
}

export async function activarRubrica(rubricaId: Id): Promise<void> {
  await repos.evaluacion.cambiarActivaRubrica(rubricaId, true)
}

/**
 * Borra la rúbrica, y **solo** si ninguna actividad la usa.
 *
 * Una rúbrica que alguna actividad referencia no se borra: hacerlo dejaría a esa
 * actividad apuntando a nada y convertiría su captura en binaria de un día para
 * otro, cambiando calificaciones ya dadas. Para esas está `desactivarRubrica`.
 */
export async function borrarRubrica(rubrica: RubricaConCriterios): Promise<void> {
  if (rubrica.enUso) {
    throw new Error('Esta rúbrica está en uso: se puede desactivar, no borrar')
  }
  await repos.evaluacion.borrarRubrica(rubrica.rubrica.id)
}

/*
 * Actividades (C21b)
 * ==================
 */

/**
 * Los campos formativos, con nombre para pantalla. El orden es el de la NEM.
 *
 * Es la agrupación con la que ella reporta —quedó validado— así que se elige
 * **antes** de nombrar la actividad: puesto después, se queda en el que venía por
 * omisión y el reporte por campo deja de significar algo.
 */
export const CAMPOS_CON_NOMBRE = [
  { campo: 'lenguajes', nombre: 'Lenguajes', corto: 'Leng.' },
  {
    campo: 'saberes_pensamiento_cientifico',
    nombre: 'Saberes y pensamiento científico',
    corto: 'Saberes',
  },
  {
    campo: 'etica_naturaleza_sociedades',
    nombre: 'Ética, naturaleza y sociedades',
    corto: 'Ética',
  },
  { campo: 'humano_comunitario', nombre: 'De lo humano y lo comunitario', corto: 'Humano' },
] as const satisfies readonly { campo: CampoFormativo; nombre: string; corto: string }[]

/**
 * Los siete ejes articuladores de la NEM. Son **opcionales**: la actividad se
 * guarda sin ninguno.
 *
 * Se ofrecen como lista y no como texto libre para no teclear en el iPad, pero se
 * guardan como `string[]`, así que corregir la lista no obliga a migrar nada.
 */
export const EJES_ARTICULADORES = [
  'Inclusión',
  'Pensamiento crítico',
  'Interculturalidad crítica',
  'Igualdad de género',
  'Vida saludable',
  'Apropiación de las culturas a través de la lectura y la escritura',
  'Artes y experiencias estéticas',
] as const

export async function actividadesDelTrimestre(
  trimestreId: Id,
): Promise<ActividadesDelCriterio[]> {
  return repos.evaluacion.actividadesDeTrimestre(trimestreId)
}

/** Si la actividad ya tiene captura. Cero registros ⇒ sin calificar. */
export function estaCalificada(actividad: ActividadConEstado): boolean {
  return actividad.registros > 0
}

/**
 * La rúbrica con la que conviene precargar una actividad nueva: la de la última
 * actividad de ese mismo criterio.
 *
 * Es un valor **derivado**, no configuración: lo último que usó es más probable que
 * lo que hubiera configurado en agosto, y así crear la actividad de hoy no cuesta
 * una decisión más. `null` es una respuesta legítima —significa entregada / no
 * entregada— y también se hereda.
 */
export function rubricaSugerida(grupo: ActividadesDelCriterio | undefined): Id | null {
  return grupo?.actividades[0]?.actividad.rubrica_id ?? null
}

function limpiarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, ' ')
}

async function revisarDatos(
  trimestre: Trimestre,
  criterio: Criterio,
  datos: DatosActividad,
): Promise<DatosActividad> {
  if (!aceptaEscrituras(trimestre)) {
    throw new Error('Un trimestre cerrado no admite cambios en sus actividades')
  }
  if (!admiteActividades(criterio.tipo)) {
    throw new Error('Este criterio no se llena con actividades')
  }

  const nombre = limpiarNombre(datos.nombre)
  if (nombre === '') throw new Error('La actividad necesita un nombre')
  if (!fechaValida(datos.fecha)) throw new Error('La fecha debe ser AAAA-MM-DD')

  if (datos.rubrica_id !== null) {
    const rubrica = (await repos.evaluacion.rubricas()).find(
      (r) => r.rubrica.id === datos.rubrica_id,
    )
    if (!rubrica) throw new Error('Esa rúbrica ya no existe')
  }

  return { ...datos, nombre }
}

export async function crearActividad(
  trimestre: Trimestre,
  criterio: Criterio,
  datos: DatosActividad,
): Promise<Id> {
  return repos.evaluacion.crearActividad(await revisarDatos(trimestre, criterio, datos))
}

/**
 * Si guardar estos cambios tira la captura de la actividad.
 *
 * Cambiar con qué se califica lo hace: `EvaluacionRubrica.niveles` está indexado
 * por los renglones de la rúbrica anterior, así que conservarlos dejaría una
 * calificación que ya no significa nada —la pantalla de captura mostraría los
 * renglones nuevos vacíos y el promedio saldría de lo que quedara—. Lo mismo al
 * pasar de rúbrica a binario o al revés.
 *
 * Renombrarla, moverle la fecha o cambiarle el campo no tira nada.
 */
export function cambiaLaCaptura(
  actual: ActividadConEstado,
  datos: DatosActividad,
): boolean {
  if (actual.registros === 0) return false
  return actual.actividad.rubrica_id !== datos.rubrica_id
}

/**
 * Guarda los cambios de una actividad.
 *
 * Se niega a tirar calificaciones sin permiso: si `cambiaLaCaptura`, hay que pasar
 * `confirmado`. La pantalla pregunta antes, diciendo cuántas se pierden.
 */
export async function editarActividad(
  trimestre: Trimestre,
  criterio: Criterio,
  actual: ActividadConEstado,
  datos: DatosActividad,
  confirmado = false,
): Promise<void> {
  const revisados = await revisarDatos(trimestre, criterio, datos)
  const descartar = cambiaLaCaptura(actual, revisados)
  if (descartar && !confirmado) {
    throw new Error(
      'Cambiar con qué se califica borra lo ya calificado en esta actividad',
    )
  }

  await repos.evaluacion.editarActividad(actual.actividad.id, revisados, descartar)
}

/**
 * Borra la actividad y lo capturado en ella.
 *
 * Una actividad ya calificada pide confirmación explícita: se va con las
 * calificaciones de los 30 alumnos, y eso no puede pasar por un toque de más.
 */
export async function borrarActividad(
  trimestre: Trimestre,
  actividad: ActividadConEstado,
  confirmado = false,
): Promise<void> {
  if (!aceptaEscrituras(trimestre)) {
    throw new Error('Un trimestre cerrado no admite borrar actividades')
  }
  if (estaCalificada(actividad) && !confirmado) {
    throw new Error('Esta actividad ya está calificada: borrarla pierde lo capturado')
  }

  await repos.evaluacion.borrarActividad(actividad.actividad.id)
}
