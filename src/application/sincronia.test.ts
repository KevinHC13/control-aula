// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/data/dexie/db'

/**
 * La red se sustituye, no se llama: lo que estas pruebas verifican es el **orden**
 * —subir, que el servidor conteste, y solo entonces vaciar la cola— y que un fallo
 * deje la `outbox` intacta. Eso es todo el motor; el cable a Supabase no se prueba
 * aquí.
 */
const subidas: { tabla: string; filas: unknown[] }[] = []
let fallaLaSubida = false
let sesionFalsa: { correo: string } | null = { correo: 'maestra@escuela.mx' }
const bajadas: Record<string, unknown[]> = {}

vi.mock('@/services/supabase', () => ({
  nubeConfigurada: () => true,
  supabase: null,
}))

vi.mock('@/services/sincronia', () => ({
  sesionGuardada: () => Promise.resolve(sesionFalsa),
  entrar: (correo: string) => Promise.resolve({ correo }),
  salir: () => Promise.resolve(),
  subirFilas: (tabla: string, filas: unknown[]) => {
    if (fallaLaSubida) return Promise.reject(new Error('sin red'))
    subidas.push({ tabla, filas: [...filas] })
    return Promise.resolve()
  },
  bajarFilas: (tabla: string) => Promise.resolve(bajadas[tabla] ?? []),
  sinOwner: (fila: Record<string, unknown>) => fila,
}))

const { entrar, pendientes, restaurarDeLaNube, sincronizarSiSePuede, subirPendientes } =
  await import('./sincronia')

const base = { updated_at: '2026-09-01T00:00:00.000Z', deleted_at: null }

const alumno = (n: number) => ({
  id: `alumno-${n}`,
  ...base,
  nombre: `Apellido${n}, Nombre`,
  ciclo_id: null,
  numero_lista: n,
  fecha_nacimiento: null,
})

async function encolar(tabla: string, registroId: string) {
  await db.outbox.add({
    tabla: tabla as never,
    registro_id: registroId,
    op: 'upsert',
    at: '2026-09-01T00:00:00.000Z',
  })
}

beforeEach(async () => {
  await db.open()
  await db.alumnos.clear()
  await db.asistencia.clear()
  await db.outbox.clear()

  subidas.length = 0
  fallaLaSubida = false
  sesionFalsa = { correo: 'maestra@escuela.mx' }
  for (const clave of Object.keys(bajadas)) delete bajadas[clave]
})

describe('subirPendientes', () => {
  it('sube las filas y vacía la cola', async () => {
    await db.alumnos.bulkPut([alumno(1), alumno(2)])
    await encolar('alumnos', 'alumno-1')
    await encolar('alumnos', 'alumno-2')

    const resultado = await subirPendientes()

    expect(subidas).toHaveLength(1)
    expect(subidas[0]?.tabla).toBe('alumnos')
    expect(subidas[0]?.filas).toHaveLength(2)
    expect(resultado).toEqual({ subidos: 2, pendientes: 0 })
    expect(await pendientes()).toBe(0)
  })

  it('si el servidor falla, la cola queda intacta', async () => {
    // Es el criterio duro de C16: una cola que se vacía al mandar la petición
    // pierde lo capturado en cuanto la red falla, y el único ejemplar de los datos
    // vive en un iPad.
    await db.alumnos.put(alumno(1))
    await encolar('alumnos', 'alumno-1')
    fallaLaSubida = true

    await expect(subirPendientes()).rejects.toThrow('sin red')
    expect(await pendientes()).toBe(1)
  })

  it('reintentar después de un fallo no duplica: es upsert por id', async () => {
    await db.alumnos.put(alumno(1))
    await encolar('alumnos', 'alumno-1')

    fallaLaSubida = true
    await expect(subirPendientes()).rejects.toThrow()
    fallaLaSubida = false
    await subirPendientes()

    expect(subidas).toHaveLength(1)
    expect(await pendientes()).toBe(0)
  })

  it('sube en varios lotes hasta vaciar la cola', async () => {
    // 250 cambios con un tope de 200: dos rondas.
    const muchos = Array.from({ length: 250 }, (_, i) => alumno(i + 1))
    await db.alumnos.bulkPut(muchos)
    for (const uno of muchos) await encolar('alumnos', uno.id)

    const resultado = await subirPendientes()

    expect(subidas).toHaveLength(2)
    expect(subidas[0]?.filas).toHaveLength(200)
    expect(subidas[1]?.filas).toHaveLength(50)
    expect(resultado.subidos).toBe(250)
    expect(await pendientes()).toBe(0)
  })

  it('un cambio cuya fila ya no existe sale de la cola sin subir nada', async () => {
    await encolar('alumnos', 'no-existe')

    const resultado = await subirPendientes()

    expect(subidas).toHaveLength(0)
    expect(resultado).toEqual({ subidos: 1, pendientes: 0 })
  })

  it('con la cola vacía no llama a la red', async () => {
    expect(await subirPendientes()).toEqual({ subidos: 0, pendientes: 0 })
    expect(subidas).toHaveLength(0)
  })
})

describe('restaurarDeLaNube', () => {
  it('escribe lo que baja, por el mismo camino del respaldo en archivo', async () => {
    bajadas.alumnos = [alumno(1), alumno(2)]

    const conteo = await restaurarDeLaNube()

    expect(conteo.alumnos).toBe(2)
    expect(await db.alumnos.count()).toBe(2)
    // Restaurar no encola: no es una mutación del salón (D-022).
    expect(await pendientes()).toBe(0)
  })

  it('restaurar dos veces no duplica', async () => {
    bajadas.alumnos = [alumno(1)]

    await restaurarDeLaNube()
    await restaurarDeLaNube()

    expect(await db.alumnos.count()).toBe(1)
  })

  it('una nube vacía no borra lo local', async () => {
    // Restaurar es recuperar, no reemplazar el dispositivo.
    await db.alumnos.put(alumno(9))

    await restaurarDeLaNube()

    expect(await db.alumnos.count()).toBe(1)
  })
})

describe('sincronizarSiSePuede', () => {
  it('sin sesión no sube nada y no falla', async () => {
    // Es la que corre al abrir, al cerrar y al volver la red: sin sesión la app
    // funciona igual contra los datos locales (D-023).
    sesionFalsa = null
    await db.alumnos.put(alumno(1))
    await encolar('alumnos', 'alumno-1')

    expect(await sincronizarSiSePuede()).toBeNull()
    expect(subidas).toHaveLength(0)
    expect(await pendientes()).toBe(1)
  })

  it('con la cola vacía no hace nada', async () => {
    expect(await sincronizarSiSePuede()).toBeNull()
    expect(subidas).toHaveLength(0)
  })

  it('con sesión y pendientes, sube', async () => {
    await db.alumnos.put(alumno(1))
    await encolar('alumnos', 'alumno-1')

    expect(await sincronizarSiSePuede()).toEqual({ subidos: 1, pendientes: 0 })
  })

  it('un fallo de red no se propaga: esto corre sin que nadie lo pida', async () => {
    await db.alumnos.put(alumno(1))
    await encolar('alumnos', 'alumno-1')
    fallaLaSubida = true

    expect(await sincronizarSiSePuede()).toBeNull()
    // Y lo capturado sigue en la cola, que es su trabajo.
    expect(await pendientes()).toBe(1)
  })
})

describe('entrar', () => {
  it('se niega sin correo o sin contraseña, sin llamar a la red', async () => {
    await expect(entrar('  ', 'algo')).rejects.toThrow(/correo y la contraseña/)
    await expect(entrar('maestra@escuela.mx', '')).rejects.toThrow(/correo y la contraseña/)
  })

  it('recorta el correo', async () => {
    expect(await entrar('  maestra@escuela.mx ', 'secreta')).toEqual({
      correo: 'maestra@escuela.mx',
    })
  })
})
