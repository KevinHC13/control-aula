# Estado del proyecto

Actualizado el **2026-08-21**, con C18 a C24, C27 y C28 terminados, más los fixes
C19b y C21c. Este es el documento que se lee primero para saber
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
las rúbricas, las actividades, las dos capturas de entregable y el examen por
aciertos—, con una corrección de modelo encima: la rúbrica cuelga de la actividad, no
del criterio (D-016). **Toda la captura de la Fase 4 está construida, y también el
cálculo** (C28) **y el cierre del trimestre con su snapshot** (C27): lo único que
falta de la fase es la pantalla donde ella lee los números, que es `C29`.

## Fases

| Fase | Alcance | Estado |
|---|---|---|
| 1 · Cimientos | Scaffold, shadcn, dominio, Dexie, puertos | ✅ Terminada |
| 2 · Asistencia | El vertical completo hasta el iPad | ✅ Terminada |
| Hito | Entrega, pausa de una semana, validación | ✅ Cumplido |
| 3 · Resto de la v1 | Notas, resumen, respaldo, cumpleaños, sincronía | ⬜ Sin empezar |
| 4 · Evaluación | Ciclo, trimestres, criterios, rúbricas, cálculo | ▶ En curso: C18–C24, C27 y C28 hechos, sigue C29 |

## Lo que existe y funciona

Verificado en `src/` a esta fecha:

| Capa | Contenido |
|---|---|
| `domain/` | `entities.ts` con la jerarquía de evaluación completa, `values.ts`, `fechas.ts`, `rules.ts`, `evaluacion.ts` (estructura) y `calculo.ts` (los números), con pruebas |
| `data/dexie/` | `db.ts` en `version(2)`, adaptadores de alumnos y asistencia, `outbox`, semilla |
| `data/ports/` | `alumnos.ts`, `asistencia.ts`, `evaluacion.ts` (ciclo, trimestres, criterios, pesos, rúbricas y actividades) |
| `application/` | `asistencia.ts`, `grupo.ts`, `importacion.ts`, `evaluacion.ts`, `entregas.ts`, `calificacion.ts`, `examen.ts`, `calificaciones.ts` (reporte y cierre) |
| `services/` | `extraccion.ts` — única salida a red del cliente |
| `ui/` | Cuatro pestañas, Asistencia completa (con la etiqueta del trimestre), Calificaciones con sus actividades y las tres capturas —entregas, rúbrica y examen, esta última con teclado propio—, Ajustes, CargarLista, CicloEscolar, CriteriosYPesos, Rubricas |
| `tests/` | `arquitectura.test.ts` — verifica las reglas de dependencia en cada `npm test` |
| Infra | PWA con `vite-plugin-pwa` y aviso de actualización; Edge Function `extraer-lista` desplegada |

Pantalla de asistencia: tira de días de tres meses que se desliza, calendario del
mes como mosaico, contador de presentes, filas con ciclo de estados y barra
bicolor.

## Lo que es placeholder

`ui/screens/Notas.tsx` y el resumen de `ui/screens/Grupo.tsx`. Existen, navegan y
no hacen nada. `Calificaciones` ya no: lista las actividades del trimestre, las
administra y las captura —con rúbrica, sin ella y por aciertos de examen—. Lo que
falta ahí es **mostrar** los números: el cálculo ya existe (C28), la pantalla que lo
lee es C29.

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

**Siguiente commit: `C29 · feat(evaluacion): consultar calificaciones por alumno y
campo formativo`,** el último de la fase: la pantalla donde ella saca los números
para la boleta. **Ya no falta nada por debajo**: `reporteDeTrimestre` en
`application/calificaciones.ts` devuelve, para los 30 alumnos, el desglose por
criterio y por campo, el general del trimestre y `pesoConsiderado` —y decide sola si
los números salen del snapshot o del cálculo—. C29 es pantalla y hooks.

Lo que ya está decidido y hay que respetar:

- La cifra sale de `comoCalificacion`: base 10 con un decimal, y `—` cuando no hay
  dato. **El porcentaje no aparece nunca.**
- **El desglose no es un lujo:** cuando un resultado no cuadre con su intuición —y
  va a pasar— es lo único que dice si el error está en la fórmula o en la
  expectativa. Se muestra criterio por criterio, no solo el final.
- **Hay que decir sobre cuánto se está calculando.** `pesoConsiderado < 100`
  significa que hay criterios sin capturar, y una cifra normalizada sin ese aviso se
  lee como una de boleta (D-019).
- Se consulta **por alumno y por grupo**: son dos vistas de lo mismo, y la del grupo
  es la que ella usa para transcribir.
- En un trimestre cerrado los números vienen del snapshot. Eso ya lo resuelve
  `reporteDeTrimestre`; la pantalla solo tiene que **decirlo**, o parecerá que
  recalcula.

El orden del resto de la Fase 4 es:

```
C18 ─ C19 ─ C20 ─ C21 ─ C21b ─┬─ C22 ─┐
 ✅    ✅    ✅    ✅    ✅     ├─ C23 ─┼─ C28 ─┬─ C29
                              └─ C24 ─┘       └─ C27
```

Hechos: de C18 a C24 —toda la rama de captura—, C28 (el cálculo) y C27 (el cierre).
Falta **solo C29**, la consulta, que es el que cierra la fase.

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

`C13` (resumen del grupo) ya se puede hacer completo: la parte de asistencia siempre
fue posible y la de promedio tiene desde C28 con qué calcularse.

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
| ¿Cuál es el umbral real de riesgo por asistencia? | Solo el color de alerta de C13 |
| ¿Una captura a medias debería dar calificación? | Se resolvió en C28 excluyéndola (D-019). Si ella espera lo contrario, es una línea de `valorDeEvaluacion` |
| Si se retoma participación: ¿premiar volumen? | C25, que está pospuesto |

Ya **no** están abiertos: la escala, la forma de evaluación y la utilidad de los
campos formativos —resueltos en la validación—, ni cuántos exámenes hay por
trimestre y con cuánta precisión se presenta una calificación, que se preguntaron
antes de C24 y quedaron en D-018: **uno** y **un decimal**.

## Deuda conocida

- De las once tablas nuevas, tienen puerto y adaptador `ciclos`, `trimestres`,
  `criterios`, `criterios_trimestre`, `rubricas`, `rubrica_criterios`,
  `actividades`, `entregas` y `eval_rubrica`. `examen_config`, `resultados_examen`
  y `cierres` no se tocan todavía.
- **La regla de D-019 —una captura a medias no produce calificación— la decidí yo,
  no la usuaria.** Es coherente con lo que la pantalla ya llamaba «sin calificar» y
  con excluir una actividad sin registros, y nada de la boleta depende de ella
  todavía porque C29 no existe. Conviene confirmarla antes de que sí dependa.
- El examen **no tiene forma de decir cuántas preguntas trae por fuera de su propia
  pantalla**, y esa pantalla vive dentro de Calificaciones. Es una configuración
  —una vez por trimestre— viviendo en el camino de captura; funciona, pero no es
  donde vive el resto de lo que se configura.
- **Nada compara los aciertos con las preguntas después de bajar un total.** Se
  rechaza el cambio, que es lo correcto, pero la pantalla no dice *quién* está
  fuera de rango: hay que buscarlo en la lista.
- La captura con rúbrica **no está medida con cronómetro**, ni en el navegador ni
  en el iPad. No tiene el presupuesto de 15 segundos de la asistencia —son tantos
  toques como renglones por alumno— pero cuánto cuesta de verdad un grupo de 30
  solo se sabe con el iPad en la mano.
- Un alumno a medias se ve como pendiente y nada avisa cuántos quedaron así al
  salir: el contador dice «12 de 30», no «hay tres a medias».
- El criterio de los 15 segundos de C22 está medido en el navegador (73 ms para
  cuatro toques, incluyendo el viaje a IndexedDB), **no en el iPad con cronómetro**.
  Falta confirmarlo en el dispositivo, como se hizo con C8.
- `CriterioTrimestre.meta_participacion` se escribe siempre en `null`: la copia de
  esquema lo arrastra, pero nada lo pone. Pertenece a participación, que está
  pospuesta.
- No hay forma de reordenar los renglones de una rúbrica desde la pantalla. El
  `orden` se guarda y se respeta, y el adaptador ya sabe reordenar si le llegan en
  otro orden; falta el gesto en la interfaz.
- No hay forma de **reordenar** las actividades de un criterio ni de moverlas a
  otro. Se ordenan por fecha, que es como ella las busca.
- Un ciclo puede quedarse con uno o dos trimestres indefinidamente si ella no abre
  los que faltan. Es un estado válido —y la asistencia lo dice en la etiqueta— pero
  nada le recuerda que los abra.
- Las filas de `criterios_trimestre` creadas antes del fix conservan un
  `rubrica_id` que ya nadie lee. Solo existe en bases de desarrollo —`version(2)`
  no se ha desplegado— y es una propiedad de sobra, no un dato que mienta.
- No hay forma de reordenar los criterios de un trimestre. El campo `orden`
  existe y se respeta al leer, pero solo lo fija el orden de alta.
- **Reabrir un trimestre no queda registrado más que por la huella de
  `cerrado_en`**: no hay bitácora, así que no se sabe cuándo se reabrió ni cuántas
  veces. El snapshot anterior se borra en suave, así que tampoco queda a la vista
  qué decía antes.
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
