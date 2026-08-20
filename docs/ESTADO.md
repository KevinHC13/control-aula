# Estado del proyecto

Actualizado el **2026-08-20**, con C18 a C21 terminados, más el fix C21c. Este es el documento que se lee primero para saber
dónde va el proyecto y qué sigue. El plan detallado, con criterios de aceptación
por commit, está en [COMMITS.md](./COMMITS.md).

Regla: **antes de afirmar que algo existe, verificarlo en `src/`.** Este archivo
se queda viejo; el código no.

---

## En una línea

Asistencia está terminada y entregada en el iPad. La semana de uso real ya pasó y
la validación con la usuaria tiró el modelo de calificaciones que estaba planeado.
La Fase 4 va en marcha: **C18 a C21 están hechos** —dominio de evaluación,
`db.version(2)`, el ciclo escolar con sus trimestres, los criterios con sus pesos y
las rúbricas—, y con una corrección de modelo encima: la rúbrica cuelga de la
actividad, no del criterio (D-016). Lo que sigue es `C21b`: las actividades, que es
lo primero que se va a tocar todos los días.

## Fases

| Fase | Alcance | Estado |
|---|---|---|
| 1 · Cimientos | Scaffold, shadcn, dominio, Dexie, puertos | ✅ Terminada |
| 2 · Asistencia | El vertical completo hasta el iPad | ✅ Terminada |
| Hito | Entrega, pausa de una semana, validación | ✅ Cumplido |
| 3 · Resto de la v1 | Notas, resumen, respaldo, cumpleaños, sincronía | ⬜ Sin empezar |
| 4 · Evaluación | Ciclo, trimestres, criterios, rúbricas, cálculo | ▶ En curso: C18–C21 y C21c hechos, sigue C21b |

## Lo que existe y funciona

Verificado en `src/` a esta fecha:

| Capa | Contenido |
|---|---|
| `domain/` | `entities.ts` con la jerarquía de evaluación completa, `values.ts`, `fechas.ts`, `rules.ts`, `evaluacion.ts`, con pruebas |
| `data/dexie/` | `db.ts` en `version(2)`, adaptadores de alumnos y asistencia, `outbox`, semilla |
| `data/ports/` | `alumnos.ts`, `asistencia.ts`, `evaluacion.ts` (ciclo, trimestres, criterios, pesos y rúbricas) |
| `application/` | `asistencia.ts`, `grupo.ts`, `importacion.ts`, `evaluacion.ts` |
| `services/` | `extraccion.ts` — única salida a red del cliente |
| `ui/` | Cuatro pestañas, Asistencia completa (con la etiqueta del trimestre), Ajustes, CargarLista, CicloEscolar, CriteriosYPesos, Rubricas |
| `tests/` | `arquitectura.test.ts` — verifica las reglas de dependencia en cada `npm test` |
| Infra | PWA con `vite-plugin-pwa` y aviso de actualización; Edge Function `extraer-lista` desplegada |

Pantalla de asistencia: tira de días de tres meses que se desliza, calendario del
mes como mosaico, contador de presentes, filas con ciclo de estados y barra
bicolor.

## Lo que es placeholder

`ui/screens/Calificaciones.tsx`, `ui/screens/Notas.tsx` y el resumen de
`ui/screens/Grupo.tsx`. Existen, navegan y no hacen nada.

## Lo que cambió con la validación

La semana de uso real hizo exactamente lo que se esperaba: tiró el plan de
calificaciones. Lo que cayó y lo que entró:

| Se planeó | Es en realidad |
|---|---|
| Escala entera 5–10, seis botones | Rúbricas de cuatro niveles; base 1 al calcular, base 10 al presentar, **sin piso** |
| `Calificacion` con un `valor` numérico | `Entrega`, `EvaluacionRubrica` y `ResultadoExamen`, según el tipo de criterio |
| `Actividad` suelta con fecha y campo | `Actividad` colgada de un `CriterioTrimestre` |
| Sin ponderaciones configurables | Pesos por criterio y por trimestre, que deben sumar 100 para cerrar |
| Sin multi-ciclo | `Ciclo` → `Trimestre`, con cierre que congela y deja snapshot |
| Campos formativos `[POR VALIDAR]` | Validados: son la agrupación con la que ella reporta |

Detalle del modelo en [DATA-MODEL.md](./DATA-MODEL.md), justificación en
[DECISIONES.md](./DECISIONES.md) D-015.

Consecuencia sobre el esquema: las tablas `actividades` y `calificaciones` de
`version(1)` **se descartaron**. `version(2)` las reemplazó y agregó once tablas
más. Era la única migración de la Fase 4 y ya está hecha, en C18.

Sobre el riesgo de esa migración: resultó no existir. La verificación que este
documento pedía hacer en el iPad —contar filas de `actividades` y
`calificaciones`— no hizo falta, porque **ninguna ruta de código escribió nunca en
esas tablas**: no hubo adaptador, puerto ni caso de uso que las tocara. Estaban
vacías por construcción. La migración se ensayó igual en
`src/data/dexie/migracion.test.ts`, sobre una base con el esquema viejo y
asistencia capturada.

## Con qué continuar

**Siguiente commit: `C21b · feat(evaluacion): crear actividades por campo
formativo`.** Es el primero de la fase que entra al camino cotidiano: sin
actividades, C22 (entregas), C23 (rúbrica) y C28 (cálculo) no tienen sobre qué
operar.

Toda actividad se crea **dentro de un `CriterioTrimestre`**, nunca suelta, y el
campo formativo se elige antes de nombrarla: es la agrupación con la que ella
reporta, así que elegirlo después invita a dejarlo en el que venía por omisión. Los
ejes articuladores son opcionales.

C21b también trae **con qué se califica cada actividad**, que es donde vive la
rúbrica desde el fix C21c: una rúbrica activa, o `null` para entregada / no
entregada. Llega precargada con la de la actividad anterior del mismo criterio —un
valor derivado, no configuración— y cambiarla en una actividad ya calificada tiene
que avisar de lo que se pierde, porque `EvaluacionRubrica.niveles` está indexado por
los renglones de la rúbrica anterior.

Y hay una decisión de UI que tomar ahí y no después: **dónde viven las
actividades.** No son Ajustes —se tocan varias veces por semana— así que van en la
pestaña Calificaciones, que hoy sigue siendo un placeholder.

El orden del resto de la Fase 4 es:

```
C18 ─ C19 ─ C20 ─ C21 ─ C21b ─┬─ C22 ─┐
 ✅    ✅    ✅    ✅          ├─ C23 ─┼─ C28 ─┬─ C29
                              └─ C24 ─┘       └─ C27
```

C29 es el que cierra la fase: la pantalla donde ella saca los números para la
boleta.

### Lo que se puede tomar en paralelo

Dos commits de la Fase 3 no dependen de nada de evaluación:

- **`C14` · respaldo en JSON.** Con datos reales del salón ya dentro del iPad y
  sin motor de sincronía, es el mayor riesgo abierto del proyecto: hoy no hay
  ninguna forma de recuperar el año si el iPad se pierde. Ya se puede tomar sin
  volver a tocarlo: `version(2)` está en su lugar y `TABLAS_SINCRONIZABLES`
  enumera exactamente lo que hay que exportar.
- **`C12` · anecdotario.** Independiente por completo mientras conducta siga
  pospuesta.

`C13` (resumen del grupo) se puede hacer a medias: la parte de asistencia ya es
posible, la de promedio necesita C28.

## Pospuesto por decisión, no por falta de tiempo

Los criterios automáticos —**puntualidad, conducta y participación**— quedan
fuera del alcance actual por decisión de la usuaria. `TipoCriterio` conserva sus
valores para no migrar el esquema después, pero no hay pantallas ni cálculo, y
`Nota` sigue **sin campo `signo`**.

Corresponde a `C25` y `C26`. El diseño de referencia está en
[DATA-MODEL.md](./DATA-MODEL.md#criterios-automáticos--pospuestos) para cuando se
retome; no es trabajo pendiente.

## Supuestos que siguen abiertos

Lo que todavía está marcado `[POR VALIDAR]` y qué bloquea cada uno:

| Pregunta | Bloquea |
|---|---|
| ¿El redondeo al presentar es entero o de un decimal? | Nada estructural: se aplica solo al presentar. Definirlo en C28 |
| ¿Hay un examen por trimestre o varios? | La referencia de `ResultadoExamen`. Si son varios, el examen pasa a ser una actividad. Bloquea C24 |
| ¿Cuál es el umbral real de riesgo por asistencia? | Solo el color de alerta de C13 |
| Si se retoma participación: ¿premiar volumen? | C25, que está pospuesto |

Ya **no** están abiertos: la escala, la forma de evaluación y la utilidad de los
campos formativos. Los tres se resolvieron en la validación.

## Deuda conocida

- De las once tablas nuevas, tienen puerto y adaptador `ciclos`, `trimestres`,
  `criterios`, `criterios_trimestre`, `rubricas` y `rubrica_criterios`. Las otras
  cinco existen en el esquema y nadie las puede leer todavía; cada commit de la
  fase abre las que su pantalla necesita.
- `CriterioTrimestre.meta_participacion` se escribe siempre en `null`: la copia de
  esquema lo arrastra, pero nada lo pone. Pertenece a participación, que está
  pospuesta.
- No hay forma de reordenar los renglones de una rúbrica desde la pantalla. El
  `orden` se guarda y se respeta, y el adaptador ya sabe reordenar si le llegan en
  otro orden; falta el gesto en la interfaz.
- **No hay forma de asignarle una rúbrica a nada** hasta C21b: el selector de
  *Criterios y pesos* se retiró con el fix C21c y el de la actividad todavía no
  existe. Mientras tanto, «una rúbrica en uso no se puede borrar» solo se verifica
  en Vitest, porque no hay camino en la interfaz para dejar una en uso.
- Las filas de `criterios_trimestre` creadas antes del fix conservan un
  `rubrica_id` que ya nadie lee. Solo existe en bases de desarrollo —`version(2)`
  no se ha desplegado— y es una propiedad de sobra, no un dato que mienta.
- No hay forma de reordenar los criterios de un trimestre. El campo `orden`
  existe y se respeta al leer, pero solo lo fija el orden de alta.
- Cerrar un trimestre no tiene interfaz (es C27). La regla de que un trimestre
  cerrado rechaza cambios de fecha ya está escrita y probada, pero hoy solo se
  puede llegar a ese estado tocando IndexedDB a mano.
- El respaldo no existe y la sincronía tampoco: el único ejemplar de los datos
  reales vive en un iPad.
- Los criterios de aceptación de C10 y C10c que dependen del dispositivo se
  marcaron al momento de la entrega. No se han vuelto a correr desde entonces.

## Bitácora de la documentación

`docs/actualizacion/` traía el modelo de evaluación validado con la usuaria. Su
contenido ya está absorbido en [DATA-MODEL.md](./DATA-MODEL.md) y
[COMMITS.md](./COMMITS.md), con dos ajustes respecto a lo que traía:

- Su `C17` (cargar lista desde imagen) ya estaba construido como `C10c`,
  que esa copia no conocía. No se reintrodujo.
- Su decisión de evaluación se citaba como `D-012`, número que en este repositorio
  ya lo ocupa la decisión sobre Vitest. Quedó como **D-015**.

La carpeta se puede borrar.
