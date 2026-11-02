// Datos públicos del proyecto de Supabase. La clave publicable está pensada para ir en la app:
// lo que protege los datos es la seguridad por filas y, sobre todo, el cifrado en el dispositivo.
export const SUPABASE_URL = 'https://omjtvdjxtqrthdsgljih.supabase.co';
export const SUPABASE_CLAVE_PUBLICA = 'sb_publishable_e6X2MnaU5J2cmJE5otKTug_-beDWwlP';

export const VERSION_APP = '0.11.0';

// Bloqueo automático tras este tiempo sin tocar la app (milisegundos).
export const BLOQUEO_INACTIVIDAD = 10 * 60 * 1000;

// CIFEAFARM (app de las granjas del centro): datos públicos de su proyecto de Supabase.
// DIACLASHOM solo lee el informe de uso, entrando con la cuenta de administrador de Luis.
export const CIFEAFARM_URL = 'https://mnfkzidvwgnqyvaidczt.supabase.co';
export const CIFEAFARM_CLAVE_PUBLICA = 'sb_publishable_oX5DsKI3WIhqkY-j6EDgKg_jJ84vVwh';
// En qué CE va la propuesta de nota por el uso de CIFEAFARM (elegidos por Luis el 2-11-2026)
export const CIFEAFARM_CE = [
  { curso: 1, grupo: 'G1', modulo: '1274', ce: '2.h' },
  { curso: 2, grupo: 'G2', modulo: '1279', ce: '4.c' },
];
