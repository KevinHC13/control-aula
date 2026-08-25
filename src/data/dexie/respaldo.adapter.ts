import type { ConteoPorTabla, RespaldoRepo, VolcadoDeTablas } from '@/data/ports/respaldo'

import { db, TABLAS_SINCRONIZABLES, VERSION_ESQUEMA } from './db'

export class DexieRespaldoRepo implements RespaldoRepo {
  versionDelEsquema(): number {
    return VERSION_ESQUEMA
  }

  /**
   * Recorre `TABLAS_SINCRONIZABLES` y no una lista propia: agregar una tabla al
   * esquema la mete al respaldo sin tocar este archivo. Es la razón de que la
   * lista exista como arreglo (docs/DATA-MODEL.md).
   *
   * Sin filtrar `deleted_at`: el respaldo es la base tal como está, borrados
   * incluidos. Filtrarlos haría que restaurar resucite a un alumno dado de baja
   * y a las notas que ella quitó.
   */
  async volcar(): Promise<VolcadoDeTablas> {
    const tablas: VolcadoDeTablas = {}
    // En una transacción de lectura: sin ella, una captura a media exportación
    // podría dejar una entrega en el archivo y su actividad fuera.
    await db.transaction('r', db.tables, async () => {
      for (const nombre of TABLAS_SINCRONIZABLES) {
        tablas[nombre] = await db.table(nombre).toArray()
      }
    })
    return tablas
  }

  async restaurar(tablas: VolcadoDeTablas): Promise<ConteoPorTabla> {
    const nombres = Object.keys(tablas)
    const desconocida = nombres.find(
      (nombre) => !(TABLAS_SINCRONIZABLES as readonly string[]).includes(nombre),
    )
    if (desconocida !== undefined) {
      throw new Error(`El archivo trae una tabla que esta app no conoce: ${desconocida}`)
    }

    const conteo: ConteoPorTabla = {}

    // Todo o nada. Un archivo a medio restaurar es peor que no restaurar: deja
    // calificaciones colgando de actividades que no llegaron.
    await db.transaction('rw', db.tables, async () => {
      for (const nombre of nombres) {
        const filas = tablas[nombre] ?? []
        // `bulkPut` y no `bulkAdd`: es un upsert por `id`, así que restaurar dos
        // veces el mismo archivo actualiza las mismas filas en vez de fallar o
        // duplicar. Los ids son UUID del cliente y viajan en el archivo, que es
        // justo lo que permite esto (docs/DATA-MODEL.md).
        if (filas.length > 0) await db.table(nombre).bulkPut(filas)
        conteo[nombre] = filas.length
      }
    })

    // No se encola nada en la `outbox`, a propósito y contra la regla general de
    // que toda escritura encola: restaurar no es una mutación del salón, es
    // recuperar lo que ya se había capturado. Qué hace la sincronía con un
    // dispositivo restaurado es una decisión de C16 —el motor tiene «restaurar
    // todo» propio— y adelantarla aquí sería inventar semántica de un servidor
    // que todavía no existe.
    return conteo
  }

}
