import type {
  CampoFormativo,
  EstadoAsistencia,
  Fecha,
  Id,
  Instante,
  Nivel,
  Sincronizable,
} from './values'

export interface Alumno extends Sincronizable {
  /** "Apellidos, Nombres" — el orden de la lista oficial */
  nombre: string
  /** Orden en la lista, 1-based */
  numero_lista: number
  fecha_nacimiento: Fecha | null
}

/**
 * Un alumno tal como viene de la lista oficial, sin los campos que genera el
 * dispositivo (`id`, `updated_at`, `deleted_at`). Es la forma que tiene la
 * semilla.
 */
export type DatosAlumno = Pick<Alumno, 'nombre' | 'numero_lista' | 'fecha_nacimiento'>

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

/*
 * Jerarquía de evaluación
 * =======================
 *
 *   Ciclo
 *   └─ Trimestre                 fechas · abierto/cerrado
 *      └─ CriterioTrimestre      peso %  ──→ Criterio (catálogo)
 *         └─ Actividad
 *            └─ Entrega | EvaluacionRubrica
 *
 * Salió de la validación con la usuaria, no de planeación previa
 * (docs/DECISIONES.md D-015).
 */

export interface Ciclo extends Sincronizable {
  /** "2026–2027" */
  nombre: string
  estado: EstadoPeriodo
}

export type EstadoPeriodo = 'abierto' | 'cerrado'

/**
 * Las fechas no son decorativas: son lo que **atribuye automáticamente** los
 * registros diarios a un trimestre. La asistencia se captura por fecha, sin que
 * ella elija trimestre, y el rango decide a cuál pertenece.
 *
 * Cerrar un trimestre lo congela: los pesos quedan inmutables, no se aceptan
 * calificaciones nuevas y se escribe un `CierreTrimestre` por alumno. Sin eso,
 * editar un porcentaje en enero cambiaría una calificación ya reportada en la
 * boleta de diciembre y la app dejaría de coincidir con el papel.
 */
export interface Trimestre extends Sincronizable {
  ciclo_id: Id
  numero: 1 | 2 | 3
  inicio: Fecha
  fin: Fecha
  estado: EstadoPeriodo
  cerrado_en: Instante | null
}

export type TipoCriterio =
  | 'entregable'
  | 'examen'
  | 'auto_puntualidad'
  | 'auto_conducta'
  | 'auto_participacion'
  | 'personalizado'

/** Catálogo: el criterio existe una vez y se reusa en cada trimestre. */
export interface Criterio extends Sincronizable {
  nombre: string
  tipo: TipoCriterio
}

/**
 * El criterio *dentro de* un trimestre, con su peso.
 *
 * Las actividades cuelgan de aquí y no del catálogo: es lo que resuelve el
 * cambio de trimestre por construcción. Un trimestre nuevo nace con filas nuevas
 * y por lo tanto cero actividades, sin borrar ni filtrar nada por fecha, y
 * cambiar un peso en T2 no puede tocar lo ya calculado en T1.
 */
export interface CriterioTrimestre extends Sincronizable {
  trimestre_id: Id
  criterio_id: Id
  /** 0–100. La suma del trimestre debe dar 100 para poder **cerrarlo**, no para
   *  poder guardar: editar siempre pasa por estados intermedios inválidos. */
  peso: number
  orden: number
  /** Solo para `auto_participacion`, que está pospuesto. */
  meta_participacion: number | null
}

export interface Actividad extends Sincronizable {
  criterio_trimestre_id: Id
  nombre: string
  campo: CampoFormativo
  /** Ejes articuladores. Opcionales. */
  ejes: string[]
  fecha: Fecha
  /**
   * Con qué se califica esta actividad. `null` ⇒ captura binaria, entregada / no
   * entregada.
   *
   * Vive aquí y no en el `CriterioTrimestre` porque un criterio tiene muchas
   * actividades y cada una se evalúa con lo que le corresponde: dentro de
   * «Entregables» caben un texto escrito y una exposición, que no comparten
   * rúbrica, y una tarea de palomita junto a un proyecto con rúbrica.
   *
   * Y hay una razón más dura: `EvaluacionRubrica.niveles` se indexa por
   * `rubrica_criterio_id`. Con la rúbrica en el criterio, cambiarla a mitad del
   * trimestre dejaría las evaluaciones ya capturadas apuntando a renglones de la
   * rúbrica vieja —la pantalla mostraría los nuevos vacíos y el promedio se
   * calcularía sobre lo que quedara—. Anclada a la actividad, eso no puede pasar.
   */
  rubrica_id: Id | null
}

export interface Rubrica extends Sincronizable {
  nombre: string
  /**
   * Una rúbrica que ya se usó no se borra: se desactiva.
   *
   * `activa: false` la saca del selector de actividades nuevas, pero **no** rompe
   * las actividades que ya se calificaron con ella —esas la siguen resolviendo
   * por `id`, sin mirar este campo—. Es distinto de `deleted_at`, que se reserva
   * para una rúbrica que nadie llegó a usar: ahí sí se puede borrar de verdad,
   * porque no hay historia que respetar.
   */
  activa: boolean
}

/**
 * Un renglón de la rúbrica, con un descriptor por nivel. Todos los criterios de
 * una rúbrica pesan lo mismo: no hay ponderación interna.
 */
export interface RubricaCriterio extends Sincronizable {
  rubrica_id: Id
  nombre: string
  /** Uno por nivel, en el orden de `NIVELES`. */
  descriptores: [string, string, string, string]
  orden: number
}

/** Captura de un criterio entregable sin rúbrica. */
export interface Entrega extends Sincronizable {
  actividad_id: Id
  alumno_id: Id
  entregada: boolean
}

/** Captura de un criterio entregable con rúbrica. */
export interface EvaluacionRubrica extends Sincronizable {
  actividad_id: Id
  alumno_id: Id
  /** `rubrica_criterio_id` → índice del nivel elegido, nunca su valor. */
  niveles: Record<Id, Nivel>
}

/**
 * Aciertos de examen por campo formativo.
 *
 * [POR VALIDAR] Apunta a `CriterioTrimestre` porque el modelo asume **un** examen
 * por trimestre. Si son varios, el examen pasa a ser una actividad más y esta
 * referencia cambia (docs/DATA-MODEL.md).
 */
export interface ResultadoExamen extends Sincronizable {
  criterio_trimestre_id: Id
  alumno_id: Id
  aciertos: Partial<Record<CampoFormativo, number>>
}

/** Cuántas preguntas trae el examen por campo. Es el denominador. */
export interface ExamenConfig extends Sincronizable {
  criterio_trimestre_id: Id
  preguntas: Partial<Record<CampoFormativo, number>>
}

/**
 * Snapshot de la calificación final de un alumno al cerrar el trimestre.
 *
 * Guarda nombres y pesos como **texto**, no referencias: es la verdad histórica
 * aunque después se renombre o se borre un criterio.
 *
 * Todo en **base 1**, igual que el resto de la cadena de cálculo: la conversión a
 * base 10 sigue ocurriendo una sola vez, al presentar.
 */
export interface CierreTrimestre extends Sincronizable {
  trimestre_id: Id
  alumno_id: Id
  /** `null` cuando al cerrar no había nada capturado en ningún criterio. */
  final: number | null
  desglose: {
    /** Nombre del criterio al momento del cierre. */
    criterio: string
    peso: number
    /**
     * `null` cuando ese criterio no tenía nada capturado. Se guarda igual, con su
     * peso: un criterio que desaparece del snapshot dejaría un hueco imposible de
     * distinguir de un criterio que nunca existió.
     */
    calificacion: number | null
    /**
     * El desglose por campo formativo, que es la agrupación con la que ella
     * reporta. Va en el snapshot porque recalcularlo sería justamente lo que el
     * snapshot existe para no tener que hacer.
     */
    porCampo: Partial<Record<CampoFormativo, number>>
  }[]
}
