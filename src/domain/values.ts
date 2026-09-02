/**
 * Tipos base del dominio. Este archivo no importa nada: ni React, ni Dexie, ni
 * librerías. Ver docs/ARCHITECTURE.md.
 */

/** ISO 8601, solo fecha: "2026-08-18" */
export type Fecha = string

/** ISO 8601, solo mes: "2026-08". La rejilla del calendario se pide por mes. */
export type Mes = string

/** UUID v4 generado en el cliente con `crypto.randomUUID()` */
export type Id = string

/** ISO 8601 completo en UTC: "2026-08-18T14:32:07.123Z" */
export type Instante = string

export type EstadoAsistencia = 'presente' | 'ausente' | 'retardo' | 'justificada'

/**
 * El sexo del alumno, con las dos letras que usa la lista oficial: `H` de
 * hombre, `M` de mujer. Se guardan las letras y no palabras porque son las que
 * imprime la lista de la escuela y las que codifica el dígito 11 del CURP; la
 * pantalla las traduce a «Niños» y «Niñas» al presentarlas
 * (docs/DECISIONES.md D-029).
 *
 * `Alumno.sexo` es `Sexo | null`, y el `null` no es un dato pendiente de
 * arreglar: una lista puede no traer la columna. Lo que no se puede es
 * inventarlo, así que la pantalla dice «sin asignar» y no lo reparte.
 */
export type Sexo = 'H' | 'M'

export const SEXOS = ['H', 'M'] as const satisfies readonly Sexo[]

/**
 * La letra que sea, venga como venga —`h`, `H`, `Hombre`—, o `null` si no se
 * reconoce. Vive en el dominio y no en cada pantalla porque qué cuenta como
 * sexo válido es una regla, no un detalle de la carga ni del formulario.
 *
 * Deliberadamente **no** entiende `F` de femenino: esa letra solo aparece en
 * listas escritas a la inglesa, donde la `M` significa lo contrario que aquí, y
 * resolver esa ambigüedad necesita mirar la columna entera. Eso se hace al leer
 * la hoja (`application/hoja.ts`), que es el único sitio que tiene la columna
 * delante.
 */
export function comoSexo(texto: string | null | undefined): Sexo | null {
  const letra = (texto ?? '').trim().charAt(0).toUpperCase()
  return letra === 'H' || letra === 'M' ? letra : null
}

/**
 * Orden del ciclo al tocar una fila de asistencia. Cuatro estados es el límite:
 * un quinto vuelve el ciclo más lento que un menú (docs/UX.md).
 */
export const CICLO_ESTADOS = [
  'presente',
  'ausente',
  'retardo',
  'justificada',
] as const satisfies readonly EstadoAsistencia[]

/**
 * Los cuatro campos formativos de la Nueva Escuela Mexicana. Validados con la
 * usuaria: son la agrupación con la que reporta, así que todo valor de
 * evaluación se calcula dos veces —por campo y en general— (docs/DATA-MODEL.md).
 */
export type CampoFormativo =
  | 'lenguajes'
  | 'saberes_pensamiento_cientifico'
  | 'etica_naturaleza_sociedades'
  | 'humano_comunitario'

export const CAMPOS_FORMATIVOS = [
  'lenguajes',
  'saberes_pensamiento_cientifico',
  'etica_naturaleza_sociedades',
  'humano_comunitario',
] as const satisfies readonly CampoFormativo[]

/**
 * Los niveles de rúbrica son fijos y los mismos para toda rúbrica. Se guarda el
 * **índice** del nivel elegido, nunca su valor: así, cambiar `VALOR_NIVEL` no
 * obliga a migrar un solo registro.
 */
export const NIVELES = ['Excelente', 'Bien', 'Regular', 'Mal'] as const

export type Nivel = 0 | 1 | 2 | 3

/**
 * Valor de cada nivel, paralelo a `NIVELES`.
 *
 * `Mal` vale 0 y no 1: en base 10 los tres niveles superiores quedan a menos de
 * dos puntos de distancia (10.0, 8.3, 6.7) y entre Regular y Mal se abre un
 * acantilado de 6.7. Es deliberado —codifica que el trabajo no vale nada, no que
 * valga poco— y trae una consecuencia que conviene tener presente: tres
 * criterios en Excelente y uno en Mal (7.5) queda por debajo de todo en Bien
 * (8.3). Si eso resulta indeseable, la palanca es esta tabla, nunca la fórmula
 * (docs/DECISIONES.md D-015).
 */
export const VALOR_NIVEL = [3, 2.5, 2, 0] as const

export const NIVEL_MAXIMO = 3

/**
 * Campos base de todo registro sincronizable.
 *
 * - `updated_at` se reescribe en cada mutación, sin excepción: es lo único que
 *   le dice al motor de sincronía qué falta subir.
 * - `deleted_at` implementa el borrado suave; toda lectura filtra
 *   `deleted_at === null`.
 */
export interface Sincronizable {
  id: Id
  updated_at: Instante
  deleted_at: Instante | null
}

/**
 * Suscripción mínima, declarada aquí para que `data/ports/` no tenga que
 * importar el `Observable` de Dexie: la reactividad es parte del contrato del
 * puerto, no un detalle del adaptador (docs/ARCHITECTURE.md).
 *
 * El observable de Dexie satisface esta interfaz sin adaptación. Un adaptador
 * de Supabase la cumpliría con Realtime, y uno de SQL con un emisor propio
 * invalidado tras cada escritura.
 */
export interface Suscribible<T> {
  subscribe(next: (valor: T) => void): { unsubscribe(): void }
}
