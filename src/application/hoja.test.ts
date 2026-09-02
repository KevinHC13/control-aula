import { describe, expect, it } from 'vitest'

import { interpretarHoja } from './hoja'

/**
 * La forma exacta de la lista de asistencia de la escuela: siete filas de
 * membrete, los encabezados en la octava, dos filas de días partidas en dos, los
 * datos desde la onceava y el nombre en tres columnas. Los nombres son
 * inventados; la estructura no.
 */
const LISTA_DE_ASISTENCIA: string[][] = [
  ['ESC. PRIM. "LA ESCUELA" T.M'],
  ['CALLE SIN NOMBRE, EL PUEBLO'],
  ['C.C.T    ZONA ESCOLAR 21'],
  ['TELÉFONO: 8100000000'],
  ['CICLO ESCOLAR 2026-2027'],
  ['LISTA DE ASISTENCIA  5° "B"'],
  ['      MES:_____________'],
  ['No', 'NOMBRE DEL ALUMNO(A)', '', '', 'EDAD', 'SEXO ', 'L', 'M', 'M', 'J', 'V'],
  [],
  [],
  ['1', 'ARGUELLES', 'VILLANUEVA', 'GERONIMO ALEJANDRO', '10', 'H'],
  ['2', 'BAUTISTA', 'HERNANDEZ', 'JHANNA NOEMI', '10', 'M'],
  ['3', 'DE LEON', 'CEDILLO', 'YARETZI XIMENA', '9', 'M'],
  [],
  ['', 'H:', '15', 'M:', '22', 'T:', '37'],
]

describe('interpretarHoja', () => {
  it('lee la lista de asistencia de la escuela', () => {
    const alumnos = interpretarHoja(LISTA_DE_ASISTENCIA)

    expect(alumnos).toHaveLength(3)
    expect(alumnos?.map((a) => a.numero_lista)).toEqual([1, 2, 3])
  })

  it('arma el nombre con las tres columnas: los apellidos ya vienen partidos', () => {
    // Es la ventaja sobre la foto: dónde acaban los apellidos no se adivina.
    const alumnos = interpretarHoja(LISTA_DE_ASISTENCIA)

    expect(alumnos?.[0]?.nombre).toBe('ARGUELLES VILLANUEVA, GERONIMO ALEJANDRO')
    expect(alumnos?.[2]?.nombre).toBe('DE LEON CEDILLO, YARETZI XIMENA')
  })

  it('descarta el membrete, los renglones vacíos y el pie de totales', () => {
    // Ninguno de los tres trae número y nombre a la vez, que es la única regla.
    expect(interpretarHoja(LISTA_DE_ASISTENCIA)?.map((a) => a.nombre)).not.toContain('H:')
  })

  it('lee la CURP aunque la columna vaya antes del nombre', () => {
    // Así viene la lista oficial de Control Escolar: No | MATRÍCULA | CURP | NOMBRE.
    const alumnos = interpretarHoja([
      ['No.', 'MATRÍCULA', 'C U R P', 'NOMBRE DEL ALUMNO'],
      ['1', '11934091', 'AUVG160520MNLRLRA3', 'ARGUELLES VILLANUEVA GERONIMO'],
    ])

    expect(alumnos?.[0]?.curp).toBe('AUVG160520MNLRLRA3')
    expect(alumnos?.[0]?.nombre).toBe('ARGUELLES VILLANUEVA GERONIMO')
  })

  it('convierte la fecha de nacimiento que Excel guarda como número', () => {
    const alumnos = interpretarHoja([
      ['No', 'NOMBRE', 'FECHA DE NACIMIENTO'],
      ['1', 'Aguilar, Bruno', '42510'],
    ])

    expect(alumnos?.[0]?.fecha_nacimiento).toBe('2016-05-20')
  })

  it('una fecha ya escrita se respeta, y lo que no es fecha se descarta', () => {
    const alumnos = interpretarHoja([
      ['No', 'NOMBRE', 'NACIMIENTO'],
      ['1', 'Aguilar, Bruno', '2016-05-20'],
      ['2', 'Bautista, Carla', 'sin dato'],
    ])

    expect(alumnos?.[0]?.fecha_nacimiento).toBe('2016-05-20')
    expect(alumnos?.[1]?.fecha_nacimiento).toBeNull()
  })

  it('devuelve null cuando no reconoce los encabezados: ahí entra la IA', () => {
    expect(interpretarHoja([['algo'], ['otra cosa'], ['1', 'Aguilar, Bruno']])).toBeNull()
  })

  it('devuelve null cuando reconoce los encabezados pero no hay ni un alumno', () => {
    expect(interpretarHoja([['No', 'NOMBRE DEL ALUMNO'], [], ['', '']])).toBeNull()
  })

  it('aguanta una hoja vacía', () => {
    expect(interpretarHoja([])).toBeNull()
  })
})

describe('la columna de sexo', () => {
  it('la lee de la lista de la escuela', () => {
    const alumnos = interpretarHoja(LISTA_DE_ASISTENCIA)

    expect(alumnos?.map((a) => a.sexo)).toEqual(['H', 'M', 'M'])
  })

  it('no confunde los días de la semana con la columna de sexo', () => {
    // El encabezado de la escuela sigue con `L M M J V`, y esa `M` está a una
    // columna de la buena. Con un `includes` en vez de una coincidencia exacta,
    // el lunes decidiría el sexo de todo el grupo.
    const alumnos = interpretarHoja(LISTA_DE_ASISTENCIA)

    expect(alumnos?.[0]?.sexo).toBe('H')
  })

  it('en una lista M/F la M es masculino', () => {
    // La misma letra significa lo contrario según la lista, y decidirlo celda
    // por celda dejaría medio grupo invertido en silencio. La `F` de cualquier
    // renglón es lo que resuelve la columna entera.
    const alumnos = interpretarHoja([
      ['No', 'NOMBRE', 'GÉNERO'],
      ['1', 'Aguilar, Bruno', 'M'],
      ['2', 'Barrera, Ana', 'F'],
    ])

    expect(alumnos?.map((a) => a.sexo)).toEqual(['H', 'M'])
  })

  it('sin una sola F, la M es mujer: es la lista mexicana', () => {
    const alumnos = interpretarHoja([
      ['No', 'NOMBRE', 'SEXO'],
      ['1', 'Aguilar, Bruno', 'H'],
      ['2', 'Barrera, Ana', 'M'],
    ])

    expect(alumnos?.map((a) => a.sexo)).toEqual(['H', 'M'])
  })

  it('entiende la palabra completa y el encabezado con espacios o acento', () => {
    const alumnos = interpretarHoja([
      ['No', 'NOMBRE', 'S E X O'],
      ['1', 'Aguilar, Bruno', 'Hombre'],
      ['2', 'Barrera, Ana', 'mujer'],
      ['3', 'Cruz, Niño', 'Masculino'],
      ['4', 'Diaz, Nina', 'Femenino'],
    ])

    expect(alumnos?.map((a) => a.sexo)).toEqual(['H', 'M', 'H', 'M'])
  })

  it('la encuentra aunque vaya antes del nombre', () => {
    const alumnos = interpretarHoja([
      ['No', 'SEXO', 'NOMBRE DEL ALUMNO'],
      ['1', 'H', 'Aguilar, Bruno'],
    ])

    expect(alumnos?.[0]?.sexo).toBe('H')
    expect(alumnos?.[0]?.nombre).toBe('Aguilar, Bruno')
  })

  it('sin columna de sexo nadie queda con sexo, y eso no es un error', () => {
    const alumnos = interpretarHoja([
      ['No', 'NOMBRE', 'C U R P'],
      ['1', 'Aguilar, Bruno', 'AUVG160520MNLRLRA3'],
    ])

    expect(alumnos?.[0]?.sexo).toBeNull()
    expect(alumnos?.[0]?.curp).toBe('AUVG160520MNLRLRA3')
  })

  it('una celda vacía o ilegible es sin asignar, no medio grupo mal', () => {
    const alumnos = interpretarHoja([
      ['No', 'NOMBRE', 'SEXO'],
      ['1', 'Aguilar, Bruno', 'H'],
      ['2', 'Barrera, Ana', ''],
      ['3', 'Cruz, Regina', '-'],
    ])

    expect(alumnos?.map((a) => a.sexo)).toEqual(['H', null, null])
  })
})
