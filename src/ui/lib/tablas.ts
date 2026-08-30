/**
 * De cómo se llama una tabla por dentro, a cómo se llama lo que guarda.
 *
 * El respaldo y la copia en la nube terminan diciendo cuánto se guardó o se
 * restauró, y hasta ahora lo decían con el nombre técnico de cada tabla:
 * «eval_rubrica: 120», «criterios_trimestre: 4». Es exactamente el momento en que
 * hace falta creerle a la aplicación, y dieciséis renglones de jerga no ayudan a
 * eso —además de contar cosas que no son cosas para quien lee: nadie tiene un
 * `rubrica_criterios`—.
 *
 * Aquí se traducen y **se agrupan**: las tres formas de calificar son
 * «calificaciones», y las ocho tablas de configuración son «la configuración de la
 * evaluación». Se pierde el detalle por tabla, que no le servía a nadie, y se gana
 * un resumen de cinco o seis renglones que sí se lee.
 */
const GRUPOS: { etiqueta: string; tablas: readonly string[] }[] = [
  { etiqueta: 'Alumnos', tablas: ['alumnos'] },
  { etiqueta: 'Días de asistencia', tablas: ['asistencia'] },
  { etiqueta: 'Reportes de la bitácora', tablas: ['bitacora'] },
  { etiqueta: 'Participaciones', tablas: ['participaciones'] },
  { etiqueta: 'Actividades', tablas: ['actividades'] },
  {
    etiqueta: 'Calificaciones',
    tablas: ['entregas', 'eval_rubrica', 'resultados_examen', 'cierres'],
  },
  {
    etiqueta: 'Configuración de la evaluación',
    tablas: [
      'ciclos',
      'trimestres',
      'criterios',
      'criterios_trimestre',
      'rubricas',
      'rubrica_criterios',
      'examen_config',
    ],
  },
]

export interface RenglonDeResumen {
  etiqueta: string
  cuantas: number
}

/**
 * El conteo por tabla, vuelto un resumen legible. Solo lo que tiene filas: un cero
 * no es información, y siete renglones en cero esconden los dos que importan.
 *
 * Una tabla que no esté en ningún grupo —porque el esquema creció y esto no— se
 * suma aparte en vez de desaparecer: es preferible un renglón genérico a un total
 * que no cuadra con la suma de lo que se enseña.
 */
export function resumirPorTabla(conteo: Record<string, number>): RenglonDeResumen[] {
  const conocidas = new Set(GRUPOS.flatMap((g) => g.tablas))

  const resumen = GRUPOS.map((grupo) => ({
    etiqueta: grupo.etiqueta,
    cuantas: grupo.tablas.reduce((suma, tabla) => suma + (conteo[tabla] ?? 0), 0),
  })).filter((renglon) => renglon.cuantas > 0)

  const sueltas = Object.entries(conteo)
    .filter(([tabla, cuantas]) => cuantas > 0 && !conocidas.has(tabla))
    .reduce((suma, [, cuantas]) => suma + cuantas, 0)

  return sueltas > 0
    ? [...resumen, { etiqueta: 'Otra información', cuantas: sueltas }]
    : resumen
}
