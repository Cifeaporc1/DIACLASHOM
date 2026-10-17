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
| `vendor/` | supabase-js 2.117.2 (licencia MIT) |

## Fases

1. Base: cifrado, acceso, sincronización, programación y alumnos.
2. Diario: sesiones, salidas, anotaciones, charlas y reuniones.
3. Calificar: prácticas con encargado, trabajos, pruebas, observación directa y libreta. **(versión 0.3.0)**
4. Cierre y Excel: faltas, recuperaciones, empresa, nota final, exportación.
5. Nuevo curso.
