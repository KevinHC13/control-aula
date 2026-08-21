import { nubeConfigurada, supabase } from './supabase'

/**
 * La salida a red del motor de sincronía: subir filas y bajarlas todas.
 *
 * No sabe qué es un alumno ni qué es un trimestre. Recibe nombres de tabla y
 * filas ya armadas, y devuelve lo que la nube tenga. Toda la decisión de **qué**
 * subir vive en `application/sincronia.ts`; toda la de **dónde** guardar, en
 * `data/`. Esto es el cable (docs/ARCHITECTURE.md).
 *
 * La columna `owner` la pone Postgres con `default auth.uid()` y las políticas de
 * RLS solo dejan ver las filas propias, así que el cliente nunca la manda ni la
 * necesita: al bajar se descarta.
 */

/** El nombre con el que el servidor identifica a la maestra que entró. */
export interface Sesion {
  correo: string
}

/** El error que se cuenta como «no hay red», y no como un dato mal formado. */
export class SinNube extends Error {
  constructor() {
    super('La copia en la nube no está configurada en este dispositivo')
  }
}

function cliente() {
  if (!nubeConfigurada() || supabase === null) throw new SinNube()
  return supabase
}

/** La sesión guardada, si hay. `null` es lo normal antes del primer login. */
export async function sesionGuardada(): Promise<Sesion | null> {
  if (!nubeConfigurada() || supabase === null) return null

  const { data } = await supabase.auth.getSession()
  const correo = data.session?.user.email
  return correo ? { correo } : null
}

/**
 * Entra con correo y contraseña. La sesión queda guardada en el dispositivo, así
 * que esto se hace una vez y no en cada arranque.
 */
export async function entrar(correo: string, contrasena: string): Promise<Sesion> {
  const { data, error } = await cliente().auth.signInWithPassword({
    email: correo,
    password: contrasena,
  })
  if (error) throw new Error(error.message)

  return { correo: data.user?.email ?? correo }
}

/** Sale de la sesión. Los datos locales no se tocan: son la fuente de verdad. */
export async function salir(): Promise<void> {
  await cliente().auth.signOut()
}

/**
 * Sube un lote de filas de una tabla. `upsert` por `id`, que es el UUID del
 * cliente: subir dos veces el mismo cambio no duplica nada.
 *
 * Las bajas viajan como una fila más: el borrado es suave, así que la fila lleva
 * su `deleted_at` y el servidor no necesita una operación aparte.
 */
export async function subirFilas(tabla: string, filas: readonly unknown[]): Promise<void> {
  if (filas.length === 0) return

  const { error } = await cliente()
    .from(tabla)
    .upsert(filas as Record<string, unknown>[], { onConflict: 'id' })

  if (error) throw new Error(`${tabla}: ${error.message}`)
}

/**
 * Baja **todas** las filas de una tabla, borradas incluidas: restaurar es dejar el
 * dispositivo como estaba, y filtrar los `deleted_at` resucitaría lo que ella dio
 * de baja.
 *
 * `owner` se descarta aquí: es una columna del servidor y no existe en el modelo
 * local. Dejarla pasar ensuciaría el registro y viajaría de vuelta en el siguiente
 * respaldo.
 */
export async function bajarFilas(tabla: string): Promise<unknown[]> {
  const { data, error } = await cliente().from(tabla).select('*')
  if (error) throw new Error(`${tabla}: ${error.message}`)

  return (data ?? []).map((fila) => sinOwner(fila as Record<string, unknown>))
}

/**
 * Quita la columna del servidor que no existe en el modelo local.
 *
 * Se borra de una copia en vez de desestructurar y descartar: el `_owner` sin usar
 * es justo lo que el linter marca, y decirle que lo ignore sería peor comentario
 * que este.
 */
export function sinOwner(fila: Record<string, unknown>): Record<string, unknown> {
  const copia = { ...fila }
  delete copia.owner
  return copia
}
