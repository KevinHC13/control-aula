import { describe, expect, it } from 'vitest'

import { aDatosAlumno, fusionarHojas, normalizarExtraccion, revalidar } from './importacion'

const problema = (crudo: Parameters<typeof normalizarExtraccion>[0]) =>
  normalizarExtraccion(crudo).map((f) => f.problema)

describe('normalizarExtraccion', () => {
  it('limpia los espacios que deja un OCR de tabla', () => {
    const [fila] = normalizarExtraccion([
      { nombre: '  Gómez  Pérez,   Ana Sofía ', numero_lista: 1, fecha_nacimiento: '2015-03-15', curp: '', sexo: '' },
    ])

    expect(fila?.nombre).toBe('Gómez Pérez, Ana Sofía')
    expect(fila?.problema).toBeUndefined()
  })

  it('numera por orden de aparición al que no trae número', () => {
    const filas = normalizarExtraccion([
      { nombre: 'Aguilar, Bruno' },
      { nombre: 'Bautista, Carla' },
      { nombre: 'Cruz, Diego' },
    ])

    expect(filas.map((f) => f.numero_lista)).toEqual([1, 2, 3])
    expect(filas.map((f) => f.problema)).toEqual([undefined, undefined, undefined])
  })

  it('marca el nombre vacío', () => {
    expect(problema([{ nombre: '   ', numero_lista: 1 }])).toEqual(['Falta el nombre'])
    expect(problema([{ numero_lista: 1 }])).toEqual(['Falta el nombre'])
  })

  it('marca los dos lados de un número repetido, no solo el segundo', () => {
    // Que se marquen ambos importa: la maestra no sabría cuál corregir.
    expect(
      problema([
        { nombre: 'Aguilar, Bruno', numero_lista: 7 },
        { nombre: 'Bautista, Carla', numero_lista: 7 },
        { nombre: 'Cruz, Diego', numero_lista: 8 },
      ]),
    ).toEqual(['Número de lista repetido', 'Número de lista repetido', undefined])
  })

  it('marca un número que no es un entero positivo', () => {
    expect(problema([{ nombre: 'Aguilar, Bruno', numero_lista: 0 }])).toEqual([
      'El número de lista no es válido',
    ])
    expect(problema([{ nombre: 'Aguilar, Bruno', numero_lista: -3 }])).toEqual([
      'El número de lista no es válido',
    ])
  })

  it('marca la fecha en formato del documento en vez de adivinar el día y el mes', () => {
    // "12/03/2015" es 12 de marzo o 3 de diciembre según quién la escribió.
    // Adivinar mal una fecha de nacimiento no se nota hasta que ya no importa.
    expect(problema([{ nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: '12/03/2015', curp: '', sexo: '' }])).toEqual([
      'La fecha debe ser AAAA-MM-DD',
    ])
  })

  it('marca una fecha con el formato bueno pero el día inexistente', () => {
    expect(problema([{ nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: '2015-02-31', curp: '', sexo: '' }])).toEqual([
      'La fecha debe ser AAAA-MM-DD',
    ])
  })

  it('acepta que falte la fecha: no todas las listas oficiales la traen', () => {
    expect(problema([{ nombre: 'Aguilar, Bruno', numero_lista: 1 }])).toEqual([undefined])
    expect(problema([{ nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: null, curp: null }])).toEqual([
      undefined,
    ])
  })

  it('una extracción sucia completa marca solo las filas malas', () => {
    const filas = normalizarExtraccion([
      { nombre: 'Aguilar Mendoza,  Bruno', numero_lista: 1, fecha_nacimiento: '2015-01-20', curp: '', sexo: '' },
      { nombre: '', numero_lista: 2, fecha_nacimiento: '2015-04-02', curp: '', sexo: '' },
      { nombre: 'Cruz Ríos, Diego', numero_lista: 3, fecha_nacimiento: '12/03/2015', curp: '', sexo: '' },
      { nombre: 'De la Cruz, Elena', numero_lista: 3, fecha_nacimiento: null, curp: null },
      { nombre: 'Fuentes, Gabriel', numero_lista: 5 },
    ])

    expect(filas.map((f) => f.problema !== undefined)).toEqual([false, true, true, true, false])
    expect(filas[0]?.nombre).toBe('Aguilar Mendoza, Bruno')
  })

  it('no devuelve la clave `problema` cuando la fila está bien', () => {
    // La pantalla de revisión resalta por presencia de la clave, no por su valor.
    const [fila] = normalizarExtraccion([{ nombre: 'Aguilar, Bruno', numero_lista: 1 }])
    expect(fila && 'problema' in fila).toBe(false)
  })
})

describe('capitalización de la lista oficial', () => {
  const nombre = (crudo: string) => normalizarExtraccion([{ nombre: crudo }])[0]?.nombre

  it('baja las mayúsculas de la lista oficial', () => {
    // Las listas de la SEP vienen así, y son 30 nombres gritando en una pantalla
    // que se lee todos los días.
    expect(nombre('AGUILAR MENDOZA, BRUNO ALEJANDRO')).toBe('Aguilar Mendoza, Bruno Alejandro')
  })

  it('deja las partículas del apellido en minúscula', () => {
    expect(nombre('DE LA CRUZ RIOS, ELENA SOFIA')).toBe('De la Cruz Rios, Elena Sofia')
    expect(nombre('NUÑEZ DEL ÁNGEL, JOSE MARIA')).toBe('Nuñez del Ángel, Jose Maria')
  })

  it('una partícula al principio del apellido sí lleva mayúscula', () => {
    expect(nombre('DEL TORO, LUIS')).toBe('Del Toro, Luis')
    expect(nombre('DE LA O, ANA')).toBe('De la O, Ana')
  })

  it('capitaliza también después de un guion o un apóstrofo', () => {
    expect(nombre('MARTINEZ-CANO, JEAN-PIERRE')).toBe('Martinez-Cano, Jean-Pierre')
    expect(nombre("D'ANGELO, MARIA")).toBe("D'Angelo, Maria")
  })

  it('no inventa acentos: eso es justo lo que la revisión existe para atrapar', () => {
    // "RIOS" puede ser Ríos o Rios; adivinarlo sería el mismo error que
    // convertir "12/03/2015" a una fecha concreta.
    expect(nombre('RIOS PEREZ, JOSE')).toBe('Rios Perez, Jose')
  })

  it('no toca un nombre que ya trae minúsculas', () => {
    // Puede venir bien de la IA, o estarlo tecleando ella. Recapitalizar en cada
    // tecla haría imposible escribir "de la Cruz" a mano.
    expect(nombre('de la Cruz Ríos, Elena')).toBe('de la Cruz Ríos, Elena')
    expect(nombre('McDonald, Ana')).toBe('McDonald, Ana')
  })

  it('sobrevive a un nombre sin coma', () => {
    expect(nombre('BRUNO AGUILAR')).toBe('Bruno Aguilar')
  })
})

describe('la CURP', () => {
  // Inventadas, como todo nombre de estas pruebas.
  const CURP = 'AUVG160520MNLRLRA3' // 20 de mayo de 2016

  it('rellena la fecha de nacimiento cuando la lista no la trae', () => {
    // Es el caso real: la lista de Control Escolar trae CURP y no trae fecha.
    const [fila] = normalizarExtraccion([{ nombre: 'Aguilar, Bruno', curp: CURP }])

    expect(fila?.fecha_nacimiento).toBe('2016-05-20')
    expect(fila?.problema).toBeUndefined()
  })

  it('la fecha impresa gana sobre la de la CURP', () => {
    const [fila] = normalizarExtraccion([
      { nombre: 'Aguilar, Bruno', curp: CURP, fecha_nacimiento: '2016-05-21' },
    ])

    expect(fila?.fecha_nacimiento).toBe('2016-05-21')
  })

  it('la sube a mayúsculas y le quita los espacios del OCR', () => {
    const [fila] = normalizarExtraccion([{ nombre: 'Aguilar, Bruno', curp: ' auvg 160520 mnlrlra3 ' }])

    expect(fila?.curp).toBe(CURP)
  })

  it('parte el nombre que la lista imprime sin coma', () => {
    // Es el formato de la lista oficial: apellidos y nombres seguidos. Con el
    // CURP, dónde acaban los apellidos no se adivina.
    const [fila] = normalizarExtraccion([
      { nombre: 'ARGUELLES VILLANUEVA GERONIMO ALEJANDRO', curp: 'AUVG160520HNLRLRA3' },
    ])

    expect(fila?.nombre).toBe('Arguelles Villanueva, Geronimo Alejandro')
  })

  it('no toca el nombre que ya viene con coma', () => {
    const [fila] = normalizarExtraccion([
      { nombre: 'DE LEON CEDILLO, YARETZI XIMENA', curp: 'LECY160830MNLNDRA3' },
    ])

    expect(fila?.nombre).toBe('De Leon Cedillo, Yaretzi Ximena')
  })

  it('marca la que no tiene forma de CURP, sin tirar la fila', () => {
    const [fila] = normalizarExtraccion([{ nombre: 'Aguilar, Bruno', curp: 'AUVG160520' }])

    expect(fila?.problema).toBe('El CURP no es válido')
    expect(fila?.nombre).toBe('Aguilar, Bruno')
  })

  it('marca la repetida: es la misma persona leída dos veces', () => {
    expect(
      problema([
        { nombre: 'Aguilar, Bruno', numero_lista: 1, curp: CURP },
        { nombre: 'Aguilar, Bruno', numero_lista: 2, curp: CURP },
      ]),
    ).toEqual(['CURP repetido', 'CURP repetido'])
  })

  it('sin CURP no hay repetición que valer: la mayoría de las listas no la trae', () => {
    expect(
      problema([
        { nombre: 'Aguilar, Bruno', numero_lista: 1 },
        { nombre: 'Bautista, Carla', numero_lista: 2 },
      ]),
    ).toEqual([undefined, undefined])
  })
})

describe('revalidar', () => {
  it('recalcula los problemas sin tocar el texto', () => {
    // Es lo que corre en cada tecla: no recorta espacios ni recapitaliza, porque
    // le pelearía al teclado a media palabra.
    const [fila] = revalidar([
      { nombre: 'DE LA ', numero_lista: 1, fecha_nacimiento: '2015-', curp: '', sexo: '' },
    ])

    expect(fila?.nombre).toBe('DE LA ')
    expect(fila?.fecha_nacimiento).toBe('2015-')
    expect(fila?.problema).toBe('La fecha debe ser AAAA-MM-DD')
  })

  it('quitar una fila apaga la marca de la que quedaba repetida', () => {
    const filas = normalizarExtraccion([
      { nombre: 'Aguilar, Bruno', numero_lista: 7 },
      { nombre: 'Bautista, Carla', numero_lista: 7 },
    ])
    expect(filas.map((f) => f.problema !== undefined)).toEqual([true, true])

    expect(revalidar(filas.slice(0, 1)).map((f) => f.problema)).toEqual([undefined])
  })

  it('no arrastra un problema ya resuelto', () => {
    const [fila] = revalidar([
      { nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: '', problema: 'Falta el nombre', curp: '', sexo: '' },
    ])
    expect(fila && 'problema' in fila).toBe(false)
  })
})

describe('fusionarHojas', () => {
  const CURP_1 = 'AUVG160520MNLRLRA3'
  const CURP_2 = 'PEGJ151102HNLRRVA2'

  const hoja = (crudo: Parameters<typeof normalizarExtraccion>[0]) =>
    normalizarExtraccion(crudo)

  it('la segunda página se suma a la primera', () => {
    const primera = hoja([{ nombre: 'Aguilar, Bruno', numero_lista: 1 }])
    const segunda = hoja([{ nombre: 'Zamora, Iván', numero_lista: 2 }])

    expect(fusionarHojas(primera, segunda).map((f) => f.nombre)).toEqual([
      'Aguilar, Bruno',
      'Zamora, Iván',
    ])
  })

  it('la misma hoja dos veces no duplica a nadie', () => {
    const una = hoja([
      { nombre: 'Aguilar, Bruno', numero_lista: 1, curp: CURP_1 },
      { nombre: 'Pérez, Julia', numero_lista: 2, curp: CURP_2 },
    ])

    const juntas = fusionarHojas(una, una)
    expect(juntas).toHaveLength(2)
    expect(juntas.map((f) => f.problema)).toEqual([undefined, undefined])
  })

  it('reconoce a la misma persona aunque le hayan corregido el número', () => {
    // Es lo que pasa al recortar una foto: el número se lee mal en una de las
    // dos pasadas, pero el CURP no cambia.
    const previas = hoja([{ nombre: 'Aguilar, Bruno', numero_lista: 1, curp: CURP_1 }])
    const otra = hoja([{ nombre: 'Aguilar, Bruno', numero_lista: 11, curp: CURP_1 }])

    const juntas = fusionarHojas(previas, otra)
    expect(juntas).toHaveLength(1)
    expect(juntas[0]?.numero_lista).toBe(1)
  })

  it('lo ya escrito gana; lo nuevo solo rellena huecos', () => {
    // Ella corrigió el acento a mano y después agregó la hoja donde sí venía la
    // fecha: se queda con su corrección y gana la fecha.
    const previas = hoja([{ nombre: 'Ríos, Ana', numero_lista: 3, curp: CURP_1 }]).map((f) => ({
      ...f,
      fecha_nacimiento: '',
    }))
    const otra = hoja([
      { nombre: 'Rios, Ana', numero_lista: 3, curp: CURP_1, fecha_nacimiento: '2016-05-20' },
    ])

    const [fila] = fusionarHojas(previas, otra)
    expect(fila?.nombre).toBe('Ríos, Ana')
    expect(fila?.fecha_nacimiento).toBe('2016-05-20')
  })

  it('ordena por número de lista: dos fotos no llegan en orden', () => {
    const previas = hoja([{ nombre: 'Zamora, Iván', numero_lista: 20 }])
    const otra = hoja([{ nombre: 'Aguilar, Bruno', numero_lista: 3 }])

    expect(fusionarHojas(previas, otra).map((f) => f.numero_lista)).toEqual([3, 20])
  })

  it('marca el número repetido que la fusión no supo unir', () => {
    // Sin CURP no hay forma de saber si son la misma persona: se marcan las dos
    // y lo decide ella.
    const previas = hoja([{ nombre: 'Aguilar, Bruno', numero_lista: 1, curp: CURP_1 }])
    const otra = hoja([{ nombre: 'Zamora, Iván', numero_lista: 1, curp: CURP_2 }])

    expect(fusionarHojas(previas, otra).map((f) => f.problema)).toEqual([
      'Número de lista repetido',
      'Número de lista repetido',
    ])
  })
})

describe('aDatosAlumno', () => {
  it('la fecha vacía se guarda como dato ausente, no como cadena vacía', () => {
    expect(
      aDatosAlumno([
        { nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: '', curp: '', sexo: '' },
        { nombre: 'Bautista, Carla', numero_lista: 2, fecha_nacimiento: '2015-04-02', curp: '', sexo: '' },
      ]),
    ).toEqual([
      { nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: null, curp: null, sexo: null },
      {
        nombre: 'Bautista, Carla',
        numero_lista: 2,
        fecha_nacimiento: '2015-04-02',
        curp: null,
        sexo: null,
      },
    ])
  })

  it('no arrastra `problema` al dominio', () => {
    const [dato] = aDatosAlumno([
      { nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: '', problema: 'algo', curp: '', sexo: '' },
    ])
    expect(dato && 'problema' in dato).toBe(false)
  })
})

describe('el sexo, y sus tres fuentes', () => {
  // AUVG… es de mujer y PEGJ… de hombre: el carácter 11.
  const DE_MUJER = 'AUVG160520MNLRLRA3'

  it('lo impreso gana sobre el CURP', () => {
    // Si el documento trae las dos cosas y no coinciden, la que se ve es la que
    // se respeta; corregirla es lo que la revisión existe para permitir.
    const [fila] = normalizarExtraccion([
      { nombre: 'Aguilar, Bruno', numero_lista: 1, curp: DE_MUJER, sexo: 'H' },
    ])

    expect(fila?.sexo).toBe('H')
  })

  it('sin columna, lo saca del CURP', () => {
    const [fila] = normalizarExtraccion([
      { nombre: 'Aguilar, Ana', numero_lista: 1, curp: DE_MUJER },
    ])

    expect(fila?.sexo).toBe('M')
  })

  it('el CURP gana sobre lo que la IA dedujo del nombre', () => {
    // «Guadalupe», «Cruz» o «Yael» son justo donde el modelo falla, y el CURP
    // no adivina: lo lleva escrito. La conjetura nunca pisa un dato cierto.
    const [fila] = normalizarExtraccion([
      { nombre: 'Aguilar, Guadalupe', numero_lista: 1, curp: DE_MUJER, sexo_supuesto: 'H' },
    ])

    expect(fila?.sexo).toBe('M')
  })

  it('la conjetura solo entra cuando no hay nada más', () => {
    const [fila] = normalizarExtraccion([
      { nombre: 'Aguilar, Bruno', numero_lista: 1, sexo_supuesto: 'H' },
    ])

    expect(fila?.sexo).toBe('H')
  })

  it('sin ninguna de las tres queda vacío, que es sin asignar', () => {
    const [fila] = normalizarExtraccion([{ nombre: 'Aguilar, Bruno', numero_lista: 1 }])

    expect(fila?.sexo).toBe('')
  })

  it('una letra que no se reconoce no se inventa', () => {
    const [fila] = normalizarExtraccion([
      { nombre: 'Aguilar, Bruno', numero_lista: 1, sexo: 'X' },
    ])

    expect(fila?.sexo).toBe('')
  })

  it('revalidar no se lo come al teclear', () => {
    // `revalidar` corre en cada tecla de la pantalla de revisión y reconstruye
    // la fila campo por campo: un campo que no se liste ahí desaparece sin
    // error y sin aviso, y nadie lo notaría hasta guardar.
    const [fila] = revalidar([
      { nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: '', curp: '', sexo: 'H' },
    ])

    expect(fila?.sexo).toBe('H')
  })

  it('al fusionar hojas, lo ya escrito gana y lo nuevo rellena', () => {
    const juntas = fusionarHojas(
      [
        { nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: '', curp: '', sexo: 'H' },
        { nombre: 'Barrera, Ana', numero_lista: 2, fecha_nacimiento: '', curp: '', sexo: '' },
      ],
      [
        { nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: '', curp: '', sexo: 'M' },
        { nombre: 'Barrera, Ana', numero_lista: 2, fecha_nacimiento: '', curp: '', sexo: 'M' },
      ],
    )

    expect(juntas.map((f) => f.sexo)).toEqual(['H', 'M'])
  })

  it('vacío se guarda como dato ausente, no como cadena vacía', () => {
    const [conSexo, sinSexo] = aDatosAlumno([
      { nombre: 'Aguilar, Bruno', numero_lista: 1, fecha_nacimiento: '', curp: '', sexo: 'H' },
      { nombre: 'Barrera, Ana', numero_lista: 2, fecha_nacimiento: '', curp: '', sexo: '' },
    ])

    expect(conSexo?.sexo).toBe('H')
    expect(sinSexo?.sexo).toBeNull()
  })
})
