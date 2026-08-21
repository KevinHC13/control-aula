import { liveQuery } from 'dexie'

import type { ParticipacionesRepo } from '@/data/ports/participaciones'
import type { Participacion } from '@/domain/entities'
import type { Fecha, Id, Suscribible } from '@/domain/values'

import { ahora, db, nuevoId } from './db'

export class DexieParticipacionesRepo implements ParticipacionesRepo {
  async porDia(fecha: Fecha): Promise<Participacion[]> {
    const delDia = await db.participaciones.where('fecha').equals(fecha).toArray()
    // El filtro va en memoria: IndexedDB no indexa `null`, así que los vivos no
    // están en el índice de `deleted_at`. Ver la nota en alumnos.adapter.ts.
    return delDia.filter((p) => p.deleted_at === null)
  }

  observarDia(fecha: Fecha): Suscribible<Participacion[]> {
    return liveQuery(() => this.porDia(fecha))
  }

  /** Una sola consulta por rango sobre el índice `fecha`, como el mes de asistencia. */
  async porRango(desde: Fecha, hasta: Fecha): Promise<Participacion[]> {
    const delRango = await db.participaciones
      .where('fecha')
      .between(desde, hasta, true, true)
      .toArray()
    return delRango.filter((p) => p.deleted_at === null)
  }

  observarRango(desde: Fecha, hasta: Fecha): Suscribible<Participacion[]> {
    return liveQuery(() => this.porRango(desde, hasta))
  }

  async sumarUna(alumnoId: Id, fecha: Fecha): Promise<void> {
    await this.mover(alumnoId, fecha, 1)
  }

  async restarUna(alumnoId: Id, fecha: Fecha): Promise<void> {
    await this.mover(alumnoId, fecha, -1)
  }

  /**
   * Upsert sobre `[fecha+alumno_id]`, en la misma transacción que la `outbox`.
   *
   * Sumar y restar son la misma escritura con el signo cambiado, así que van en
   * un solo lugar: son el gesto y su deshacer, y separarlos invitaría a que uno
   * de los dos olvide el tope en cero o el encolado.
   */
  private async mover(alumnoId: Id, fecha: Fecha, delta: 1 | -1): Promise<void> {
    await db.transaction('rw', db.participaciones, db.outbox, async () => {
      const existente = await db.participaciones
        .where('[fecha+alumno_id]')
        .equals([fecha, alumnoId])
        .first()

      // Nunca por debajo de cero: un contador negativo restaría, al sumar el
      // trimestre, participaciones que sí ocurrieron otros días.
      const cantidad = Math.max(0, (existente?.cantidad ?? 0) + delta)

      // Restar donde no hay nada no escribe: así sostener el dedo sobre un alumno
      // sin marcas no deja una fila en cero ni un cambio pendiente que subir.
      if (!existente && cantidad === 0) return

      const registro: Participacion = {
        id: existente?.id ?? nuevoId(),
        alumno_id: alumnoId,
        fecha,
        cantidad,
        updated_at: ahora(),
        // Volver a marcar revive la fila: para la maestra es el mismo día del
        // mismo alumno, no uno nuevo.
        deleted_at: null,
      }

      await db.participaciones.put(registro)
      await db.outbox.add({
        tabla: 'participaciones',
        registro_id: registro.id,
        op: 'upsert',
        at: ahora(),
      })
    })
  }
}
