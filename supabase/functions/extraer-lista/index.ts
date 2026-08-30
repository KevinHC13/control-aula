// Extrae la lista oficial de alumnos de un PDF o una foto.
//
// Existe por una sola razón: la clave de Gemini no puede vivir en el bundle del
// front. Aquí es secret de la función y nunca sale de este archivo —ni siquiera
// en los mensajes de error, que son en español y deliberadamente escuetos—.

const MIMES_PERMITIDOS = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
])

/** ~15 MB de archivo. En base64 ocupa un tercio más. */
const MAX_BASE64 = 20 * 1024 * 1024

/**
 * Se confirmó contra `v1beta/models` el 2026-08-18. `GEMINI_MODEL` permite
 * moverlo sin redeploy del código cuando Google jubile este id.
 */
const MODELO = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.5-flash'

const INSTRUCCIONES = `Eres un asistente que digitaliza la lista oficial de alumnos de un grupo de primaria en México.

Del documento adjunto extrae únicamente a los alumnos del grupo. Ignora encabezados,
sellos, firmas, claves de escuela, nombres de maestros y cualquier fila que no sea un alumno.

Para cada alumno:
- "nombre": el nombre completo en formato "Apellidos, Nombres" (por ejemplo "Gómez Pérez, Ana Sofía").
  Respeta los acentos y los apellidos compuestos ("De la Cruz", "Del Ángel") tal como aparecen.
  Si el documento ya usa ese formato, cópialo sin reordenar.
- "numero_lista": el número de lista, tal como está impreso. null si el documento no lo trae.
- "curp": la CURP del alumno tal como aparece, 18 caracteres alfanuméricos en mayúsculas.
  null si el documento no la trae. No la deduzcas ni la completes.
- "fecha_nacimiento": en formato YYYY-MM-DD. Las fechas del documento vienen en día/mes/año.
  null si no aparece. **No la deduzcas de la CURP**: de eso se encarga la aplicación.

No inventes alumnos ni completes datos que no estén en el documento.`

const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    alumnos: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nombre: { type: 'STRING' },
          numero_lista: { type: 'INTEGER', nullable: true },
          curp: { type: 'STRING', nullable: true },
          fecha_nacimiento: { type: 'STRING', nullable: true },
        },
        required: ['nombre'],
      },
    },
  },
  required: ['alumnos'],
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
}

function responder(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'POST') return responder({ error: 'Método no permitido' }, 405)

  const clave = Deno.env.get('GEMINI_API_KEY')
  if (!clave) return responder({ error: 'El servidor no tiene configurada la clave de Gemini' }, 500)

  let cuerpo: { mimeType?: unknown; datos?: unknown }
  try {
    cuerpo = await req.json()
  } catch {
    return responder({ error: 'El cuerpo de la petición no es JSON' }, 400)
  }

  const { mimeType, datos } = cuerpo
  if (typeof mimeType !== 'string' || !MIMES_PERMITIDOS.has(mimeType)) {
    return responder({ error: 'Ese tipo de archivo no se puede leer. Usa un PDF o una foto.' }, 415)
  }
  if (typeof datos !== 'string' || datos.length === 0) {
    return responder({ error: 'No llegó el archivo' }, 400)
  }
  if (datos.length > MAX_BASE64) {
    return responder({ error: 'El archivo es muy grande. Prueba con una foto de menos resolución.' }, 413)
  }

  let respuesta: Response
  try {
    respuesta = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': clave, 'content-type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { parts: [{ inlineData: { mimeType, data: datos } }, { text: INSTRUCCIONES }] },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: ESQUEMA,
          },
        }),
        signal: req.signal,
      },
    )
  } catch {
    return responder({ error: 'No se pudo contactar al servicio de lectura' }, 502)
  }

  if (!respuesta.ok) {
    // El cuerpo de Google puede traer la clave reflejada; se descarta entero.
    console.error('gemini respondió', respuesta.status)
    return responder({ error: 'El servicio de lectura rechazó el archivo' }, 502)
  }

  const json = await respuesta.json()
  const texto = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? '')
    .join('')

  if (!texto) return responder({ error: 'No se reconoció ninguna lista en el archivo' }, 422)

  let extraido: { alumnos?: unknown }
  try {
    extraido = JSON.parse(texto)
  } catch {
    return responder({ error: 'No se reconoció ninguna lista en el archivo' }, 422)
  }

  if (!Array.isArray(extraido.alumnos) || extraido.alumnos.length === 0) {
    return responder({ error: 'No se reconoció ninguna lista en el archivo' }, 422)
  }

  return responder({ alumnos: extraido.alumnos })
})
