// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NuevoAlumno } from '@/data/ports/alumnos'
import type { Alumno, DatosAlumno } from '@/domain/entities'

import { DexieAlumnosRepo } from './alumnos.adapter'
import { db } from './db'

const repo = new DexieAlumnosRepo()

// Nombres inventados: en el repositorio no va un solo nombre real del salón.
// El `numero_lista` de estos fixtures es el valor **guardado**, el que ya no
// sale de ningún método de lectura desde D-033: cada prueba que le importe
// vuelve a leerlo de `db.alumnos` directamente, nunca de `repo.lista()`.
const alumno = (numero_lista: number, nombre: string, deleted_at: string | null = null): Alumno => ({
  id: `alumno-${numero_lista}`,
  nombre,
  ciclo_id: null,
  numero_lista,
  fecha_nacimiento: null,
  curp: null,
  sexo: null,
  updated_at: '2026-08-18T08:00:00.000Z',
  deleted_at,
})

beforeEach(async () => {
  await db.open()
  await db.alumnos.clear()
})

describe('lista', () => {
  it('devuelve el grupo en orden alfabético, no en el de inserción', async () => {
    await db.alumnos.bulkPut([
      alumno(3, 'Cruz, Regina'),
      alumno(1, 'Aguilar, Bruno'),
      alumno(2, 'Bautista, Ana'),
    ])

    expect((await repo.lista()).map((a) => a.nombre)).toEqual([
      'Aguilar, Bruno',
      'Bautista, Ana',
      'Cruz, Regina',
    ])
  })

  it('el numero_lista que devuelve es la posición alfabética, no la guardada (D-033)', async () => {
    await db.alumnos.bulkPut([
      alumno(3, 'Cruz, Regina'),
      alumno(1, 'Aguilar, Bruno'),
      alumno(2, 'Bautista, Ana'),
    ])

    expect((await repo.lista()).map((a) => a.numero_lista)).toEqual([1, 2, 3])
  })

  it('el que se dio de alta después va donde le toca, no al final', async () => {
    // El caso que el número guardado no sabe resolver: llegó en noviembre, con
    // un número interno más alto que todos, y se le busca por la A.
    await db.alumnos.bulkPut([
      alumno(1, 'Aguilar, Bruno'),
      alumno(2, 'Cruz, Regina'),
      alumno(39, 'Aguirre, Zoe'),
    ])

    const lista = await repo.lista()
    expect(lista.map((a) => a.nombre)).toEqual(['Aguilar, Bruno', 'Aguirre, Zoe', 'Cruz, Regina'])
    // Y el número que ve la maestra es 1, 2, 3: su lugar en el salón, no su
    // número interno de alta.
    expect(lista.map((a) => a.numero_lista)).toEqual([1, 2, 3])
  })

  it('un apellido acentuado va donde suena, no después de la Z', async () => {
    await db.alumnos.bulkPut([
      alumno(1, 'Barrera, Diego'),
      alumno(2, 'Ávila, Mariana'),
      alumno(3, 'Aguilar, Bruno'),
    ])

    expect((await repo.lista()).map((a) => a.nombre)).toEqual([
      'Aguilar, Bruno',
      'Ávila, Mariana',
      'Barrera, Diego',
    ])
  })

  it('filtra los borrados', async () => {
    await db.alumnos.bulkPut([
      alumno(1, 'Aguilar, Bruno'),
      alumno(2, 'Bautista, Ana', '2026-08-18T09:00:00.000Z'),
    ])

    const lista = await repo.lista()
    expect(lista).toHaveLength(1)
    expect(lista[0]?.nombre).toBe('Aguilar, Bruno')
    expect(lista[0]?.numero_lista).toBe(1)
  })

  it('un grupo vacío devuelve lista vacía, no falla', async () => {
    expect(await repo.lista()).toEqual([])
  })
})

describe('observarLista', () => {
  it('emite el grupo y vuelve a emitir cuando cambia', async () => {
    const emisiones: number[] = []
    const sub = repo.observarLista().subscribe((alumnos) => {
      emisiones.push(alumnos.length)
    })

    await vi.waitFor(() => expect(emisiones.length).toBeGreaterThan(0))
    expect(emisiones[0]).toBe(0)

    await db.alumnos.put(alumno(1, 'Aguilar, Bruno'))
    await vi.waitFor(() => expect(emisiones.at(-1)).toBe(1))

    sub.unsubscribe()
  })
})

/**
 * Estos casos vivían en `application/grupo.test.ts`, colgados de la semilla que
 * se retiró. Prueban el puerto, no la semilla: `sembrar()` sigue siendo la vía
 * por la que entra la lista, ahora desde la carga asistida por IA.
 *
 * La identidad ya no es `numero_lista` (docs/DECISIONES.md D-033): es CURP
 * cuando ambos lo tienen, y si no, nombre exacto. Los fixtures de este bloque
 * traen `curp: null` a propósito para ejercitar el segundo camino, salvo donde
 * el nombre del caso diga lo contrario.
 */
describe('sembrar', () => {
  const LISTA: DatosAlumno[] = [
    { numero_lista: 1, nombre: 'Aguilar Mendoza, Bruno', fecha_nacimiento: '2017-03-14', curp: null, sexo: null },
    { numero_lista: 2, nombre: 'Barrera Solís, Diego', fecha_nacimiento: null, curp: null, sexo: null },
    { numero_lista: 3, nombre: 'Cruz Herrera, Regina', fecha_nacimiento: '2017-09-23', curp: null, sexo: null },
  ]

  beforeEach(async () => {
    await db.outbox.clear()
  })

  it('carga el grupo completo, en el orden de la lista', async () => {
    await repo.sembrar(LISTA)

    const lista = await repo.lista()
    expect(lista.map((a) => a.nombre)).toEqual([
      'Aguilar Mendoza, Bruno',
      'Barrera Solís, Diego',
      'Cruz Herrera, Regina',
    ])
  })

  it('genera UUID y updated_at para cada alumno', async () => {
    await repo.sembrar(LISTA)

    const lista = await repo.lista()
    expect(new Set(lista.map((a) => a.id)).size).toBe(lista.length)
    for (const alumno of lista) {
      expect(alumno.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
      expect(alumno.updated_at).toMatch(/Z$/)
      expect(alumno.deleted_at).toBeNull()
    }
  })

  it('es idempotente: sembrar dos veces no duplica ni reescribe', async () => {
    await repo.sembrar(LISTA)
    const antes = await repo.lista()
    const pendientes = await db.outbox.count()

    await repo.sembrar(LISTA)

    const despues = await repo.lista()
    expect(despues).toHaveLength(antes.length)
    // Mismos ids: no se recrearon.
    expect(despues.map((a) => a.id)).toEqual(antes.map((a) => a.id))
    // Y la segunda pasada no encoló nada: nada cambió.
    expect(await db.outbox.count()).toBe(pendientes)
  })

  it('recargar la lista con CURP se la escribe a quien ya existía, emparejando por nombre', async () => {
    // Sin CURP de ningún lado, la primera pasada solo puede emparejar por
    // nombre. Sin el CURP en la comparación de `sembrar`, esta segunda pasada
    // no escribiría nada más: el nombre y la fecha ya coinciden.
    await repo.sembrar(LISTA)
    const original = (await repo.lista()).find((a) => a.nombre === LISTA[0]!.nombre)!

    await repo.sembrar([{ ...LISTA[0]!, curp: 'AUVG160520MNLRLRA3', sexo: null }])

    const despues = (await repo.lista()).find((a) => a.nombre === LISTA[0]!.nombre)!
    expect(despues.id).toBe(original.id)
    expect(despues.curp).toBe('AUVG160520MNLRLRA3')
  })

  it('recargar la lista con el sexo se lo escribe a quien ya existía', async () => {
    // La gemela de la de arriba, y por la misma razón: sin el sexo en la
    // comparación de `sembrar`, volver a cargar la lista de la escuela —que sí
    // trae la columna— no escribiría nada, porque el resto ya coincide.
    await repo.sembrar(LISTA)
    const original = (await repo.lista()).find((a) => a.nombre === LISTA[0]!.nombre)!

    await repo.sembrar([{ ...LISTA[0]!, sexo: 'H' }])

    const despues = (await repo.lista()).find((a) => a.nombre === LISTA[0]!.nombre)!
    expect(despues.id).toBe(original.id)
    expect(despues.sexo).toBe('H')
  })

  it('con CURP en las dos pasadas, la identidad es el CURP y no el nombre', async () => {
    const CONCURP: DatosAlumno = {
      numero_lista: 1,
      nombre: 'Aguilar Mendoza, Bruno',
      fecha_nacimiento: '2017-03-14',
      curp: 'AUVG160520MNLRLRA3',
      sexo: null,
    }
    await repo.sembrar([CONCURP])
    const original = (await repo.lista())[0]!

    // El nombre cambia, el CURP no: sigue siendo la misma persona.
    await repo.sembrar([{ ...CONCURP, nombre: 'Aguilar Mendoza, Bruno Alejandro' }])

    const despues = (await repo.lista())[0]!
    expect(despues.id).toBe(original.id)
    expect(despues.nombre).toBe('Aguilar Mendoza, Bruno Alejandro')
    expect(await db.alumnos.count()).toBe(1)
  })

  it('una fila escrita antes de que el campo existiera se lee como sin asignar', async () => {
    // `sexo` entró sin `version()` porque no lleva índice, así que las filas
    // viejas lo traen `undefined`. Fuera del adaptador eso no puede verse: el
    // dominio declara `null` y la pantalla sabe decir «sin asignar».
    await repo.sembrar(LISTA)
    const id = (await repo.lista())[0]!.id
    const vieja = await db.alumnos.get(id)
    delete (vieja as Partial<Alumno>).sexo
    delete (vieja as Partial<Alumno>).curp
    await db.alumnos.put(vieja!)

    const leida = (await repo.lista())[0]!
    expect(leida.sexo).toBeNull()
    expect(leida.curp).toBeNull()
  })

  it('sin CURP, un nombre corregido no se empareja por nombre: entra como alumno nuevo', async () => {
    // El costo aceptado de dejar el número guardado fuera de la identidad
    // (D-033): sin CURP, cambiar el nombre en el archivo y volver a cargarlo ya
    // no se sabe reconocer como la misma persona. La corrección de un nombre
    // mal leído vive en *Ajustes → Alumnos* (D-026), no en reimportar la lista.
    await repo.sembrar(LISTA)

    await repo.sembrar([{ ...LISTA[0]!, nombre: 'Aguilar Mendoza, Bruno Alejandro' }])

    const lista = await repo.lista()
    expect(lista.map((a) => a.nombre)).toContain('Aguilar Mendoza, Bruno')
    expect(lista.map((a) => a.nombre)).toContain('Aguilar Mendoza, Bruno Alejandro')
    expect(lista).toHaveLength(LISTA.length + 1)
  })

  it('no borra a un alumno que ya no está en la lista nueva', async () => {
    await repo.sembrar(LISTA)

    await repo.sembrar([LISTA[0]!])

    // Dar de baja es una decisión con datos de por medio, no un efecto
    // secundario de volver a cargar la lista.
    expect(await repo.lista()).toHaveLength(LISTA.length)
  })

  it('revive a un alumno borrado si vuelve a estar en la lista', async () => {
    await repo.sembrar(LISTA)
    const primero = (await repo.lista()).find((a) => a.nombre === LISTA[0]!.nombre)
    await db.alumnos.update(primero?.id ?? '', { deleted_at: '2026-08-18T09:00:00.000Z' })
    expect(await repo.lista()).toHaveLength(LISTA.length - 1)

    await repo.sembrar(LISTA)

    const lista = await repo.lista()
    expect(lista).toHaveLength(LISTA.length)
    expect(lista.find((a) => a.nombre === LISTA[0]!.nombre)?.id).toBe(primero?.id)
  })

  it('dos filas del archivo no pueden emparejar con el mismo alumno existente', async () => {
    // Cada existente se consume a lo más una vez: si dos filas nuevas
    // calzaran por nombre con el mismo alumno, la segunda entra como alumno
    // nuevo en vez de pisar a la primera.
    await repo.sembrar([LISTA[0]!])

    await repo.sembrar([LISTA[0]!, LISTA[0]!])

    expect(await repo.lista()).toHaveLength(2)
  })
})

/**
 * El grupo cuelga del ciclo abierto (D-025). Es lo que permite guardar varias
 * generaciones sin que la pantalla diaria las mezcle.
 */
describe('el grupo se acota al ciclo abierto', () => {
  const ciclo = (id: string, estado: 'abierto' | 'cerrado', updated_at: string) => ({
    id,
    nombre: id,
    estado,
    updated_at,
    deleted_at: null,
  })

  beforeEach(async () => {
    await db.ciclos.clear()
    await db.outbox.clear()
  })

  it('sin ciclo configurado devuelve los alumnos que no tienen ninguno', async () => {
    // El primer día: se pasa lista antes de haber configurado nada.
    await db.alumnos.bulkPut([alumno(1, 'Aguilar, Bruno'), alumno(2, 'Barrera, Diego')])

    expect(await repo.lista()).toHaveLength(2)
  })

  it('con un ciclo abierto devuelve solo a los suyos', async () => {
    await db.ciclos.put(ciclo('ciclo-a', 'abierto', '2026-08-01T00:00:00.000Z'))
    await db.alumnos.bulkPut([
      { ...alumno(1, 'Del ciclo abierto'), ciclo_id: 'ciclo-a' },
      { ...alumno(2, 'Del ciclo pasado'), ciclo_id: 'ciclo-viejo' },
      alumno(3, 'Sin ciclo'),
    ])

    const lista = await repo.lista()
    expect(lista).toHaveLength(1)
    expect(lista[0]?.nombre).toBe('Del ciclo abierto')
  })

  it('los alumnos del ciclo cerrado no aparecen, pero siguen en la base', async () => {
    // No se borran: consultarlos es justo lo que hace falta para una aclaración
    // de boleta del año pasado.
    await db.ciclos.bulkPut([
      ciclo('ciclo-viejo', 'cerrado', '2026-07-01T00:00:00.000Z'),
      ciclo('ciclo-nuevo', 'abierto', '2026-08-01T00:00:00.000Z'),
    ])
    await db.alumnos.bulkPut([
      { ...alumno(1, 'Del año pasado'), ciclo_id: 'ciclo-viejo' },
      { ...alumno(2, 'De este año'), ciclo_id: 'ciclo-nuevo' },
    ])

    expect((await repo.lista()).map((a) => a.nombre)).toEqual(['De este año'])
    expect(await db.alumnos.count()).toBe(2)
  })

  it('sembrar estampa el ciclo abierto', async () => {
    await db.ciclos.put(ciclo('ciclo-a', 'abierto', '2026-08-01T00:00:00.000Z'))

    await repo.sembrar([
      { numero_lista: 1, nombre: 'Aguilar, Bruno', fecha_nacimiento: null, curp: null, sexo: null },
    ])

    expect((await repo.lista())[0]?.ciclo_id).toBe('ciclo-a')
  })

  it('el nombre (o el CURP) identifica dentro del ciclo, no entre ciclos', async () => {
    // La corrupción que esto evita: sin acotar, un alumno de este año podría
    // emparejar por nombre con uno del ciclo anterior y llevarse su `id` —y con
    // él su asistencia y sus calificaciones—.
    await db.alumnos.put({ ...alumno(1, 'Del año pasado'), ciclo_id: 'ciclo-viejo' })
    await db.ciclos.put(ciclo('ciclo-nuevo', 'abierto', '2026-08-01T00:00:00.000Z'))

    await repo.sembrar([
      { numero_lista: 1, nombre: 'Del año pasado', fecha_nacimiento: null, curp: null, sexo: null },
    ])

    // Mismo nombre, pero en un ciclo distinto: no debe emparejar con el viejo.
    const nuevo = (await repo.lista())[0]
    expect(nuevo?.id).not.toBe('alumno-1')
    // Y el del año pasado sigue intacto, con su nombre y su id.
    expect((await db.alumnos.get('alumno-1'))?.nombre).toBe('Del año pasado')
  })
})

/**
 * Alta, corrección y baja uno por uno (D-026). La lista completa sigue entrando
 * por `sembrar()`; esto es lo que aquella no puede cubrir.
 *
 * Desde D-033 ninguno de los tres pide ni acepta `numero_lista`: el adaptador
 * lo asigna internamente al dar de alta y lo conserva sin tocar al corregir.
 */
describe('administrar alumnos', () => {
  beforeEach(async () => {
    await db.ciclos.clear()
    await db.outbox.clear()
  })

  const DATOS: NuevoAlumno = { nombre: 'Llegó Después, Ana', fecha_nacimiento: null, curp: null, sexo: null }

  it('agregar da de alta con id, updated_at y sin baja', async () => {
    await repo.agregar(DATOS)

    const lista = await repo.lista()
    expect(lista).toHaveLength(1)
    expect(lista[0]?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(lista[0]?.updated_at).toMatch(/Z$/)
    expect(lista[0]?.deleted_at).toBeNull()
  })

  it('agregar encola en la outbox', async () => {
    await repo.agregar(DATOS)

    const pendientes = await db.outbox.toArray()
    expect(pendientes.filter((c) => c.tabla === 'alumnos')).toHaveLength(1)
  })

  it('agregar estampa el ciclo abierto', async () => {
    await db.ciclos.put({
      id: 'ciclo-a',
      nombre: 'ciclo-a',
      estado: 'abierto',
      updated_at: '2026-08-01T00:00:00.000Z',
      deleted_at: null,
    })

    await repo.agregar(DATOS)

    expect((await repo.lista())[0]?.ciclo_id).toBe('ciclo-a')
  })

  it('agregar asigna solo el siguiente número interno, sin que nadie lo pida', async () => {
    await repo.agregar(DATOS)
    await repo.agregar({ ...DATOS, nombre: 'Otra, Otra' })

    // El número interno no sale de ningún método de lectura: se lee crudo,
    // directo de Dexie, para comprobar que no colisiona.
    const crudos = (await db.alumnos.toArray()).map((a) => a.numero_lista)
    expect(new Set(crudos).size).toBe(2)
  })

  it('agregar no reutiliza el número interno de un dado de baja', async () => {
    await repo.agregar(DATOS)
    const primero = (await repo.lista())[0]!.id
    await repo.darDeBaja(primero)

    await repo.agregar({ ...DATOS, nombre: 'Otra, Otra' })

    const crudos = (await db.alumnos.toArray()).map((a) => a.numero_lista)
    expect(new Set(crudos).size).toBe(2)
  })

  it('editar corrige conservando el id, que es de donde cuelga su historia', async () => {
    await repo.agregar(DATOS)
    const original = (await repo.lista())[0]!

    await repo.editar(original.id, { ...DATOS, nombre: 'Corregido, Nombre' })

    const lista = await repo.lista()
    expect(lista[0]?.id).toBe(original.id)
    expect(lista[0]?.nombre).toBe('Corregido, Nombre')
  })

  it('editar conserva el número interno sin que se le pueda pedir cambiarlo', async () => {
    await repo.agregar(DATOS)
    const id = (await repo.lista())[0]!.id
    const numeroAntes = (await db.alumnos.get(id))?.numero_lista

    await repo.editar(id, { ...DATOS, nombre: 'Corregido, Nombre' })

    expect((await db.alumnos.get(id))?.numero_lista).toBe(numeroAntes)
  })

  it('editar no muda de ciclo', async () => {
    await db.alumnos.put({
      id: 'a-1',
      ciclo_id: 'ciclo-viejo',
      nombre: 'Del año pasado',
      numero_lista: 1,
      fecha_nacimiento: null,
      curp: null,
      sexo: null,
      updated_at: '2025-08-25T00:00:00.000Z',
      deleted_at: null,
    })

    await repo.editar('a-1', {
      nombre: 'Corregido',
      fecha_nacimiento: null,
      curp: null,
      sexo: null,
    })

    expect((await db.alumnos.get('a-1'))?.ciclo_id).toBe('ciclo-viejo')
  })

  it('dar de baja lo saca de la lista sin borrar la fila', async () => {
    await repo.agregar(DATOS)
    const id = (await repo.lista())[0]!.id

    await repo.darDeBaja(id)

    expect(await repo.lista()).toHaveLength(0)
    expect(await db.alumnos.count()).toBe(1)
    expect((await db.alumnos.get(id))?.deleted_at).toMatch(/Z$/)
  })

  it('la baja se encola como upsert, no como delete', async () => {
    // El borrado es suave: lo que viaja es la fila con su `deleted_at` puesto.
    // Un delete en el servidor perdería la baja al restaurar.
    await repo.agregar(DATOS)
    const id = (await repo.lista())[0]!.id
    await db.outbox.clear()

    await repo.darDeBaja(id)

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.op).toBe('upsert')
    expect(pendientes[0]?.registro_id).toBe(id)
  })

  it('reactivar deshace la baja', async () => {
    await repo.agregar(DATOS)
    const id = (await repo.lista())[0]!.id
    await repo.darDeBaja(id)

    await repo.reactivar(id)

    expect(await repo.lista()).toHaveLength(1)
    expect((await db.alumnos.get(id))?.deleted_at).toBeNull()
  })

  it('conBajas trae a los dos, en el mismo orden alfabético', async () => {
    // Una baja no cambia de sitio en la lista, solo deja de contar: aunque el
    // que se fue tenga el número interno más alto, su apellido lo pone primero.
    await repo.agregar({ ...DATOS, nombre: 'Sigue, Aquí' })
    await repo.agregar({ ...DATOS, nombre: 'Se, Fue' })
    const seFue = (await repo.lista()).find((a) => a.nombre === 'Se, Fue')!
    await repo.darDeBaja(seFue.id)

    const todos = await repo.conBajas()
    expect(todos.map((a) => a.nombre)).toEqual(['Se, Fue', 'Sigue, Aquí'])
    expect(await repo.lista()).toHaveLength(1)
  })

  it('editar y dar de baja se niegan ante un alumno que no existe', async () => {
    await expect(repo.editar('no-existe', DATOS)).rejects.toThrow(/No existe el alumno/)
    await expect(repo.darDeBaja('no-existe')).rejects.toThrow(/No existe el alumno/)
  })
})
