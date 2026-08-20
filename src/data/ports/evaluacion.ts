import type { Ciclo, Trimestre } from '@/domain/entities'
import type { Fecha, Id, Suscribible } from '@/domain/values'

/**
 * El ciclo escolar con sus trimestres, que es como se lee siempre: un ciclo sin
 * sus periodos no sirve para atribuir un solo registro, así que pedirlos por
 * separado obligaría a toda pantalla a hacer dos llamadas y a manejar el estado
 * intermedio en que solo llegó una.
 */
export interface CicloEnCurso {
  ciclo: Ciclo
  /** Ordenados por número, del 1 al 3. */
  trimestres: Trimestre[]
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
   * Abre el ciclo con sus tres trimestres, todo en una transacción. Un ciclo con
   * dos de sus tres periodos escritos dejaría fechas sin trimestre y registros
   * sin atribuir.
   */
  abrirCiclo(nombre: string, periodos: PeriodoNuevo[]): Promise<void>

  /**
   * Cambia el rango de un trimestre. Quien llama ya verificó que el trimestre
   * acepta escrituras: la regla vive en el caso de uso, no repetida aquí.
   */
  ajustarFechas(trimestreId: Id, inicio: Fecha, fin: Fecha): Promise<void>
}
