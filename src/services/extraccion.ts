/**
 * Única salida a red del cliente. No pasa por el repositorio: Gemini no es una
 * fuente de datos de la app, es un servicio que se consulta una vez y cuyo
 * resultado la maestra revisa antes de que exista (docs/ARCHITECTURE.md, mismo
 * criterio que el motor de sincronía).
 *
 * La clave de Gemini no está aquí ni puede estarlo: la llamada va a una Edge
 * Function de Supabase que la guarda como secret. Lo que sí viaja en el bundle
 * es la clave publicable, que es pública por diseño.
 */

/** Lo que devuelve la función, antes de normalizar. Todo puede venir mal. */
export interface AlumnoExtraido {
  nombre?: string | null
  numero_lista?: number | null
  /** De aquí sale la fecha de nacimiento cuando el documento no la imprime. */
  curp?: string | null
  fecha_nacimiento?: string | null
}

const URL_SUPABASE: string = import.meta.env.VITE_SUPABASE_URL
const CLAVE_SUPABASE: string = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

/**
 * El archivo en base64, sin el prefijo `data:...;base64,` del data URL.
 *
 * `FileReader` y no `arrayBuffer()` + `btoa()`: con una foto de 8 MP el segundo
 * arma una cadena de 8 millones de caracteres a mano y bloquea el hilo.
 */
function aBase64(archivo: File): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const lector = new FileReader()
    lector.onerror = () => rechazar(new Error('No se pudo leer el archivo'))
    lector.onload = () => {
      const resultado = String(lector.result)
      resolver(resultado.slice(resultado.indexOf(',') + 1))
    }
    lector.readAsDataURL(archivo)
  })
}

/**
 * Manda el archivo a leer y devuelve los alumnos tal como los vio la IA.
 *
 * Los mensajes de error son en español y para mostrarse tal cual: esta es la
 * única parte de la app que necesita conexión, así que *no hay red* tiene que
 * distinguirse de *algo falló*. En una app offline-first lo primero no es un bug.
 */
export async function extraerLista(
  archivo: File,
  señal?: AbortSignal,
): Promise<AlumnoExtraido[]> {
  if (!URL_SUPABASE || !CLAVE_SUPABASE) {
    throw new Error('La app no tiene configurado el servidor de lectura')
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new Error('Leer la lista necesita conexión. Conéctate e inténtalo de nuevo.')
  }

  const datos = await aBase64(archivo)

  let respuesta: Response
  try {
    respuesta = await fetch(`${URL_SUPABASE}/functions/v1/extraer-lista`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${CLAVE_SUPABASE}`,
        apikey: CLAVE_SUPABASE,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ mimeType: archivo.type, datos }),
      signal: señal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.', {
      cause: error,
    })
  }

  const cuerpo: { alumnos?: AlumnoExtraido[]; error?: string } = await respuesta
    .json()
    .catch(() => ({}))

  if (!respuesta.ok) {
    throw new Error(cuerpo.error ?? 'No se pudo leer el archivo')
  }
  if (!Array.isArray(cuerpo.alumnos)) {
    throw new Error('No se reconoció ninguna lista en el archivo')
  }

  return cuerpo.alumnos
}
