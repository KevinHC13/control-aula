import type { DatosAlumno } from '@/domain/entities'

/**
 * Grupo de ejemplo, versionado en el repositorio. **Todos los nombres son
 * inventados.**
 *
 * La lista real va en `grupo.ts`, en esta misma carpeta, ignorada por git: son
 * nombres de menores de edad y no entran al repositorio (docs/DATA-MODEL.md).
 * Para cargarla, copiar este archivo a `grupo.ts` y reemplazar los datos.
 *
 * `numero_lista` es la identidad del alumno para la semilla: es 1-based y sigue
 * el orden de la lista oficial, que en primaria es alfabético por apellido.
 * `fecha_nacimiento` puede ser null; sirve para el aviso de cumpleaños.
 */
export const GRUPO: DatosAlumno[] = [
  { numero_lista: 1, nombre: 'Aguilar Mendoza, Bruno', fecha_nacimiento: '2017-03-14' },
  { numero_lista: 2, nombre: 'Alcántara Ruiz, Camila', fecha_nacimiento: '2017-07-02' },
  { numero_lista: 3, nombre: 'Barrera Solís, Diego', fecha_nacimiento: '2016-11-28' },
  { numero_lista: 4, nombre: 'Bautista Lara, Ana Sofía', fecha_nacimiento: '2017-01-19' },
  { numero_lista: 5, nombre: 'Cabrera Ochoa, Emiliano', fecha_nacimiento: null },
  { numero_lista: 6, nombre: 'Carrillo Vega, Fernanda', fecha_nacimiento: '2017-05-06' },
  { numero_lista: 7, nombre: 'Cruz Herrera, Regina', fecha_nacimiento: '2017-09-23' },
  { numero_lista: 8, nombre: 'Delgado Pineda, Santiago', fecha_nacimiento: '2016-12-11' },
  { numero_lista: 9, nombre: 'Escobar Nava, Valentina', fecha_nacimiento: '2017-02-08' },
  { numero_lista: 10, nombre: 'Espinosa Guzmán, Mateo', fecha_nacimiento: '2017-06-30' },
  { numero_lista: 11, nombre: 'Fuentes Ibarra, Renata', fecha_nacimiento: null },
  { numero_lista: 12, nombre: 'Galván Ríos, Leonardo', fecha_nacimiento: '2017-04-17' },
  { numero_lista: 13, nombre: 'Gómez Aranda, Ximena', fecha_nacimiento: '2017-08-09' },
  { numero_lista: 14, nombre: 'Guerrero Peña, Iker', fecha_nacimiento: '2016-10-25' },
  { numero_lista: 15, nombre: 'Hinojosa Salas, Jimena', fecha_nacimiento: '2017-12-01' },
  { numero_lista: 16, nombre: 'Juárez Beltrán, Maximiliano', fecha_nacimiento: '2017-03-05' },
  { numero_lista: 17, nombre: 'Lozano Cervantes, Natalia', fecha_nacimiento: null },
  { numero_lista: 18, nombre: 'Maldonado Quiroz, Sebastián', fecha_nacimiento: '2017-07-21' },
  { numero_lista: 19, nombre: 'Medina Fajardo, Isabella', fecha_nacimiento: '2017-05-13' },
  { numero_lista: 20, nombre: 'Montes Zavala, Rodrigo', fecha_nacimiento: '2016-11-04' },
  { numero_lista: 21, nombre: 'Nájera Trejo, Paulina', fecha_nacimiento: '2017-01-27' },
  { numero_lista: 22, nombre: 'Ordóñez Caballero, Ángel', fecha_nacimiento: '2017-09-08' },
  { numero_lista: 23, nombre: 'Pacheco Villanueva, Danna', fecha_nacimiento: '2017-02-16' },
  { numero_lista: 24, nombre: 'Quintero Arellano, Gael', fecha_nacimiento: null },
  { numero_lista: 25, nombre: 'Ramírez Osorio, Victoria', fecha_nacimiento: '2017-06-12' },
  { numero_lista: 26, nombre: 'Reyes Camacho, Alexander', fecha_nacimiento: '2017-10-30' },
  { numero_lista: 27, nombre: 'Sandoval Miranda, Andrea', fecha_nacimiento: '2017-04-03' },
  { numero_lista: 28, nombre: 'Tapia Rentería, Julián', fecha_nacimiento: '2017-08-26' },
  { numero_lista: 29, nombre: 'Valadez Espinoza, Mariana', fecha_nacimiento: '2016-12-19' },
  { numero_lista: 30, nombre: 'Zamora Contreras, Patricio', fecha_nacimiento: '2017-11-07' },
]
