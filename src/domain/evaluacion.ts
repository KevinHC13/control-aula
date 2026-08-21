import type { CriterioTrimestre, TipoCriterio, Trimestre } from './entities'
import { NIVELES } from './values'
import type { CampoFormativo, Fecha, Id, Nivel } from './values'

/**
 * Reglas de estructura de la evaluación: qué trimestre le toca a una fecha, si
 * los pesos cierran, si un periodo acepta escrituras. Funciones puras, sin
 * acceso a base de datos.
 *
 * La cadena de cálculo de calificaciones —rúbricas, criterios, examen, base 10—
 * llega en C28 y vive aparte. Este archivo es la estructura, no los números.
 *
 * Los parámetros piden solo los campos que usan (`Pick<...>`) en vez de la
 * entidad completa. Una entidad la satisface por estructura, así que no cuesta
 * nada en los llamadores, y las pruebas no tienen que inventar `id`,
 * `updated_at` y `deleted_at` para preguntar si dos rangos se traslapan.
 */

type Rango = Pick<Trimestre, 'inicio' | 'fin'>
type RangoDeCiclo = Rango & Pick<Trimestre, 'ciclo_id'>

/** El total corriente de pesos, que se muestra mientras ella edita. */
export function sumaDePesos(criterios: readonly Pick<CriterioTrimestre, 'peso'>[]): number {
  return criterios.reduce((acc, c) => acc + c.peso, 0)
}

/**
 * Si los pesos del trimestre cierran en 100.
 *
 * Es requisito para **cerrar** el trimestre, no para guardar: editar pesos pasa
 * siempre por estados intermedios inválidos, y bloquear el guardado obligaría a
 * dejar la pantalla cuadrada antes de poder salir de ella.
 *
 * La comparación tolera error de punto flotante. Con pesos enteros no haría
 * falta, pero 33.4 + 33.3 + 33.3 no da exactamente 100 en binario y negarle el
 * cierre por eso sería un error que ella no podría corregir.
 */
export function pesosSuman100(criterios: readonly Pick<CriterioTrimestre, 'peso'>[]): boolean {
  return Math.abs(sumaDePesos(criterios) - 100) < 1e-9
}

/**
 * Si el rango del trimestre está bien formado. Un trimestre que termina antes de
 * empezar no contiene ninguna fecha, así que no atribuiría ningún registro.
 */
export function rangoValido(t: Rango): boolean {
  return t.inicio <= t.fin
}

/**
 * Si la fecha cae dentro del trimestre, extremos incluidos.
 *
 * Comparar `Fecha` como cadena ordena bien: ISO-8601 con ceros a la izquierda es
 * lexicográficamente igual que cronológicamente.
 */
export function contieneFecha(t: Rango, fecha: Fecha): boolean {
  return fecha >= t.inicio && fecha <= t.fin
}

/**
 * El trimestre al que pertenece una fecha, o `null`.
 *
 * `null` es un resultado normal, no un error: las vacaciones y los puentes caen
 * fuera de todo rango. Un registro con esa fecha existe y se muestra, pero no
 * cuenta para ningún trimestre.
 */
export function trimestreDeFecha<T extends Rango>(
  fecha: Fecha,
  trimestres: readonly T[],
): T | null {
  return trimestres.find((t) => contieneFecha(t, fecha)) ?? null
}

/** Si dos rangos comparten al menos un día. */
export function seTraslapan(a: Rango, b: Rango): boolean {
  return a.inicio <= b.fin && b.inicio <= a.fin
}

/**
 * Los pares de trimestres del **mismo ciclo** que se traslapan.
 *
 * La regla se verifica por ciclo y no globalmente: el T1 de 2027–2028 empieza
 * mucho después del T3 de 2026–2027, pero nada impide que dos ciclos se
 * traslapen entre sí en una base con historia.
 *
 * Devuelve los pares y no un booleano para que la pantalla pueda decir *cuáles*
 * chocan. Vacío significa que el ciclo es consistente.
 */
export function traslapes<T extends RangoDeCiclo>(trimestres: readonly T[]): [T, T][] {
  const pares: [T, T][] = []

  for (let i = 0; i < trimestres.length; i++) {
    for (let j = i + 1; j < trimestres.length; j++) {
      const a = trimestres[i]
      const b = trimestres[j]
      if (!a || !b) continue
      if (a.ciclo_id !== b.ciclo_id) continue
      if (seTraslapan(a, b)) pares.push([a, b])
    }
  }

  return pares
}

/**
 * Si el periodo acepta escrituras. Un trimestre cerrado las rechaza todas: sus
 * calificaciones ya salieron en una boleta.
 */
export function aceptaEscrituras(t: Pick<Trimestre, 'estado'>): boolean {
  return t.estado === 'abierto'
}

/**
 * Si el trimestre se puede cerrar. Un trimestre sin criterios no se cierra
 * aunque la suma dé cero: cerrarlo escribiría un snapshot vacío que después
 * nadie podría distinguir de un trimestre bien cerrado en el que todos sacaron 0.
 */
export function puedeCerrarse(
  t: Pick<Trimestre, 'estado'>,
  criterios: readonly Pick<CriterioTrimestre, 'peso'>[],
): boolean {
  if (!aceptaEscrituras(t)) return false
  if (criterios.length === 0) return false
  return pesosSuman100(criterios)
}

/**
 * Si el criterio se llena con actividades.
 *
 * Solo el entregable. El examen se captura por aciertos sobre el
 * `CriterioTrimestre` —hay uno por trimestre, no una actividad por examen— y los
 * `auto_*` se derivan, no se capturan. `personalizado` existe en el tipo pero no
 * tiene forma de captura definida, así que tampoco admite actividades hasta que la
 * tenga.
 */
export function admiteActividades(tipo: TipoCriterio): boolean {
  return tipo === 'entregable'
}

/*
 * Criterios automáticos
 * =====================
 *
 * Los tres se **derivan** de lo que ya está capturado —asistencia, bitácora,
 * participaciones— y nunca se capturan (docs/DECISIONES.md D-020). Aquí vive lo
 * que hace falta para *configurarlos*; las fórmulas llegan en C26 y van en
 * `calculo.ts`.
 */

/** Si el criterio se calcula solo. Ninguno se captura ni admite actividades. */
export function esAutomatico(tipo: TipoCriterio): boolean {
  return tipo === 'auto_puntualidad' || tipo === 'auto_conducta' || tipo === 'auto_participacion'
}

/**
 * La meta con la que nace la participación: **5** (D-021). Cinco participaciones
 * o más valen 10.0 y una vale 2.0.
 *
 * Es un valor validado con la usuaria, no una convención inventada, y por eso
 * está aquí y no adivinado en el adaptador.
 */
export const META_PARTICIPACION_POR_OMISION = 5

/**
 * Una meta de participación válida: entero de 1 para arriba.
 *
 * Cero no se acepta —dividir entre cero no es una configuración, es un error— y
 * un decimal tampoco: se cuentan participaciones, que son cosas enteras.
 */
export function metaParticipacionValida(meta: number): boolean {
  return Number.isInteger(meta) && meta >= 1
}

/**
 * Cuántos retardos hacen una falta: entero de 1 para arriba, o `null` para que un
 * retardo no penalice.
 *
 * `1` es válido y significa que un retardo cuenta como falta completa. Es duro,
 * pero es la política de algunas escuelas y no le toca al código decidirlo.
 */
export function retardosPorFaltaValido(valor: number | null): boolean {
  return valor === null || (Number.isInteger(valor) && valor >= 1)
}

/** Los parámetros de un `CriterioTrimestre`, que solo usan los automáticos. */
export type ParametrosAutomaticos = Pick<
  CriterioTrimestre,
  'meta_participacion' | 'retardos_por_falta'
>

/**
 * Con qué parámetros nace un criterio recién agregado.
 *
 * La participación nace con su meta puesta, porque **5 está validado** y pedirla
 * antes de poder agregar el criterio sería preguntar algo que ya se sabe. La
 * puntualidad nace en `null` —un retardo no penaliza— y no en 3: «tres retardos
 * hacen una falta» es una convención que nadie ha validado, y de las dos formas
 * de equivocarse, la que no castiga a nadie sin que ella lo pida es esta.
 * Conducta no tiene parámetros: su escala es fija.
 */
export function parametrosPorOmision(tipo: TipoCriterio): ParametrosAutomaticos {
  return {
    meta_participacion: tipo === 'auto_participacion' ? META_PARTICIPACION_POR_OMISION : null,
    retardos_por_falta: null,
  }
}

/**
 * Si al criterio automático le falta algo para poder calificar.
 *
 * Solo la participación puede quedar incompleta —sin meta no hay con qué
 * normalizar—; la puntualidad sin `retardos_por_falta` está completa, significa
 * que los retardos no penalizan, y la conducta nunca necesita nada.
 */
export function parametrosCompletos(
  tipo: TipoCriterio,
  parametros: ParametrosAutomaticos,
): boolean {
  if (tipo !== 'auto_participacion') return true
  return parametros.meta_participacion !== null &&
    metaParticipacionValida(parametros.meta_participacion)
}

/*
 * Rúbricas
 * ========
 */

/**
 * Si el renglón de la rúbrica tiene un descriptor por nivel, ninguno vacío.
 *
 * Los descriptores no son adorno: son lo único que hace repetible la
 * calificación. Un nivel sin descriptor obliga a recordar en diciembre qué quiso
 * decir «Bien» en septiembre, que es exactamente lo que una rúbrica existe para
 * evitar.
 */
export function descriptoresCompletos(descriptores: readonly string[]): boolean {
  return (
    descriptores.length === NIVELES.length && descriptores.every((d) => d.trim() !== '')
  )
}

/**
 * Si la rúbrica está lista para usarse: con nombre, con al menos un renglón y con
 * todos sus descriptores escritos.
 *
 * Una rúbrica sin renglones no calificaría nada: `valorConRubrica([])` no tiene
 * respuesta buena, y dejarla guardar sería dejar pasar una división entre cero
 * hasta la pantalla de captura.
 */
export function rubricaCompleta(rubrica: {
  nombre: string
  criterios: readonly { nombre: string; descriptores: readonly string[] }[]
}): boolean {
  if (rubrica.nombre.trim() === '') return false
  if (rubrica.criterios.length === 0) return false
  return rubrica.criterios.every(
    (c) => c.nombre.trim() !== '' && descriptoresCompletos(c.descriptores),
  )
}

/**
 * Si la captura de una rúbrica está completa: un nivel elegido por cada renglón.
 *
 * Es lo que distingue «ya lo califiqué» de «lo dejé a medias», y con eso decide a
 * quién salta «Siguiente». Un alumno con tres de cuatro renglones no está
 * calificado: su promedio saldría de menos renglones que el de los demás, que es
 * justo la comparación que la rúbrica existe para hacer legítima.
 *
 * Una rúbrica sin renglones nunca está completa: no hay nada que elegir, así que
 * decir que sí sería declarar calificado a todo el grupo sin un solo toque.
 */
export function nivelesCompletos(
  niveles: Readonly<Record<Id, Nivel>>,
  renglones: readonly Id[],
): boolean {
  if (renglones.length === 0) return false
  return renglones.every((id) => niveles[id] !== undefined)
}

/**
 * El índice del siguiente elemento sin capturar, empezando después de `desde` y
 * dando la vuelta al final de la lista. `null` cuando ya no falta ninguno.
 *
 * Da la vuelta a propósito: ella no recorre el grupo en un solo pase —se salta a
 * quien no trajo el trabajo, atiende la puerta, vuelve—, así que «siguiente» tiene
 * que significar «el que falta», no «el que sigue en la lista». Y **avanza**: si el
 * actual es el que falta, no se queda ahí, porque entonces el toque no haría nada.
 *
 * Con `desde` en -1 devuelve el primero que falte, que es con lo que se entra desde
 * la lista. Recibe los estados y no las filas para que sirva a las dos capturas que
 * lo necesitan —rúbrica y examen— sin conocer ninguna de las dos.
 */
export function siguienteSinCapturar(
  completas: readonly boolean[],
  desde: number,
): number | null {
  const total = completas.length
  if (total === 0) return null

  for (let paso = 1; paso <= total; paso++) {
    const i = (((desde + paso) % total) + total) % total
    if (completas[i] === false) return i
  }
  return null
}

/*
 * Examen
 * ======
 *
 * Hay **un** examen por trimestre, no una actividad por examen: se captura por
 * aciertos sobre el `CriterioTrimestre` (validado con la usuaria el 2026-08-20,
 * docs/DECISIONES.md D-018).
 */

/** Los campos que el examen sí evalúa: los que traen preguntas. */
export function camposConPreguntas(
  preguntas: Partial<Record<CampoFormativo, number>>,
): CampoFormativo[] {
  return (Object.keys(preguntas) as CampoFormativo[]).filter(
    (campo) => (preguntas[campo] ?? 0) > 0,
  )
}

/**
 * Si el examen ya se puede capturar: al menos un campo con preguntas.
 *
 * Sin preguntas no hay denominador, y `aciertos ÷ preguntas` sería una división
 * entre cero disfrazada de calificación.
 */
export function examenConfigurado(
  preguntas: Partial<Record<CampoFormativo, number>>,
): boolean {
  return camposConPreguntas(preguntas).length > 0
}

/**
 * Si los aciertos caben en el examen: entero, no negativo y no mayor al total de
 * preguntas de ese campo.
 *
 * Más aciertos que preguntas no es un dato improbable, es un dato imposible: daría
 * una calificación por arriba de 10 y nadie sabría después si fue un dedazo o si
 * el examen tenía otra cantidad de preguntas.
 */
export function aciertosEnRango(aciertos: number, preguntas: number): boolean {
  if (!Number.isInteger(aciertos)) return false
  return aciertos >= 0 && aciertos <= preguntas
}

/**
 * Si el alumno ya tiene su examen capturado: un número en cada campo con
 * preguntas.
 *
 * Igual que en la rúbrica, a medias cuenta como pendiente: el general del examen
 * es aciertos totales sobre preguntas totales, así que un campo sin capturar no
 * baja la calificación, la deja incomparable con la de los demás.
 */
export function aciertosCompletos(
  aciertos: Partial<Record<CampoFormativo, number>>,
  campos: readonly CampoFormativo[],
): boolean {
  if (campos.length === 0) return false
  return campos.every((campo) => aciertos[campo] !== undefined)
}
