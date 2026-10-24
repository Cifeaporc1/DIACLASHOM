// Datos públicos del proyecto de Supabase. La clave publicable está pensada para ir en la app:
// lo que protege los datos es la seguridad por filas y, sobre todo, el cifrado en el dispositivo.
export const SUPABASE_URL = 'https://omjtvdjxtqrthdsgljih.supabase.co';
export const SUPABASE_CLAVE_PUBLICA = 'sb_publishable_e6X2MnaU5J2cmJE5otKTug_-beDWwlP';

export const VERSION_APP = '0.10.0';

// Bloqueo automático tras este tiempo sin tocar la app (milisegundos).
export const BLOQUEO_INACTIVIDAD = 10 * 60 * 1000;
