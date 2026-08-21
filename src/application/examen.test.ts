// IndexedDB no existe en node: fake-indexeddb la provee en memoria.
import 'fake-indexeddb/auto'

import { afterAll, beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/data/dexie/db'
import type { ExamenDelTrimestre } from '@/data/ports/evaluacion'
import type { Alumno, ResultadoExamen, Trimestre } from '@/domain/entities'
import type { CampoFormativo } from '@/domain/values'

import {
  camposDelExamen,
  camposQueQuedanFueraDeRango,
  conDigito,
  contarConResultado,
  examenListo,
  filasDeExamen,
  guardarPreguntasExamen,
  registrarAciertos,
  siguienteSinResultado,
  sinUltimoDigito,
} from './examen'

const trimestre: Trimestre = {
  id: 'trimestre-1',
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: null,
  ciclo_id: 'ciclo-1',
  numero: 1,
  inicio: '2026-08-24',
  fin: '2026-11-27',
  estado: 'abierto',
  cerrado_en: null,
}

const cerrado: Trimestre = {
  ...trimestre,
  estado: 'cerrado',
  cerrado_en: '2026-11-28T00:00:00.000Z',
}

const examenCon = (
  preguntas: Partial<Record<CampoFormativo, number>> | null,
): ExamenDelTrimestre => ({
  ponderado: {
    id: 'ct-examen',
    updated_at: '2026-08-24T00:00:00.000Z',
    deleted_at: null,
    trimestre_id: trimestre.id,
    criterio_id: 'criterio-examen',
    peso: 30,
    orden: 1,
    meta_participacion: null,
    retardos_por_falta: null,
  },
  criterio: {
    id: 'criterio-examen',
    updated_at: '2026-08-24T00:00:00.000Z',
    deleted_at: null,
    nombre: 'Examen',
    tipo: 'examen',
  },
  config:
    preguntas === null
      ? null
      : {
          id: 'config-1',
          updated_at: '2026-11-01T00:00:00.000Z',
          deleted_at: null,
          criterio_trimestre_id: 'ct-examen',
          preguntas,
        },
})

const alumno = (i: number): Alumno => ({
  id: `alumno-${i}`,
  updated_at: '2026-08-17T00:00:00.000Z',
  deleted_at: null,
  nombre: `Apellido${String(i).padStart(2, '0')}, Nombre`,
  numero_lista: i,
  fecha_nacimiento: null,
})

const resultado = (
  alumnoId: string,
  aciertos: Partial<Record<CampoFormativo, number>>,
): ResultadoExamen => ({
  id: `resultado-${alumnoId}`,
  updated_at: '2026-11-02T00:00:00.000Z',
  deleted_at: null,
  criterio_trimestre_id: 'ct-examen',
  alumno_id: alumnoId,
  aciertos,
})

const DOS_CAMPOS = camposDelExamen(
  examenCon({ lenguajes: 20, saberes_pensamiento_cientifico: 15 }),
)

beforeEach(async () => {
  await db.open()
  await db.examen_config.clear()
  await db.resultados_examen.clear()
  await db.outbox.clear()
})

afterAll(() => {
  db.close()
})

describe('camposDelExamen', () => {
  it('solo los campos con preguntas, en el orden en que se reportan', () => {
    const campos = camposDelExamen(
      examenCon({ humano_comunitario: 10, lenguajes: 20 }),
    )
    expect(campos.map((c) => c.campo)).toEqual(['lenguajes', 'humano_comunitario'])
    expect(campos.map((c) => c.preguntas)).toEqual([20, 10])
  })

  it('un campo en cero no se ofrece: no hay denominador', () => {
    const campos = camposDelExamen(examenCon({ lenguajes: 20, humano_comunitario: 0 }))
    expect(campos.map((c) => c.campo)).toEqual(['lenguajes'])
  })

  it('sin configuración devuelve la lista vacía, no falla', () => {
    expect(camposDelExamen(examenCon(null))).toEqual([])
  })

  it('trae el nombre con el que ella lo reporta', () => {
    expect(camposDelExamen(examenCon({ lenguajes: 20 }))[0]?.nombre).toBe('Lenguajes')
  })
})

describe('examenListo', () => {
  it('con preguntas se puede capturar', () => {
    expect(examenListo(examenCon({ lenguajes: 20 }))).toBe(true)
  })

  it('sin configuración, o con todo en cero, todavía no', () => {
    expect(examenListo(examenCon(null))).toBe(false)
    expect(examenListo(examenCon({ lenguajes: 0 }))).toBe(false)
  })
})

describe('filasDeExamen', () => {
  it('sin captura, nadie tiene resultado y no hay cifra', () => {
    const filas = filasDeExamen([alumno(1), alumno(2)], [], DOS_CAMPOS)
    expect(filas.every((f) => !f.completa)).toBe(true)
    expect(filas.every((f) => f.capturados === 0)).toBe(true)
    expect(filas[0]?.aciertos).toEqual({})
  })

  it('completa solo con cifra en todos los campos del examen', () => {
    const filas = filasDeExamen(
      [alumno(1), alumno(2)],
      [
        resultado('alumno-1', { lenguajes: 18, saberes_pensamiento_cientifico: 10 }),
        resultado('alumno-2', { lenguajes: 12 }),
      ],
      DOS_CAMPOS,
    )
    expect(filas[0]?.completa).toBe(true)
    expect(filas[1]?.capturados).toBe(1)
    expect(filas[1]?.completa).toBe(false)
  })

  it('cero aciertos cuenta como capturado', () => {
    const filas = filasDeExamen(
      [alumno(1)],
      [resultado('alumno-1', { lenguajes: 0, saberes_pensamiento_cientifico: 0 })],
      DOS_CAMPOS,
    )
    expect(filas[0]?.completa).toBe(true)
  })

  it('ignora los aciertos de un campo que el examen ya no evalúa', () => {
    const filas = filasDeExamen(
      [alumno(1)],
      [resultado('alumno-1', { lenguajes: 18, humano_comunitario: 5 })],
      DOS_CAMPOS,
    )
    expect(filas[0]?.capturados).toBe(1)
    expect(filas[0]?.completa).toBe(false)
  })

  it('conserva el orden del grupo, no el de los registros', () => {
    const filas = filasDeExamen(
      [alumno(1), alumno(2), alumno(3)],
      [resultado('alumno-3', { lenguajes: 1 }), resultado('alumno-1', { lenguajes: 2 })],
      DOS_CAMPOS,
    )
    expect(filas.map((f) => f.alumno.numero_lista)).toEqual([1, 2, 3])
  })

  it('es pura: no lee la base', async () => {
    const antes = await db.resultados_examen.count()
    filasDeExamen([alumno(1)], [], DOS_CAMPOS)
    expect(await db.resultados_examen.count()).toBe(antes)
  })
})

describe('contarConResultado', () => {
  it('cuenta los completos sobre el total del grupo', () => {
    const filas = filasDeExamen(
      [alumno(1), alumno(2), alumno(3)],
      [
        resultado('alumno-1', { lenguajes: 18, saberes_pensamiento_cientifico: 10 }),
        resultado('alumno-2', { lenguajes: 12 }),
      ],
      DOS_CAMPOS,
    )
    expect(contarConResultado(filas)).toEqual({ capturados: 1, total: 3 })
  })
})

describe('siguienteSinResultado', () => {
  const filas = (completos: number[]) =>
    filasDeExamen(
      [alumno(1), alumno(2), alumno(3)],
      completos.map((i) =>
        resultado(`alumno-${i}`, { lenguajes: 18, saberes_pensamiento_cientifico: 10 }),
      ),
      DOS_CAMPOS,
    )

  it('desde -1 devuelve el primero que falta', () => {
    expect(siguienteSinResultado(filas([1]), -1)).toBe(1)
  })

  it('da la vuelta y avanza aunque el actual sea el que falta', () => {
    expect(siguienteSinResultado(filas([1, 2]), 2)).toBe(2)
    expect(siguienteSinResultado(filas([2, 3]), 1)).toBe(0)
  })

  it('cuando ya no falta nadie devuelve null', () => {
    expect(siguienteSinResultado(filas([1, 2, 3]), 0)).toBe(null)
  })
})

describe('conDigito', () => {
  it('sobre una cifra vacía, el dígito es la cifra', () => {
    expect(conDigito(undefined, 7, 20)).toBe(7)
  })

  it('teclear encima corre la cifra a la izquierda', () => {
    expect(conDigito(1, 8, 20)).toBe(18)
  })

  it('el dígito que no cabe no entra, en vez de mostrar un error', () => {
    // Con teclado en pantalla, un dígito rechazado se siente como no haberlo
    // tocado; un error que hay que leer y descartar cuesta bastante más.
    expect(conDigito(1, 9, 15)).toBe(null)
    expect(conDigito(undefined, 9, 5)).toBe(null)
  })

  it('el tope exacto sí entra', () => {
    expect(conDigito(1, 5, 15)).toBe(15)
  })

  it('un dígito sobre cero reemplaza, no arma «05»', () => {
    expect(conDigito(0, 7, 20)).toBe(7)
  })

  it('cero sobre cero sigue siendo cero', () => {
    expect(conDigito(0, 0, 20)).toBe(0)
  })
})

describe('sinUltimoDigito', () => {
  it('recorta el último dígito', () => {
    expect(sinUltimoDigito(18)).toBe(1)
  })

  it('borrar la última cifra deja el campo sin capturar', () => {
    expect(sinUltimoDigito(7)).toBe(null)
    expect(sinUltimoDigito(0)).toBe(null)
  })

  it('sobre una cifra vacía no falla', () => {
    expect(sinUltimoDigito(undefined)).toBe(null)
  })
})

describe('camposQueQuedanFueraDeRango', () => {
  it('nombra el campo donde alguien tiene más aciertos que las preguntas nuevas', () => {
    const resultados = [resultado('alumno-1', { lenguajes: 19 })]
    expect(camposQueQuedanFueraDeRango(resultados, { lenguajes: 18 })).toEqual([
      'lenguajes',
    ])
  })

  it('bajar un total por encima de lo capturado no molesta a nadie', () => {
    const resultados = [resultado('alumno-1', { lenguajes: 15 })]
    expect(camposQueQuedanFueraDeRango(resultados, { lenguajes: 18 })).toEqual([])
  })

  it('sin nada capturado, cualquier total es válido', () => {
    expect(camposQueQuedanFueraDeRango([], { lenguajes: 1 })).toEqual([])
  })
})

describe('guardarPreguntasExamen', () => {
  it('guarda los totales del examen', async () => {
    await guardarPreguntasExamen(trimestre, examenCon(null), {
      lenguajes: 20,
      humano_comunitario: 10,
    })

    const guardadas = await db.examen_config.toArray()
    expect(guardadas).toHaveLength(1)
    expect(guardadas[0]?.preguntas).toEqual({ lenguajes: 20, humano_comunitario: 10 })
  })

  it('un examen sin preguntas no se guarda: sería dividir entre cero', async () => {
    await expect(
      guardarPreguntasExamen(trimestre, examenCon(null), { lenguajes: 0 }),
    ).rejects.toThrow(/preguntas/)
    expect(await db.examen_config.count()).toBe(0)
  })

  it('rechaza dejar aciertos ya capturados por arriba del nuevo total', async () => {
    const examen = examenCon({ lenguajes: 20 })
    await guardarPreguntasExamen(trimestre, examen, { lenguajes: 20 })
    await registrarAciertos(
      trimestre,
      examen,
      filasDeExamen([alumno(1)], [], camposDelExamen(examen))[0]!,
      camposDelExamen(examen)[0]!,
      19,
    )

    await expect(
      guardarPreguntasExamen(trimestre, examen, { lenguajes: 18 }),
    ).rejects.toThrow(/aciertos/)
  })

  it('un trimestre cerrado no admite cambiar el examen', async () => {
    await expect(
      guardarPreguntasExamen(cerrado, examenCon(null), { lenguajes: 20 }),
    ).rejects.toThrow(/cerrado/)
    expect(await db.examen_config.count()).toBe(0)
  })
})

describe('registrarAciertos', () => {
  const examen = examenCon({ lenguajes: 20, saberes_pensamiento_cientifico: 15 })
  const campos = camposDelExamen(examen)
  const filaDe = (aciertos: Partial<Record<CampoFormativo, number>>) =>
    filasDeExamen([alumno(1)], [resultado('alumno-1', aciertos)], campos)[0]!

  it('escribe al toque, sin botón de Guardar', async () => {
    await registrarAciertos(trimestre, examen, filaDe({}), campos[0]!, 18)

    const guardados = await db.resultados_examen.toArray()
    expect(guardados).toHaveLength(1)
    expect(guardados[0]?.aciertos).toEqual({ lenguajes: 18 })
  })

  it('conserva lo capturado en los otros campos', async () => {
    await registrarAciertos(trimestre, examen, filaDe({}), campos[0]!, 18)
    await registrarAciertos(trimestre, examen, filaDe({ lenguajes: 18 }), campos[1]!, 12)

    const guardados = await db.resultados_examen.toArray()
    expect(guardados).toHaveLength(1)
    expect(guardados[0]?.aciertos).toEqual({
      lenguajes: 18,
      saberes_pensamiento_cientifico: 12,
    })
  })

  it('null borra la cifra de ese campo', async () => {
    await registrarAciertos(trimestre, examen, filaDe({}), campos[0]!, 18)
    await registrarAciertos(trimestre, examen, filaDe({ lenguajes: 18 }), campos[0]!, null)

    expect((await db.resultados_examen.toArray())[0]?.aciertos).toEqual({})
  })

  it('rechaza más aciertos que preguntas del campo', async () => {
    await expect(
      registrarAciertos(trimestre, examen, filaDe({}), campos[1]!, 16),
    ).rejects.toThrow(/15 preguntas/)
    expect(await db.resultados_examen.count()).toBe(0)
  })

  it('acepta el tope exacto y el cero', async () => {
    await registrarAciertos(trimestre, examen, filaDe({}), campos[0]!, 20)
    expect((await db.resultados_examen.toArray())[0]?.aciertos).toEqual({ lenguajes: 20 })

    await registrarAciertos(trimestre, examen, filaDe({ lenguajes: 20 }), campos[0]!, 0)
    expect((await db.resultados_examen.toArray())[0]?.aciertos).toEqual({ lenguajes: 0 })
  })

  it('encola el cambio para sincronizar', async () => {
    await registrarAciertos(trimestre, examen, filaDe({}), campos[0]!, 1)

    const pendientes = await db.outbox.toArray()
    expect(pendientes).toHaveLength(1)
    expect(pendientes[0]?.tabla).toBe('resultados_examen')
  })

  it('un trimestre cerrado rechaza la captura', async () => {
    await expect(
      registrarAciertos(cerrado, examen, filaDe({}), campos[0]!, 5),
    ).rejects.toThrow(/cerrado/)
    expect(await db.resultados_examen.count()).toBe(0)
  })
})
