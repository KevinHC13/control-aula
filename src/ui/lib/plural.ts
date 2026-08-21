/**
 * El sustantivo que le toca a una cantidad: `plural(1, 'día', 'días')` → `'día'`.
 *
 * Existe porque «1 días · 1 faltas» apareció en el resumen del grupo el día que se
 * abrió en el navegador, y el mismo descuido estaba en cinco pantallas más. Es el
 * tipo de error que ninguna prueba de unidad iba a encontrar —los números eran
 * correctos— y que en cambio se ve en el primer vistazo.
 *
 * Solo el sustantivo, sin la cifra: la cifra va aparte porque casi siempre lleva la
 * clase `cifra` para que salga en la tipografía monoespaciada.
 *
 * El plural va explícito y no se deriva agregando una `s`: en español eso falla con
 * «reportes» tanto como con «lápices», y adivinarlo cuesta más que escribirlo.
 */
export function plural(cuantos: number, singular: string, plural: string): string {
  return cuantos === 1 ? singular : plural
}
