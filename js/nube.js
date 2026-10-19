// Conexión con Supabase. Solo viajan bloques cifrados.
import { SUPABASE_URL, SUPABASE_CLAVE_PUBLICA } from './config.js';

let cliente = null;

function sb() {
  if (!cliente) {
    if (!window.supabase) throw new Error('No se ha cargado la librería de Supabase.');
    cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_CLAVE_PUBLICA, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'diaclashom-sesion', detectSessionInUrl: false },
    });
  }
  return cliente;
}

function fallo(error, contexto) {
  const e = new Error(`${contexto}: ${error.message || error}`);
  e.original = error;
  return e;
}

export async function usuarioActual() {
  const { data } = await sb().auth.getSession();
  return data.session ? data.session.user : null;
}

export async function iniciarSesion(correo, contrasena) {
  const { data, error } = await sb().auth.signInWithPassword({ email: correo, password: contrasena });
  if (error) throw fallo(error, 'Inicio de sesión');
  return data.user;
}

export async function crearCuenta(correo, contrasena) {
  const { data, error } = await sb().auth.signUp({ email: correo, password: contrasena });
  if (error) throw fallo(error, 'Alta de cuenta');
  if (!data.session) {
    throw new Error('La cuenta se ha creado, pero Supabase pide confirmar el correo. Desactiva «Confirm email» en Supabase, o confirma el correo, y vuelve a entrar.');
  }
  return data.user;
}

export async function cerrarSesion() {
  try { await sb().auth.signOut(); } catch { /* sin conexión: basta con borrar lo local */ }
}

export async function leerPerfil() {
  const { data, error } = await sb().from('perfil').select('sal, iteraciones, verificador').maybeSingle();
  if (error) throw fallo(error, 'Lectura del perfil');
  return data;
}

export async function crearPerfil(perfil) {
  const { error } = await sb().from('perfil').insert(perfil);
  if (error) throw fallo(error, 'Creación del perfil');
}

export async function subir(filas) {
  if (!filas.length) return [];
  const { data, error } = await sb()
    .from('registros')
    .upsert(filas.map((f) => ({ id: f.id, datos: f.datos, borrado: !!f.borrado })), { onConflict: 'id' })
    .select('id, seq');
  if (error) throw fallo(error, 'Subida');
  return data;
}

export async function bajar(desde, limite = 500) {
  const { data, error } = await sb()
    .from('registros')
    .select('id, datos, borrado, seq')
    .gt('seq', desde)
    .order('seq', { ascending: true })
    .limit(limite);
  if (error) throw fallo(error, 'Descarga');
  return data;
}

// Calendario de Google (solo lectura) a través de la función «calendario» del propio Supabase.
export async function leerCalendario(url) {
  const { data, error } = await sb().functions.invoke('calendario', { body: { url } });
  if (error) {
    let detalle = error.message;
    try { const cuerpo = await error.context?.json?.(); if (cuerpo?.error) detalle = cuerpo.error; } catch { /* sin detalle */ }
    throw new Error(detalle);
  }
  if (data?.error) throw new Error(data.error);
  return data.ics;
}
