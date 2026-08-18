import { liveQuery } from 'dexie'

import type { AsistenciaRepo } from '@/data/ports/asistencia'
import type { RegistroAsistencia } from '@/domain/entities'
import { rangoDelMes } from '@/domain/fechas'
import type { EstadoAsistencia, Fecha, Id, Mes, Suscribible } from '@/domain/values'

import { ahora, db, nuevoId } from './db'

export class DexieAsistenciaRepo implements AsistenciaRepo {
  async porDia(fecha: Fecha): Promise<RegistroAsistencia[]> {
    const delDia = await db.asistencia.where('fecha').equals(fecha).toArray()
    // El filtro va en memoria: IndexedDB no indexa `null`, así que los vivos no
    // están en el índice de `deleted_at`. Ver la nota en alumnos.adapter.ts.
    return delDia.filter((r) => r.deleted_at === null)
  }

  observarDia(fecha: Fecha): Suscribible<RegistroAsistencia[]> {
    return liveQuery(() => this.porDia(fecha))
  }

  /**
   * El mes completo en una sola consulta por rango sobre el índice `fecha`. No se
   * itera día por día: 31 consultas para pintar una rejilla es justo lo que hace
   * que abrir el calendario se sienta lento.
   */
  async porMes(mes: Mes): Promise<RegistroAsistencia[]> {
    const { desde, hasta } = rangoDelMes(mes)
    const delMes = await db.asistencia.where('fecha').between(desde, hasta, true, true).toArray()
    return delMes.filter((r) => r.deleted_at === null)
  }

  observarMes(mes: Mes): Suscribible<RegistroAsistencia[]> {
    return liveQuery(() => this.porMes(mes))
  }

  /**
   * Upsert por `[fecha+alumno_id]`: marcar dos veces al mismo alumno el mismo
   * día actualiza su registro, nunca crea un segundo.
   *
   * La escritura y el encolado en `outbox` van en la **misma transacción**. Si
   * la transacción falla no queda un cambio pendiente huérfano apuntando a un
   * registro que no se escribió.
   */
  async marcar(alumnoId: Id, fecha: Fecha, estado: EstadoAsistencia): Promise<void> {
    await db.transaction('rw', db.asistencia, db.outbox, async () => {
      const existente = await db.asistencia
        .where('[fecha+alumno_id]')
        .equals([fecha, alumnoId])
        .first()

      const registro: RegistroAsistencia = {
        id: existente?.id ?? nuevoId(),
        alumno_id: alumnoId,
        fecha,
        estado,
        updated_at: ahora(),
        // Volver a marcar revive un registro borrado: para la maestra es el
        // mismo día del mismo alumno, no uno nuevo.
        deleted_at: null,
      }

      await db.asistencia.put(registro)
      await db.outbox.add({
        tabla: 'asistencia',
        registro_id: registro.id,
        op: 'upsert',
        at: ahora(),
      })
    })
  }

  async pasarLista(fecha: Fecha, alumnoIds: Id[]): Promise<void> {
    await db.transaction('rw', db.asistencia, db.outbox, async () => {
      const yaRegistrados = new Set(
        (await db.asistencia.where('fecha').equals(fecha).toArray())
          .filter((r) => r.deleted_at === null)
          .map((r) => r.alumno_id),
      )

      const faltantes = alumnoIds.filter((id) => !yaRegistrados.has(id))
      if (faltantes.length === 0) return

      const momento = ahora()
      const nuevos = faltantes.map((alumnoId) => ({
        id: nuevoId(),
        alumno_id: alumnoId,
        fecha,
        // El estado más probable es el estado por defecto: nadie marca alumno
        // por alumno (docs/UX.md).
        estado: 'presente' as const,
        updated_at: momento,
        deleted_at: null,
      }))

      await db.asistencia.bulkPut(nuevos)
      await db.outbox.bulkAdd(
        nuevos.map((r) => ({
          tabla: 'asistencia' as const,
          registro_id: r.id,
          op: 'upsert' as const,
          at: momento,
        })),
      )
    })
  }
}
