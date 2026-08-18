import { liveQuery } from 'dexie'

import type { AsistenciaRepo } from '@/data/ports/asistencia'
import type { RegistroAsistencia } from '@/domain/entities'
import type { EstadoAsistencia, Fecha, Id, Suscribible } from '@/domain/values'

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
}
