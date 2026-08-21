import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * El cliente de Supabase, uno solo para toda la app.
 *
 * Vive en `services/` porque es red y nada más que red: ni el dominio ni la capa
 * de datos lo conocen, y el repositorio sigue escribiendo únicamente en Dexie
 * (docs/ARCHITECTURE.md).
 *
 * **La sesión se guarda y se renueva sola.** Es lo que hace que ella entre una
 * vez y no vuelva a ver una pantalla de login: `persistSession` la deja en el
 * `localStorage` del dispositivo y `autoRefreshToken` la renueva mientras la app
 * esté abierta. Un iPad que es de una sola maestra no necesita cerrar sesión cada
 * mañana.
 *
 * `detectSessionInUrl: false` porque no hay flujo de OAuth ni de magic link: se
 * entra con correo y contraseña, y sin eso el cliente se pondría a buscar tokens
 * en el hash de la URL en cada arranque.
 *
 * La clave que viaja en el bundle es la **publicable**, que es pública por
 * diseño: lo que protege los datos son las políticas de RLS, que solo dejan ver
 * y escribir las filas de la cuenta que entró (`supabase/migrations`).
 */
const URL_SUPABASE: string = import.meta.env.VITE_SUPABASE_URL
const CLAVE_SUPABASE: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * `null` cuando no hay configuración: la app funciona igual, solo sin nube. Es el
 * caso de un `.env` sin llenar, y no puede ser un error de arranque —lo que no
 * puede fallar nunca es pasar lista—.
 */
export const supabase: SupabaseClient | null =
  URL_SUPABASE && CLAVE_SUPABASE
    ? createClient(URL_SUPABASE, CLAVE_SUPABASE, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null

/** Si el dispositivo tiene con qué hablarle a la nube. */
export function nubeConfigurada(): boolean {
  return supabase !== null
}
