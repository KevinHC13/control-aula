import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Las reglas de dependencia de docs/ARCHITECTURE.md, ejecutables. Hasta ahora
 * eran un `grep` que había que acordarse de correr antes de cada commit.
 */

const RAIZ = 'src'

function archivos(dir: string): string[] {
  const entradas = readdirSync(join(RAIZ, dir), { withFileTypes: true })
  return entradas.flatMap((e) =>
    e.isDirectory()
      ? archivos(join(dir, e.name))
      : /\.tsx?$/.test(e.name) && !e.name.endsWith('.test.ts')
        ? [join(dir, e.name)]
        : [],
  )
}

const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8')

const imports = (contenido: string): string[] =>
  [...contenido.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '')

describe('reglas de dependencia', () => {
  it('domain/ no importa nada: ni React, ni Dexie, ni librerías', () => {
    for (const ruta of archivos('domain')) {
      for (const especificador of imports(leer(ruta))) {
        // Solo rutas relativas dentro de domain/.
        expect(especificador, `${ruta} importa ${especificador}`).toMatch(/^\.\//)
      }
    }
  })

  it('ui/ y application/ nunca importan data/dexie', () => {
    for (const dir of ['ui', 'application']) {
      for (const ruta of archivos(dir)) {
        for (const especificador of imports(leer(ruta))) {
          expect(especificador, `${ruta} importa ${especificador}`).not.toMatch(/data\/dexie/)
        }
      }
    }
  })

  it('data/ports/ no importa nada de dexie: el puerto es el contrato, no la implementación', () => {
    for (const ruta of archivos(join('data', 'ports'))) {
      for (const especificador of imports(leer(ruta))) {
        expect(especificador, `${ruta} importa ${especificador}`).not.toMatch(/dexie/)
      }
    }
  })

  it('liveQuery y dexie-react-hooks aparecen solo en data/dexie', () => {
    for (const ruta of archivos('.')) {
      if (ruta.startsWith(join('data', 'dexie'))) continue
      const contenido = leer(ruta)
      expect(contenido, ruta).not.toMatch(/liveQuery/)
      expect(contenido, ruta).not.toMatch(/dexie-react-hooks/)
    }
  })

  it('solo data/index.ts conoce el adaptador concreto', () => {
    const culpables = archivos('.')
      .filter((ruta) => !ruta.startsWith(join('data', 'dexie')))
      .filter((ruta) => ruta !== join('data', 'index.ts'))
      .filter((ruta) => imports(leer(ruta)).some((e) => /data\/dexie|\.\/dexie/.test(e)))
    expect(culpables).toEqual([])
  })
})

describe('forma de los puertos', () => {
  const puertos = archivos(join('data', 'ports'))

  it('hay puertos que revisar', () => {
    expect(puertos.length).toBeGreaterThan(0)
  })

  it('ningún método se llama por consulta en vez de por caso de uso', () => {
    const PROHIBIDOS = ['find', 'query', 'where', 'getAll', 'select']
    for (const ruta of puertos) {
      for (const linea of leer(ruta).split('\n')) {
        const decl = linea.trim()
        // Los comentarios sí pueden nombrarlos: el de asistencia.ts explica
        // justamente por qué `find(where)` no va en un contrato.
        if (decl.startsWith('*') || decl.startsWith('//') || decl.startsWith('/*')) continue
        for (const prohibido of PROHIBIDOS) {
          const declara =
            decl.startsWith(`${prohibido}(`) || decl.startsWith(`${prohibido}<`)
          // La semántica de consulta de Dexie no se filtra al contrato.
          expect(declara, `${ruta} declara ${prohibido}(): ${decl}`).toBe(false)
        }
      }
    }
  })

  it('no existe BaseRepository ni genéricos especulativos', () => {
    for (const ruta of puertos) {
      expect(leer(ruta), ruta).not.toMatch(/BaseRepository/)
    }
  })
})
