// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it } from 'vitest'

import { db } from './db'
import { DexieParticipacionesRepo } from './participaciones.adapter'

const HOY = '2026-09-10'
const AYER = '2026-09-09'
const INICIO = '2026-08-24'
const FIN = '2026-12-18'
const ALUMNO = 'alumno-1'
const OTRO = 'alumno-2'

const repo = new DexieParticipacionesRepo()

beforeEach(async () => {
  await db.open()
  await db.participaciones.clear()
  await db.outbox.clear()
})

describe('sumarUna', () => {
  it('crea la fila del día con cantidad 1, id de UUID y updated_at', async () => {
    await repo.sumarUna(ALUMNO, HOY)

    const delDia = await repo.porDia(HOY)
    expect(delDia).toHaveLength(1)
    expect(delDia[0]?.cantidad).toBe(1)
    expect(delDia[0]?.alumno_id).toBe(ALUMNO)
    expect(delDia[0]?.deleted_at).toBeNull()
    expect(delDia[0]?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
    expect(delDia[0]?.updated_at).toMatch(/Z$/)
  })

  it('es un contador: tres toques son una fila con cantidad 3', async () => {
    // Una fila por marca llenaría la outbox con N filas por clase y volvería el
    // conteo del día una consulta en vez de una lectura.
    await repo.sumarUna(ALUMNO, HOY)
    await repo.sumarUna(ALUMNO, HOY)
    await repo.sumarUna(ALUMNO, HOY)

    const delDia = await repo.porDia(HOY)
    expect(delDia).toHaveLength(1)
    expect(delDia[0]?.cantidad).toBe(3)
  })

  it('cada alumno tiene su propia fila el mismo día', async () => {
    await repo.sumarUna(ALUMNO, HOY)
    await repo.sumarUna(OTRO, HOY)

    expect(await repo.porDia(HOY)).toHaveLength(2)
  })

  it('encola el cambio en la outbox, en la misma transacción', async () => {
    await repo.sumarUna(ALUMNO, HOY)

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.tabla).toBe('participaciones')
    expect(pendientes[0]?.op).toBe('upsert')
  })
})

describe('restarUna', () => {
  it('resta una del día', async () => {
    await repo.sumarUna(ALUMNO, HOY)
    await repo.sumarUna(ALUMNO, HOY)

    await repo.restarUna(ALUMNO, HOY)

    expect((await repo.porDia(HOY))[0]?.cantidad).toBe(1)
  })

  it('nunca baja de cero', async () => {
    // Un contador negativo restaría, al sumar el trimestre, participaciones que
    // sí ocurrieron otros días.
    await repo.sumarUna(ALUMNO, HOY)
    await repo.restarUna(ALUMNO, HOY)
    await repo.restarUna(ALUMNO, HOY)

    expect((await repo.porDia(HOY))[0]?.cantidad).toBe(0)
  })

  it('restar donde no hay nada no escribe ni encola', async () => {
    // Sostener el dedo sobre un alumno sin marcas no deja una fila en cero ni un
    // cambio pendiente que subir.
    await repo.restarUna(ALUMNO, HOY)

    expect(await repo.porDia(HOY)).toHaveLength(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('la fila se queda en cero, no se borra', async () => {
    // Deshacer y volver a marcar no debería ser crear, borrar y volver a crear.
    await repo.sumarUna(ALUMNO, HOY)
    await repo.restarUna(ALUMNO, HOY)
    const enCero = await repo.porDia(HOY)
    expect(enCero).toHaveLength(1)

    await repo.sumarUna(ALUMNO, HOY)
    const devuelta = await repo.porDia(HOY)
    expect(devuelta).toHaveLength(1)
    expect(devuelta[0]?.id).toBe(enCero[0]?.id)
    expect(devuelta[0]?.cantidad).toBe(1)
  })
})

describe('porRango', () => {
  it('trae los días del rango y deja fuera los demás', async () => {
    // La atribución al trimestre se deriva de la fecha, nunca se guarda.
    await repo.sumarUna(ALUMNO, '2026-08-23')
    await repo.sumarUna(ALUMNO, INICIO)
    await repo.sumarUna(ALUMNO, HOY)
    await repo.sumarUna(ALUMNO, '2026-12-19')

    expect(await repo.porRango(INICIO, FIN)).toHaveLength(2)
  })

  it('suma de varios días para el mismo alumno: son filas distintas', async () => {
    await repo.sumarUna(ALUMNO, AYER)
    await repo.sumarUna(ALUMNO, HOY)
    await repo.sumarUna(ALUMNO, HOY)

    const delRango = await repo.porRango(INICIO, FIN)
    expect(delRango).toHaveLength(2)
    expect(delRango.reduce((suma, p) => suma + p.cantidad, 0)).toBe(3)
  })
})

describe('observarDia', () => {
  it('emite de nuevo al sumar', async () => {
    const emisiones: number[] = []
    const sub = repo.observarDia(HOY).subscribe((filas) => {
      emisiones.push(filas.reduce((suma, p) => suma + p.cantidad, 0))
    })

    await new Promise((r) => setTimeout(r, 10))
    await repo.sumarUna(ALUMNO, HOY)
    await new Promise((r) => setTimeout(r, 30))
    sub.unsubscribe()

    expect(emisiones[0]).toBe(0)
    expect(emisiones.at(-1)).toBe(1)
  })
})
