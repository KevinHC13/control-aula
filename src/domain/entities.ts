import type {
  CampoFormativo,
  EstadoAsistencia,
  Fecha,
  Id,
  Instante,
  Nivel,
  Sexo,
  Sincronizable,
} from './values'

export interface Alumno extends Sincronizable {
  /**
   * El ciclo escolar al que pertenece. Es lo que permite guardar varias
   * generaciones sin mezclarlas: la lista diaria son los alumnos del ciclo
   * abierto, y los del año pasado siguen enteros y consultables (D-025).
   *
   * `null` significa «capturado antes de que hubiera ciclo», no «huérfano»:
   * abrir un ciclo los adopta, igual que abrir un trimestre atribuye los días
   * que ya estaban capturados (D-017). Es lo que permite pasar lista el primer
   * día sin haber configurado nada.
   */
  ciclo_id: Id | null
  /** "Apellidos, Nombres" — el orden de la lista oficial */
  nombre: string
  /** Orden en la lista, 1-based **dentro de su ciclo** */
  numero_lista: number
  fecha_nacimiento: Fecha | null
  /**
   * La CURP tal como la trae la lista oficial, 18 caracteres, o `null`.
   *
   * Se guarda por lo que trae dentro: en la lista de Control Escolar la fecha de
   * nacimiento **solo** existe aquí, y de ella sale el aviso de cumpleaños
   * (`C15`). Revierte a sabiendas el «sin CURP» de D-014 (docs/DECISIONES.md
   * D-027).
   *
   * No es la identidad del alumno: fusionar la lista sigue siendo por
   * `[ciclo_id+numero_lista]`, que es lo que conserva su asistencia y sus
   * calificaciones.
   */
  curp: string | null
  /**
   * `H` u `M`, o `null` mientras no se sepa (docs/DECISIONES.md D-029).
   *
   * Sale de tres sitios y en este orden: la columna «SEXO» de la lista, el
   * dígito 11 del CURP y, en último lugar, lo que la IA deduzca del nombre de
   * pila. Los dos primeros son leer un dato que ya está escrito; el tercero es
   * una conjetura, y por eso va al final y se revisa.
   *
   * El `null` es un resultado normal, no un registro a medias: hay listas sin
   * columna de sexo y sin CURP. Quien lo lea tiene que saber decir «sin
   * asignar» en vez de repartirlo a la mitad.
   */
  sexo: Sexo | null
}

/**
 * Un alumno tal como viene de la lista oficial, sin los campos que genera el
 * dispositivo (`id`, `updated_at`, `deleted_at`, `ciclo_id`). Es la forma en la
 * que entra la lista al cargarla desde Ajustes: el ciclo no viaja en el archivo,
 * lo pone el repositorio con el que esté abierto.
 */
export type DatosAlumno = Pick<
  Alumno,
  'nombre' | 'numero_lista' | 'fecha_nacimiento' | 'curp' | 'sexo'
>

export interface RegistroAsistencia extends Sincronizable {
  alumno_id: Id
  fecha: Fecha
  estado: EstadoAsistencia
}

/**
 * Un reporte de la **bitácora**.
 *
 * Todos los reportes son negativos: anotarlo ya es el reporte, así que no hay un
 * `signo` que marcar —con toda la bitácora contando para conducta, marcarlo sería
 * marcar siempre lo mismo (docs/DECISIONES.md D-020)—.
 *
 * De aquí sale la calificación de conducta: se cuentan los reportes del
 * trimestre, atribuidos **por fecha** como todo lo demás, nunca por un campo
 * almacenado.
 */
export interface Reporte extends Sincronizable {
  alumno_id: Id
  fecha: Fecha
  texto: string
}

/**
 * Las participaciones de un alumno en un día. Una fila con un contador, no una
 * fila por marca: deshacer es restar uno, el conteo del día es una lectura y la
 * `outbox` no se llena con N filas por clase.
 *
 * Tabla aparte y **no** un campo en `RegistroAsistencia`, aunque costaría menos
 * esquema: marcar una participación no puede fabricar un registro de asistencia.
 * Un día sin lista pasada no tiene fila, y crearla para colgarle un contador
 * inventaría presencia —lo contrario de D-013—.
 */
export interface Participacion extends Sincronizable {
  alumno_id: Id
  fecha: Fecha
  cantidad: number
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
  /**
   * Solo para `auto_participacion`: cuántas participaciones valen el 100 %. Nace
   * en 5 (D-021) y se califica proporcional con tope, así que una participación
   * vale 2.0 y cinco o más valen 10.0.
   */
  meta_participacion: number | null
  /**
   * Solo para `auto_puntualidad`: cuántos retardos hacen una falta. `null` ⇒ un
   * retardo no penaliza.
   *
   * Son los dos niveles que pidió la usuaria (D-020): si el criterio existe, la
   * puntualidad se califica; este campo dice si un retardo cuenta y cuánto.
   */
  retardos_por_falta: number | null
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
