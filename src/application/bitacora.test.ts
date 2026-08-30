import { describe, expect, it } from 'vitest'

import type { Alumno, Reporte } from '@/domain/entities'

import { filasDeBitacora, textoDeReporteValido } from './bitacora'

const alumno = (n: number): Alumno => ({
  id: `alumno-${n}`,
  nombre: `Apellido${n}, Nombre`,
  ciclo_id: null,
  numero_lista: n,
  fecha_nacimiento: null,
  curp: null,
  updated_at: '2026-08-24T00:00:00.000Z',
  deleted_at: null,
})

const reporte = (alumnoId: string, fecha: string, texto: string): Reporte => ({
  id: `${alumnoId}-${fecha}-${texto}`,
  alumno_id: alumnoId,
  fecha,
  texto,
  updated_at: `${fecha}T14:00:00.000Z`,
  deleted_at: null,
})

describe('filasDeBitacora', () => {
  it('saca a todos los alumnos, tengan reportes o no', () => {
    // La pantalla es la lista del grupo, no la de los reportados: buscar a un
    // alumno para anotarle el primero es el caso normal.
    const filas = filasDeBitacora([alumno(1), alumno(2), alumno(3)], [
      reporte('alumno-2', '2026-09-01', 'Algo'),
    ])

    expect(filas).toHaveLength(3)
    expect(filas.map((f) => f.reportes.length)).toEqual([0, 1, 0])
  })

  it('conserva el orden en que llegaron los reportes', () => {
    // El repositorio los entrega más reciente primero y agrupar no lo revuelve.
    const filas = filasDeBitacora(
      [alumno(1)],
      [
        reporte('alumno-1', '2026-10-15', 'Nuevo'),
        reporte('alumno-1', '2026-09-01', 'Viejo'),
      ],
    )

    expect(filas[0]?.reportes.map((r) => r.texto)).toEqual(['Nuevo', 'Viejo'])
  })

  it('ignora un reporte de un alumno que no está en la lista', () => {
    // Puede pasar con un alumno dado de baja: su reporte no debe inventar una
    // fila que la pantalla no sabría pintar.
    const filas = filasDeBitacora([alumno(1)], [reporte('alumno-9', '2026-09-01', 'Algo')])

    expect(filas).toHaveLength(1)
    expect(filas[0]?.reportes).toHaveLength(0)
  })

  it('el conteo es la longitud de la lista, no un campo aparte', () => {
    const filas = filasDeBitacora(
      [alumno(1)],
      [
        reporte('alumno-1', '2026-09-02', 'Dos'),
        reporte('alumno-1', '2026-09-01', 'Uno'),
      ],
    )

    expect(filas[0]?.reportes).toHaveLength(2)
  })
})

describe('textoDeReporteValido', () => {
  it('un texto con contenido vale', () => {
    expect(textoDeReporteValido('Se levantó de su lugar')).toBe(true)
  })

  it('vacío o solo espacios no vale', () => {
    // Una fila sin texto contaría para conducta sin decir por qué.
    expect(textoDeReporteValido('')).toBe(false)
    expect(textoDeReporteValido('   \n ')).toBe(false)
  })
})
