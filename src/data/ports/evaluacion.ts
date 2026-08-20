import type {
  Actividad,
  Ciclo,
  Criterio,
  CriterioTrimestre,
  Rubrica,
  RubricaCriterio,
  TipoCriterio,
  Trimestre,
} from '@/domain/entities'
import type { CampoFormativo, Fecha, Id, Suscribible } from '@/domain/values'

/**
 * El ciclo escolar con sus trimestres, que es como se lee siempre: un ciclo sin
 * sus periodos no sirve para atribuir un solo registro, así que pedirlos por
 * separado obligaría a toda pantalla a hacer dos llamadas y a manejar el estado
 * intermedio en que solo llegó una.
 */
export interface CicloEnCurso {
  ciclo: Ciclo
  /**
   * Ordenados por número. **Pueden ser menos de tres**: el ciclo se abre con el
   * primero y los demás se agregan cuando la escuela publica sus fechas.
   */
  trimestres: Trimestre[]
}

/**
 * Un criterio dentro de un trimestre, con el nombre y el tipo que trae del
 * catálogo. Siempre se leen juntos: el peso no dice nada sin saber de qué es, y
 * el tipo es lo que decide cómo se captura.
 */
export interface CriterioDelTrimestre {
  /** La fila del trimestre: peso y orden. Es la que se edita. */
  ponderado: CriterioTrimestre
  /** La entrada del catálogo: nombre y tipo. Se comparte entre trimestres. */
  criterio: Criterio
}

/** El reparto de pesos de un trimestre, que es lo que edita la pantalla. */
export interface EsquemaTrimestre {
  trimestre: Trimestre
  /** Ordenados por `orden`. */
  criterios: CriterioDelTrimestre[]
}

/**
 * Una rúbrica con sus renglones y si alguien la está usando.
 *
 * `enUso` viene en la misma lectura y no en una consulta aparte: la pantalla lo
 * necesita para cada rúbrica que pinta, y pedirlo por separado serían N consultas
 * para decidir N botones de borrar.
 */
export interface RubricaConCriterios {
  rubrica: Rubrica
  /** Ordenados por `orden`. */
  criterios: RubricaCriterio[]
  /** Si alguna actividad la referencia. Una en uso no se borra, se desactiva. */
  enUso: boolean
}

/**
 * Un renglón de rúbrica tal como sale del editor. Sin `id` cuando es nuevo; con
 * `id` cuando ya existía, y entonces se conserva —de ese `id` cuelgan los niveles
 * ya capturados en `EvaluacionRubrica.niveles`—.
 */
export interface RenglonDeRubrica {
  id?: Id
  nombre: string
  descriptores: [string, string, string, string]
}

/**
 * Una actividad con lo que hace falta para pintarla en la lista: si ya se
 * calificó.
 *
 * `registros` cuenta los alumnos con captura en esta actividad. Cero significa
 * **sin calificar**, y no es lo mismo que calificada con ceros: una actividad sin
 * ningún registro se excluye del promedio (docs/DATA-MODEL.md). De ahí que la
 * lista tenga que distinguirlas a la vista.
 */
export interface ActividadConEstado {
  actividad: Actividad
  registros: number
}

/** Las actividades de un criterio del trimestre, con el criterio que las agrupa. */
export interface ActividadesDelCriterio {
  ponderado: CriterioTrimestre
  criterio: Criterio
  /** Las más recientes primero: es lo que ella acaba de dejar y va a calificar. */
  actividades: ActividadConEstado[]
}

/** Una actividad por crear o guardar. Sin los campos que genera el dispositivo. */
export interface DatosActividad {
  criterio_trimestre_id: Id
  nombre: string
  campo: CampoFormativo
  ejes: string[]
  fecha: Fecha
  rubrica_id: Id | null
}

/** Un trimestre por crear: todavía no tiene `id` ni `ciclo_id`. */
export interface PeriodoNuevo {
  numero: 1 | 2 | 3
  inicio: Fecha
  fin: Fecha
}

/**
 * Contrato del ciclo escolar y sus trimestres.
 *
 * Un solo puerto para la evaluación y no uno por tabla: `Rubrica` sin
 * `RubricaCriterio` no significa nada, y una actividad sin sus entregas tampoco.
 * Se corta por caso de uso y cada método devuelve el agregado completo que una
 * pantalla necesita (docs/ARCHITECTURE.md). Hoy declara solo lo del ciclo, que es
 * lo que alguna pantalla usa; los criterios y las actividades entran cuando
 * tengan pantalla.
 *
 * No hay `cerrarTrimestre`: cerrar escribe un snapshot de calificaciones y eso
 * necesita la cadena de cálculo, que llega en C28. Un puerto declara solo lo que
 * se usa hoy (docs/DECISIONES.md D-009).
 */
export interface EvaluacionRepo {
  /** El ciclo abierto con sus trimestres. `null` si todavía no se configura uno. */
  cicloEnCurso(): Promise<CicloEnCurso | null>

  /**
   * Lo mismo, reactivo. Sostiene que la etiqueta del trimestre en la pantalla de
   * asistencia se corrija sola en cuanto ella ajusta una fecha en Ajustes, sin
   * recargar ni volver a entrar.
   */
  observarCicloEnCurso(): Suscribible<CicloEnCurso | null>

  /**
   * Abre el ciclo con los trimestres que se le den, todo en una transacción.
   *
   * Normalmente es **uno**: el primero. Los siguientes se abren cuando la escuela
   * publica sus fechas, con `abrirTrimestre`.
   */
  abrirCiclo(nombre: string, periodos: PeriodoNuevo[]): Promise<void>

  /**
   * Abre un trimestre más en un ciclo que ya existe.
   *
   * Quien llama ya verificó que el número no está tomado y que el rango no se
   * traslapa con los que ya hay: las reglas viven en el caso de uso.
   */
  abrirTrimestre(cicloId: Id, periodo: PeriodoNuevo): Promise<void>

  /**
   * Cambia el rango de un trimestre. Quien llama ya verificó que el trimestre
   * acepta escrituras: la regla vive en el caso de uso, no repetida aquí.
   */
  ajustarFechas(trimestreId: Id, inicio: Fecha, fin: Fecha): Promise<void>

  /** El reparto de pesos de un trimestre. `null` si el trimestre no existe. */
  esquemaDeTrimestre(trimestreId: Id): Promise<EsquemaTrimestre | null>

  /**
   * Lo mismo, reactivo. Sostiene que el total corriente de pesos se recalcule al
   * cambiar un peso, sin botón de refrescar.
   */
  observarEsquemaDeTrimestre(trimestreId: Id): Suscribible<EsquemaTrimestre | null>

  /**
   * Agrega un criterio al trimestre. Si el catálogo ya tiene uno con ese nombre y
   * ese tipo lo reutiliza, en vez de crear un duplicado: el catálogo existe para
   * que «Tareas» sea el mismo criterio en los tres trimestres y en los ciclos que
   * vengan.
   *
   * El peso nace en 0. Poner un valor de arranque obligaría a adivinar el reparto
   * y a que ella corrija una cifra inventada.
   */
  agregarCriterio(trimestreId: Id, nombre: string, tipo: TipoCriterio): Promise<void>

  /** Cambia el peso de una fila. */
  ajustarPeso(criterioTrimestreId: Id, peso: number): Promise<void>

  /**
   * Saca el criterio del trimestre. Borrado suave, y **solo** de la fila del
   * trimestre: la entrada del catálogo se queda, porque otros trimestres la
   * comparten.
   */
  quitarCriterio(criterioTrimestreId: Id): Promise<void>

  /**
   * Copia el reparto de otro trimestre: criterios, pesos y meta de participación.
   *
   * **No** copia actividades, entregas, evaluaciones ni resultados de examen —y
   * por lo tanto tampoco rúbricas, que ahora cuelgan de la actividad—. Son filas
   * nuevas de `CriterioTrimestre`, así que cambiar un peso en el trimestre nuevo
   * no puede tocar nada de lo ya calculado en el de origen (docs/DATA-MODEL.md).
   */
  copiarEsquema(desdeTrimestreId: Id, haciaTrimestreId: Id): Promise<void>

  /** Todas las rúbricas vivas, activas y desactivadas, con sus renglones. */
  rubricas(): Promise<RubricaConCriterios[]>

  /** Lo mismo, reactivo: el selector de rúbrica se entera de una nueva sin recargar. */
  observarRubricas(): Suscribible<RubricaConCriterios[]>

  /**
   * Crea o actualiza una rúbrica con sus renglones, en una transacción. Devuelve
   * su `id`.
   *
   * Los renglones que llegan con `id` se actualizan conservándolo, y los que
   * faltan se borran en suave. Conservar el `id` no es cosmético: es la clave de
   * `EvaluacionRubrica.niveles`, así que recrearlo dejaría huérfano todo lo ya
   * calificado con esa rúbrica.
   */
  guardarRubrica(
    rubrica: { id?: Id; nombre: string },
    renglones: RenglonDeRubrica[],
  ): Promise<Id>

  /**
   * Activa o desactiva la rúbrica. Desactivada, sale del selector pero sigue
   * resolviendo lo que ya se calificó con ella.
   */
  cambiarActivaRubrica(rubricaId: Id, activa: boolean): Promise<void>

  /**
   * Borra en suave la rúbrica y sus renglones. Quien llama ya verificó que nadie
   * la usa: la regla vive en el caso de uso.
   */
  borrarRubrica(rubricaId: Id): Promise<void>

  /**
   * Las actividades del trimestre, agrupadas por criterio.
   *
   * Solo los criterios que las admiten: un examen se captura por aciertos sobre el
   * `CriterioTrimestre`, no por actividades, así que no aparece aquí.
   */
  actividadesDeTrimestre(trimestreId: Id): Promise<ActividadesDelCriterio[]>

  /** Lo mismo, reactivo: crear una actividad la deja en la lista sin recargar. */
  observarActividadesDeTrimestre(trimestreId: Id): Suscribible<ActividadesDelCriterio[]>

  crearActividad(datos: DatosActividad): Promise<Id>

  /**
   * Guarda los cambios de una actividad.
   *
   * `descartarCaptura` borra en suave sus entregas y evaluaciones. Hace falta
   * cuando cambia con qué se califica: `EvaluacionRubrica.niveles` está indexado
   * por los renglones de la rúbrica anterior, así que conservarlos dejaría una
   * calificación que ya no significa nada. Quien llama ya se lo advirtió a la
   * maestra.
   */
  editarActividad(
    actividadId: Id,
    datos: DatosActividad,
    descartarCaptura: boolean,
  ): Promise<void>

  /** Borra en suave la actividad y todo lo capturado en ella. */
  borrarActividad(actividadId: Id): Promise<void>
}
