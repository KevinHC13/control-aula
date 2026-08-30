import { liveQuery } from 'dexie'

import type { AlumnosRepo } from '@/data/ports/alumnos'
import type { Alumno, DatosAlumno } from '@/domain/entities'
import type { Id, Suscribible } from '@/domain/values'

import { ahora, db, nuevoId } from './db'

/**
 * Nota sobre el filtro de borrados: no se puede resolver con el índice de
 * `deleted_at`. IndexedDB no admite `null` como clave, así que los registros
 * vivos —los que tienen `deleted_at: null`— simplemente no están en ese índice.
 * El índice sirve para encontrar los borrados; los vivos se filtran en memoria,
 * que con 30 alumnos no cuesta nada.
 */
function vivos(alumnos: Alumno[]): Alumno[] {
  return alumnos.filter((a) => a.deleted_at === null)
}

/**
 * El ciclo al que pertenece el grupo de hoy: el abierto, o `null` si todavía no
 * se configura ninguno.
 *
 * Vive aquí y no en el puerto a propósito. Todas las pantallas leen el grupo por
 * `lista()`/`observarLista()`, así que acotar por ciclo en un solo lugar las
 * acota todas, y ninguna puede saltárselo por olvido. El precio es que este
 * adaptador lee `db.ciclos`, que no es «su» tabla; es más barato que repartir la
 * decisión por seis pantallas.
 */
async function cicloAbierto(): Promise<string | null> {
  const abiertos = (await db.ciclos.where('estado').equals('abierto').toArray()).filter(
    (c) => c.deleted_at === null,
  )
  // El mismo desempate que `cicloEnCurso()`: solo puede haber uno abierto, y si
  // hubiera dos, el más reciente es el que ella acaba de configurar.
  return abiertos.sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0]?.id ?? null
}

export class DexieAlumnosRepo implements AlumnosRepo {
  /**
   * El grupo del ciclo abierto. Sin ciclo configurado devuelve los alumnos que
   * todavía no tienen ninguno, que es lo que permite pasar lista el primer día
   * sin haber abierto nada: en cuanto se abre el ciclo, los adopta.
   */
  async lista(): Promise<Alumno[]> {
    const ciclo = await cicloAbierto()
    const todos = await db.alumnos.orderBy('numero_lista').toArray()
    return vivos(todos).filter((a) => (a.ciclo_id ?? null) === ciclo)
  }

  /**
   * Con los dados de baja. Se ordena igual, por número de lista: una baja no
   * cambia de sitio en la lista, solo deja de contar.
   */
  async conBajas(): Promise<Alumno[]> {
    const ciclo = await cicloAbierto()
    const todos = await db.alumnos.orderBy('numero_lista').toArray()
    return todos.filter((a) => (a.ciclo_id ?? null) === ciclo)
  }

  observarConBajas(): Suscribible<Alumno[]> {
    return liveQuery(() => this.conBajas())
  }

  observarLista(): Suscribible<Alumno[]> {
    // Depende de `ciclos` además de `alumnos`, y `liveQuery` lo detecta solo:
    // rastrea las tablas que la consulta tocó. Cerrar un ciclo o abrir otro
    // vuelve a emitir sin que nadie lo pida.
    return liveQuery(() => this.lista())
  }

  /** El grupo de un ciclo cualquiera, para consultar uno cerrado. */
  async deCiclo(cicloId: string): Promise<Alumno[]> {
    return vivos(await this.deCicloConBajas(cicloId))
  }

  async deCicloConBajas(cicloId: string): Promise<Alumno[]> {
    const todos = await db.alumnos.orderBy('numero_lista').toArray()
    return todos.filter((a) => a.ciclo_id === cicloId)
  }

  /**
   * La identidad para fusionar es `[ciclo, numero_lista]`, no `numero_lista` a
   * secas: con dos generaciones en la base, el alumno 1 del ciclo nuevo no es el
   * alumno 1 del anterior, y confundirlos le colgaría la asistencia y las
   * calificaciones del otro.
   */
  async sembrar(datos: DatosAlumno[]): Promise<void> {
    await db.transaction('rw', db.alumnos, db.ciclos, db.outbox, async () => {
      const ciclo = await cicloAbierto()
      const existentes = new Map(
        (await db.alumnos.toArray())
          .filter((a) => (a.ciclo_id ?? null) === ciclo)
          .map((a) => [a.numero_lista, a]),
      )
      const momento = ahora()

      // Solo lo que cambió: si la lista ya se cargó y el archivo es el mismo, no
      // se escribe nada y el `outbox` no se llena de pendientes en cada arranque.
      const porEscribir: Alumno[] = []
      for (const alumno of datos) {
        const existente = existentes.get(alumno.numero_lista)

        if (existente === undefined) {
          porEscribir.push({
            id: nuevoId(),
            ciclo_id: ciclo,
            ...alumno,
            updated_at: momento,
            deleted_at: null,
          })
          continue
        }

        // El CURP entra en la comparación o reimportar la misma lista con CURP
        // no escribiría nada: el resto de los campos ya coincide.
        const igual =
          existente.nombre === alumno.nombre &&
          existente.fecha_nacimiento === alumno.fecha_nacimiento &&
          existente.curp === alumno.curp &&
          existente.deleted_at === null
        if (igual) continue

        // Conserva el `id`: con él se conservan su asistencia y sus
        // calificaciones, que apuntan a ese identificador.
        porEscribir.push({
          ...existente,
          ...alumno,
          updated_at: momento,
          deleted_at: null,
        })
      }

      if (porEscribir.length === 0) return

      await db.alumnos.bulkPut(porEscribir)
      await db.outbox.bulkAdd(
        porEscribir.map((a) => ({
          tabla: 'alumnos' as const,
          registro_id: a.id,
          op: 'upsert' as const,
          at: momento,
        })),
      )
    })
  }

  /**
   * El número de lista ya tomado en el ciclo, **contando a los dados de baja**.
   *
   * Contarlos no es un descuido: `sembrar()` fusiona por número de lista sobre
   * todos los del ciclo, borrados incluidos —así es como revive a quien vuelve—,
   * de modo que dos alumnos con el mismo número harían que una recarga de la
   * lista escribiera sobre cualquiera de los dos, al azar.
   */
  private async numeroTomado(
    ciclo: string | null,
    numero: number,
    exceptoId?: Id,
  ): Promise<boolean> {
    const todos = await db.alumnos.toArray()
    return todos.some(
      (a) =>
        (a.ciclo_id ?? null) === ciclo && a.numero_lista === numero && a.id !== exceptoId,
    )
  }

  async agregar(datos: DatosAlumno): Promise<void> {
    await db.transaction('rw', db.alumnos, db.ciclos, db.outbox, async () => {
      const ciclo = await cicloAbierto()
      if (await this.numeroTomado(ciclo, datos.numero_lista)) {
        throw new Error(`El número de lista ${datos.numero_lista} ya está ocupado`)
      }

      const momento = ahora()
      const alumno: Alumno = {
        id: nuevoId(),
        ciclo_id: ciclo,
        ...datos,
        updated_at: momento,
        deleted_at: null,
      }

      await db.alumnos.add(alumno)
      await db.outbox.add({
        tabla: 'alumnos',
        registro_id: alumno.id,
        op: 'upsert',
        at: momento,
      })
    })
  }

  async editar(id: Id, datos: DatosAlumno): Promise<void> {
    await db.transaction('rw', db.alumnos, db.outbox, async () => {
      const alumno = await db.alumnos.get(id)
      if (!alumno) throw new Error(`No existe el alumno ${id}`)

      if (await this.numeroTomado(alumno.ciclo_id ?? null, datos.numero_lista, id)) {
        throw new Error(`El número de lista ${datos.numero_lista} ya está ocupado`)
      }

      const momento = ahora()
      // El `id` y el `ciclo_id` se conservan: de uno cuelga toda su historia y
      // del otro, a qué generación pertenece. Editar corrige datos, no muda a
      // nadie de ciclo.
      await db.alumnos.put({ ...alumno, ...datos, updated_at: momento })
      await db.outbox.add({ tabla: 'alumnos', registro_id: id, op: 'upsert', at: momento })
    })
  }

  async darDeBaja(id: Id): Promise<void> {
    await this.marcarBaja(id, true)
  }

  async reactivar(id: Id): Promise<void> {
    await this.marcarBaja(id, false)
  }

  /**
   * La baja y su vuelta son la misma escritura con el signo cambiado, así que
   * viven juntas: separarlas era duplicar la transacción y el encolado.
   *
   * Se encola como `upsert` y no como `delete`: el borrado es **suave**, así que
   * lo que viaja es la fila con su `deleted_at` puesto. Un `delete` en el
   * servidor perdería la baja al restaurar.
   */
  private async marcarBaja(id: Id, baja: boolean): Promise<void> {
    await db.transaction('rw', db.alumnos, db.outbox, async () => {
      const alumno = await db.alumnos.get(id)
      if (!alumno) throw new Error(`No existe el alumno ${id}`)

      const momento = ahora()
      await db.alumnos.put({
        ...alumno,
        deleted_at: baja ? momento : null,
        updated_at: momento,
      })
      await db.outbox.add({ tabla: 'alumnos', registro_id: id, op: 'upsert', at: momento })
    })
  }
}
