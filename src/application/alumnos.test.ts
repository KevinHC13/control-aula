// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { repos } from '@/data'
import { db } from '@/data/dexie/db'
import type { Alumno } from '@/domain/entities'

import {
  agregarAlumno,
  darDeBajaAlumno,
  editarAlumno,
  editarFormulario,
  formularioDe,
  formularioNuevo,
  reactivarAlumno,
  revisarFormulario,
  separarBajas,
} from './alumnos'

const alumno = (n: number, nombre = `Apellido${n}, Nombre`, baja = false): Alumno => ({
  id: `alumno-${n}`,
  ciclo_id: null,
  nombre,
  numero_lista: n,
  fecha_nacimiento: null,
  curp: null,
  sexo: null,
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: baja ? '2026-10-01T00:00:00.000Z' : null,
})

beforeEach(async () => {
  await db.open()
  await db.alumnos.clear()
  await db.ciclos.clear()
  await db.outbox.clear()
})

afterAll(() => {
  db.close()
})

describe('revisarFormulario', () => {
  it('acepta un alumno nuevo bien escrito', () => {
    expect(
      revisarFormulario({ nombre: 'Nueva, Ana', fecha_nacimiento: '', curp: '', sexo: '' }),
    ).toBeUndefined()
  })

  it('pide el nombre', () => {
    expect(
      revisarFormulario({ nombre: '  ', fecha_nacimiento: '', curp: '', sexo: '' }),
    ).toMatch(/Falta el nombre/)
  })

  it('la fecha es opcional, pero si viene tiene que ser AAAA-MM-DD', () => {
    expect(
      revisarFormulario({ nombre: 'Ana', fecha_nacimiento: '', curp: '', sexo: '' }),
    ).toBeUndefined()
    expect(
      revisarFormulario({ nombre: 'Ana', fecha_nacimiento: '14/03/2017', curp: '', sexo: '' }),
    ).toMatch(/AAAA-MM-DD/)
  })

  it('la CURP es opcional, pero si viene tiene que traer 18 caracteres', () => {
    expect(
      revisarFormulario({ nombre: 'Ana', fecha_nacimiento: '', curp: '', sexo: '' }),
    ).toBeUndefined()
    expect(
      revisarFormulario({ nombre: 'Ana', fecha_nacimiento: '', curp: 'CORTA', sexo: '' }),
    ).toMatch(/18 caracteres/)
  })
})

describe('formularioNuevo y formularioDe', () => {
  it('el de alta llega vacío, sin número que proponer (D-033)', () => {
    expect(formularioNuevo()).toEqual({
      nombre: '',
      fecha_nacimiento: '',
      curp: '',
      sexo: '',
    })
  })

  it('el de edición llega con lo que el alumno ya tiene, y sin número', () => {
    expect(formularioDe({ ...alumno(7, 'Ríos, Ana'), fecha_nacimiento: '2017-03-14', curp: null, sexo: null })).toEqual({
      nombre: 'Ríos, Ana',
      fecha_nacimiento: '2017-03-14',
      curp: '',
      sexo: '',
    })
  })

  it('la fecha ausente se edita como campo vacío, no como «null»', () => {
    expect(formularioDe(alumno(1)).fecha_nacimiento).toBe('')
  })
})

describe('editarFormulario', () => {
  const VACIO = { nombre: '', fecha_nacimiento: '', curp: '', sexo: '' }

  it('escribir la CURP llena la fecha de nacimiento', () => {
    // La misma regla que en la carga de la lista: la CURP la trae dentro.
    const con = editarFormulario(VACIO, 'curp', 'AUVG160520MNLRLRA3')

    expect(con.fecha_nacimiento).toBe('2016-05-20')
  })

  it('no pisa una fecha que ya estaba escrita', () => {
    const con = editarFormulario(
      { ...VACIO, fecha_nacimiento: '2016-05-21' },
      'curp',
      'AUVG160520MNLRLRA3',
    )

    expect(con.fecha_nacimiento).toBe('2016-05-21')
  })

  it('escribir la CURP llena también el sexo', () => {
    // Son las dos cosas que la CURP trae dentro. Teclearla al alumno que llegó
    // en noviembre deja los dos campos puestos sin escribirlos.
    expect(editarFormulario(VACIO, 'curp', 'AUVG160520MNLRLRA3').sexo).toBe('M')
    expect(editarFormulario(VACIO, 'curp', 'PEGJ151102HNLRRVA2').sexo).toBe('H')
  })

  it('no pisa un sexo que ya estaba puesto', () => {
    // Rellena y no sobrescribe, igual que la fecha: quien lo puso a mano lo
    // puso por algo, y puede ser que la CURP impresa esté mal.
    const con = editarFormulario({ ...VACIO, sexo: 'H' }, 'curp', 'AUVG160520MNLRLRA3')

    expect(con.sexo).toBe('H')
  })

  it('una CURP a medias no cambia el sexo a cada tecla', () => {
    expect(editarFormulario(VACIO, 'curp', 'AUVG1605').sexo).toBe('')
  })

  it('una CURP a medias no cambia la fecha a cada tecla', () => {
    expect(editarFormulario(VACIO, 'curp', 'AUVG1605').fecha_nacimiento).toBe('')
  })

  it('la sube a mayúsculas mientras se escribe', () => {
    expect(editarFormulario(VACIO, 'curp', 'auvg16').curp).toBe('AUVG16')
  })

  it('los demás campos se escriben tal cual', () => {
    expect(editarFormulario(VACIO, 'nombre', 'Ríos, Ana').nombre).toBe('Ríos, Ana')
  })
})

describe('agregarAlumno', () => {
  it('guarda al alumno con los datos limpios', async () => {
    await agregarAlumno({ nombre: '  Llegó Después, Ana  ', fecha_nacimiento: '', curp: '', sexo: '' })

    const lista = await repos.alumnos.lista()
    expect(lista).toHaveLength(1)
    // El nombre sin los espacios de sobra, y la fecha vacía como dato ausente.
    expect(lista[0]?.nombre).toBe('Llegó Después, Ana')
    expect(lista[0]?.fecha_nacimiento).toBeNull()
  })

  it('vuelve a validar aunque la pantalla ya lo hiciera', async () => {
    // El caso de uso no puede confiar en que alguien lo llame bien.
    await expect(
      agregarAlumno({ nombre: '', fecha_nacimiento: '', curp: '', sexo: '' }),
    ).rejects.toThrow(/Falta el nombre/)
    expect(await repos.alumnos.lista()).toHaveLength(0)
  })

  it('dos altas no necesitan número: cada una toma su lugar por apellido', async () => {
    await agregarAlumno({ nombre: 'Zamora, Bruno', fecha_nacimiento: '', curp: '', sexo: '' })
    await agregarAlumno({ nombre: 'Aguilar, Ana', fecha_nacimiento: '', curp: '', sexo: '' })

    const lista = await repos.alumnos.lista()
    expect(lista.map((a) => a.nombre)).toEqual(['Aguilar, Ana', 'Zamora, Bruno'])
    expect(lista.map((a) => a.numero_lista)).toEqual([1, 2])
  })
})

describe('editarAlumno', () => {
  it('corrige conservando el id', async () => {
    await agregarAlumno({ nombre: 'Mal Escrito', fecha_nacimiento: '', curp: '', sexo: '' })
    const antes = (await repos.alumnos.lista())[0]!

    await editarAlumno(antes.id, {
      nombre: 'Bien Escrito, Ana',
      fecha_nacimiento: '2017-03-14',
      curp: '',
      sexo: '',
    })

    const despues = (await repos.alumnos.lista())[0]!
    expect(despues.id).toBe(antes.id)
    expect(despues.nombre).toBe('Bien Escrito, Ana')
    expect(despues.fecha_nacimiento).toBe('2017-03-14')
  })
})

describe('darDeBajaAlumno y reactivarAlumno', () => {
  it('la baja lo saca del grupo sin borrar nada suyo', async () => {
    await agregarAlumno({ nombre: 'Se Fue, Ana', fecha_nacimiento: '', curp: '', sexo: '' })
    const id = (await repos.alumnos.lista())[0]!.id
    // Un registro suyo, para comprobar que sigue ahí.
    await db.asistencia.put({
      id: 'asistencia-1',
      alumno_id: id,
      fecha: '2026-09-01',
      estado: 'presente',
      updated_at: '2026-09-01T00:00:00.000Z',
      deleted_at: null,
    })

    await darDeBajaAlumno(id)

    expect(await repos.alumnos.lista()).toHaveLength(0)
    expect(await db.alumnos.count()).toBe(1)
    expect(await db.asistencia.count()).toBe(1)
  })

  it('reactivar lo devuelve al grupo', async () => {
    await agregarAlumno({ nombre: 'Toqué Mal, Ana', fecha_nacimiento: '', curp: '', sexo: '' })
    const id = (await repos.alumnos.lista())[0]!.id

    await darDeBajaAlumno(id)
    await reactivarAlumno(id)

    expect(await repos.alumnos.lista()).toHaveLength(1)
  })
})

describe('separarBajas', () => {
  it('parte el grupo en vigentes y bajas, conservando el orden', () => {
    const { vigentes, bajas } = separarBajas([
      alumno(1),
      alumno(2, 'Se fue', true),
      alumno(3),
    ])

    expect(vigentes.map((a) => a.numero_lista)).toEqual([1, 3])
    expect(bajas.map((a) => a.numero_lista)).toEqual([2])
  })

  it('un grupo sin bajas devuelve la lista entera y ninguna baja', () => {
    const { vigentes, bajas } = separarBajas([alumno(1), alumno(2)])
    expect(vigentes).toHaveLength(2)
    expect(bajas).toEqual([])
  })
})
