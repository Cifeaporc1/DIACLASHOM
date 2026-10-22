# DIACLASHOM

Cuaderno privado del profesor para los módulos 1274, 1276 y 1279 del CFGS Ganadería y Asistencia en Sanidad Animal (CIFEA Lorca).

Es una app web instalable (PWA). Funciona en el móvil Android y en el PC, sin conexión, y sincroniza a través de Supabase.

## Privacidad

- Todos los datos se cifran **en el dispositivo** (AES-GCM de 256 bits, llave derivada de la clave del profesor con PBKDF2-SHA-256, 600 000 iteraciones) antes de guardarse o enviarse.
- Supabase solo almacena bloques cifrados. Ni Supabase ni GitHub pueden leerlos.
- Este repositorio contiene el programa, la programación didáctica (RA y CE) y las claves genéricas de alumno. No contiene ningún dato de evaluación.
- Si se olvida la clave, los datos son irrecuperables.

## Puesta en marcha (una sola vez)

1. **Supabase → SQL Editor:** pegar y ejecutar `supabase/esquema.sql`.
2. **Supabase → Authentication:** desactivar la confirmación de correo antes de crear la cuenta. Después de crearla, desactivar el alta de usuarios nuevos.
3. **GitHub → Settings → Pages:** publicar desde la rama `main`, carpeta raíz.
4. Abrir la app en el móvil, «Crear cuenta», y desde el menú de Chrome «Añadir a pantalla de inicio» o «Instalar app».

## Estructura

| Ruta | Contenido |
| --- | --- |
| `index.html`, `estilos.css` | Página y estilos |
| `js/cripto.js` | Cifrado y derivación de claves |
| `js/almacen.js` | Almacén local cifrado (IndexedDB) |
| `js/nube.js` | Conexión con Supabase |
| `js/datos.js` | Estado, guardado y sincronización |
| `js/app.js` | Acceso, marco y enrutado |
| `js/diario.js` | Sesiones, anotaciones, charlas y reuniones |
| `js/notas.js` | Motor de cálculo de notas (sin pantallas) |
| `js/calificar.js` | Prácticas, trabajos, pruebas, libreta y notas |
| `pruebas/notas.test.mjs` | Pruebas del cálculo: `node pruebas/notas.test.mjs` |
| `datos/programacion-2026-2027.json` | Módulos, RA, CE, pesos, horario y claves, extraídos de las tablas del curso |
| `supabase/esquema.sql` | Tablas y seguridad por filas |
| `js/cierre.js` | Faltas, recuperaciones, empresa y nota final |
| `js/exportar.js` | Exportación a Excel |
| `js/ical.js` | Lector de calendarios iCal (eventos repetidos, excepciones) |
| `js/curso.js` | Calendario del curso (mes: calendario escolar + Google + tus clases) y horarios (tuyo, 1.º y 2.º). El calendario escolar y los horarios de grupo vienen en `datos/calendario-horarios-2026-2027.json` (con nombres de profesores, por decisión de Luis); se puede importar otro archivo desde la app y entonces se guarda cifrado |
| `js/agenda.js` | Google Calendar en Hoy y en la Semana; crear reunión o salida desde un evento |
| `supabase/funciones/calendario/index.ts` | Función de Supabase que lee la dirección iCal secreta (Google no deja leerla desde el navegador). Solo acepta direcciones de calendar.google.com y exige sesión iniciada |
| `pruebas/ical.test.mjs` | `TZ=Europe/Madrid node pruebas/ical.test.mjs` |
| `vendor/` | supabase-js 2.117.2 (MIT) y SheetJS 0.18.5 (Apache 2.0) |

## Google Calendar (solo lectura)

La dirección iCal secreta se guarda cifrada como un registro más. La app la envía a la función `calendario` de Supabase, que descarga el calendario y lo devuelve; la función no guarda nada. La app no escribe en Google.

## Fases

1. Base: cifrado, acceso, sincronización, programación y alumnos.
2. Diario: sesiones, salidas, anotaciones, charlas y reuniones.
3. Calificar: prácticas con encargado, trabajos, pruebas, observación directa y libreta.
4. Cierre y Excel: faltas, recuperaciones, empresa, nota final, exportación. **(versión 0.4.0)**
5. Nuevo curso.
