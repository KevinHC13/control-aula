import { liveQuery } from 'dexie'

import type { AlumnosRepo, NuevoAlumno } from '@/data/ports/alumnos'
import type { Alumno, DatosAlumno } from '@/domain/entities'
import { porNombre } from '@/domain/orden'
import type { Id, Suscribible } from '@/domain/values'

import { ahora, db, nuevoId } from './db'

/**
 * Tres notas sobre la lectura de este adaptador.
 *
 * Nota sobre el orden: se ordena **en memoria por apellido** (`porNombre`) y no
 * con un `orderBy` de Dexie. No hay índice por `nombre` —y uno de IndexedDB
 * ordenaría por punto de código, que manda «Ávila» después de la Z—, así que el
 * orden del español solo lo sabe dar `localeCompare`. Con treinta o cuarenta
 * alumnos no se nota, igual que el filtro de aquí abajo.
 *
 * Va en los métodos de lectura y en ninguna pantalla: ordenar una vez las ordena
 * todas, y ninguna puede saltárselo por olvido —el mismo criterio que el acote
 * por ciclo de `cicloAbierto()`—.
 *
 * Nota sobre el filtro de borrados: no se puede resolver con el índice de
 * `deleted_at`. IndexedDB no admite `null` como clave, así que los registros
 * vivos —los que tienen `deleted_at: null`— simplemente no están en ese índice.
 * El índice sirve para encontrar los borrados; los vivos se filtran en memoria,
 * que con 30 alumnos no cuesta nada.
 *
 * Nota sobre `numero_lista` (docs/DECISIONES.md D-033): lo que devuelve un
 * método de lectura **no es el valor guardado**, es la posición 1-based en este
 * mismo orden alfabético, calculada aquí y sustituida en el objeto que se
 * entrega. Deja de coincidir con lo que hay en `db.alumnos` en cuanto alguien se
 * da de alta a mitad del ciclo, y es a propósito: es lo que hace que el número
 * que ve la maestra se mueva solo al lugar que le toca por apellido, en vez de
 * quedarse pegado al final. El valor real —el que asigna `agregar()`, el que
 * trae el archivo importado— nunca sale de este archivo: fuera de él nadie lo
 * lee ni lo necesita, porque ya no identifica a nadie.
 */
function vivos(alumnos: Alumno[]): Alumno[] {
  return alumnos.filter((a) => a.deleted_at === null)
}

/**
 * Los campos que entraron sin migración —`curp` y `sexo`, que no llevan índice y
 * por eso no llevan `version()` (ver la nota de `db.ts`)— los lee `undefined`
 * una fila escrita antes de que existieran.
 *
 * Aquí se vuelven `null`, que es lo que el dominio declara y lo que el resto de
 * la app sabe distinguir de un valor. Sin esto, «sin asignar» y «no existe el
 * campo» serían dos cosas distintas en cada sitio que las mire, y la de arriba
 * no debería salir nunca del adaptador.
 */
function normalizado(alumno: Alumno): Alumno {
  return { ...alumno, curp: alumno.curp ?? null, sexo: alumno.sexo ?? null }
}

/**
 * La vista que sale del adaptador: alfabético, y con `numero_lista` sustituido
 * por la posición en este arreglo (D-033). El valor guardado de verdad se queda
 * en la fila de Dexie, nunca en lo que esto devuelve.
 */
function conPosicion(alumnos: Alumno[]): Alumno[] {
  return alumnos.sort(porNombre).map((alumno, i) => ({ ...alumno, numero_lista: i + 1 }))
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

/**
 * El número interno más alto ya usado en el ciclo, contando a los dados de
 * baja. Es la mitad de `siguienteNumero()` de antes de D-033: sigue haciendo
 * falta para no reciclar un número al dar de alta a mano, pero ya no se expone
 * fuera del adaptador —la maestra no lo elige ni lo ve—.
 */
async function numeroMasAlto(ciclo: string | null): Promise<number> {
  const todos = await db.alumnos.toArray()
  return todos.reduce(
    (max, a) => ((a.ciclo_id ?? null) === ciclo ? Math.max(max, a.numero_lista) : max),
    0,
  )
}

export class DexieAlumnosRepo implements AlumnosRepo {
  /**
   * El grupo del ciclo abierto. Sin ciclo configurado devuelve los alumnos que
   * todavía no tienen ninguno, que es lo que permite pasar lista el primer día
   * sin haber abierto nada: en cuanto se abre el ciclo, los adopta.
   */
  async lista(): Promise<Alumno[]> {
    const ciclo = await cicloAbierto()
    const todos = (await db.alumnos.toArray()).map(normalizado)
    return conPosicion(vivos(todos).filter((a) => (a.ciclo_id ?? null) === ciclo))
  }

  /**
   * Con los dados de baja. Se ordena igual, por apellido: una baja no cambia de
   * sitio en la lista, solo deja de contar.
   */
  async conBajas(): Promise<Alumno[]> {
    const ciclo = await cicloAbierto()
    const todos = (await db.alumnos.toArray()).map(normalizado)
    return conPosicion(todos.filter((a) => (a.ciclo_id ?? null) === ciclo))
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
    const todos = (await db.alumnos.toArray()).map(normalizado)
    return conPosicion(todos.filter((a) => a.ciclo_id === cicloId))
  }

  /**
   * La identidad para fusionar deja de ser el número de lista (docs/DECISIONES.md
   * D-033): con el número convertido en una posición que se recalcula sola, dos
   * cargas de la misma lista ya no traen el mismo número para la misma persona
   * en cuanto haya habido una alta de por medio.
   *
   * La identidad nueva, en este orden, sobre los alumnos del ciclo —borrados
   * incluidos, para poder revivir a quien vuelve—:
   *
   * 1. **CURP igual**, cuando la fila nueva y un alumno existente lo tienen los
   *    dos. Es el dato que no cambia entre cargas.
   * 2. **Nombre exacto igual**, cuando no hay CURP de un lado o del otro. La
   *    mayoría de las listas no trae CURP, y el nombre ya llega limpio y
   *    capitalizado por `normalizarExtraccion`.
   * 3. Sin ninguna de las dos, es un alumno nuevo.
   *
   * Cada alumno existente se consume a lo más una vez: si dos filas del archivo
   * calzaran con el mismo existente, la segunda entra como alumno nuevo en vez
   * de pisar al primero.
   */
  async sembrar(datos: DatosAlumno[]): Promise<void> {
    await db.transaction('rw', db.alumnos, db.ciclos, db.outbox, async () => {
      const ciclo = await cicloAbierto()
      const existentes = (await db.alumnos.toArray()).filter(
        (a) => (a.ciclo_id ?? null) === ciclo,
      )
      const consumidos = new Set<Id>()

      function buscar(alumno: DatosAlumno): Alumno | undefined {
        if (alumno.curp !== null) {
          const porCurp = existentes.find(
            (e) => !consumidos.has(e.id) && e.curp !== null && e.curp === alumno.curp,
          )
          if (porCurp !== undefined) return porCurp
        }
        return existentes.find(
          (e) => !consumidos.has(e.id) && e.nombre === alumno.nombre,
        )
      }

      const momento = ahora()

      // Solo lo que cambió: si la lista ya se cargó y el archivo es el mismo, no
      // se escribe nada y el `outbox` no se llena de pendientes en cada arranque.
      const porEscribir: Alumno[] = []
      for (const alumno of datos) {
        const existente = buscar(alumno)

        if (existente === undefined) {
          porEscribir.push({
            id: nuevoId(),
            ciclo_id: ciclo,
            ...alumno,
            curp: alumno.curp ?? null,
            sexo: alumno.sexo ?? null,
            updated_at: momento,
            deleted_at: null,
          })
          continue
        }

        consumidos.add(existente.id)

        // Cada campo nuevo entra en la comparación o reimportar la misma lista
        // con ese campo no escribiría nada: el resto ya coincide. Pasó con el
        // CURP y volvería a pasar con el sexo, y las dos veces en silencio.
        const igual =
          existente.nombre === alumno.nombre &&
          existente.fecha_nacimiento === alumno.fecha_nacimiento &&
          existente.curp === alumno.curp &&
          (existente.sexo ?? null) === (alumno.sexo ?? null) &&
          existente.deleted_at === null
        if (igual) continue

        // Conserva el `id`: con él se conservan su asistencia y sus
        // calificaciones, que apuntan a ese identificador. El `numero_lista`
        // interno también se conserva —no es el que trae `alumno`— porque ya no
        // significa nada fuera de este archivo y cambiarlo no compra nada.
        porEscribir.push({
          ...existente,
          ...alumno,
          numero_lista: existente.numero_lista,
          curp: alumno.curp ?? null,
          sexo: alumno.sexo ?? null,
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
   * Da de alta a un alumno que llegó con el ciclo empezado. El número interno
   * se asigna solo —el siguiente al más alto del ciclo, contando bajas— y no
   * lo elige ni lo ve la maestra (D-033): en cuanto se guarda, el alumno
   * aparece donde le toca por apellido, no al final.
   */
  async agregar(datos: NuevoAlumno): Promise<void> {
    await db.transaction('rw', db.alumnos, db.ciclos, db.outbox, async () => {
      const ciclo = await cicloAbierto()
      const numero_lista = (await numeroMasAlto(ciclo)) + 1

      const momento = ahora()
      const alumno: Alumno = {
        id: nuevoId(),
        ciclo_id: ciclo,
        numero_lista,
        ...datos,
        curp: datos.curp ?? null,
        sexo: datos.sexo ?? null,
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

  /**
   * Corrige a un alumno. Conserva su `id` —y con él su asistencia y sus
   * calificaciones— y su `numero_lista` interno: la maestra ya no lo edita
   * (D-033), así que no hay «número de otro» que rechazar aquí.
   */
  async editar(id: Id, datos: NuevoAlumno): Promise<void> {
    await db.transaction('rw', db.alumnos, db.outbox, async () => {
      const alumno = await db.alumnos.get(id)
      if (!alumno) throw new Error(`No existe el alumno ${id}`)

      const momento = ahora()
      // El `id`, el `ciclo_id` y el `numero_lista` se conservan: de uno cuelga
      // toda su historia, del otro a qué generación pertenece, y el tercero ya
      // no es de la maestra para cambiarlo.
      await db.alumnos.put({
        ...alumno,
        ...datos,
        curp: datos.curp ?? null,
        sexo: datos.sexo ?? null,
        updated_at: momento,
      })
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
        ...normalizado(alumno),
        deleted_at: baja ? momento : null,
        updated_at: momento,
      })
      await db.outbox.add({ tabla: 'alumnos', registro_id: id, op: 'upsert', at: momento })
    })
  }
}
