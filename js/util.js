// Utilidades compartidas por las pantallas.
import * as D from './datos.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const pct = (x) => `${Math.round(x * 1000) / 10}`.replace('.', ',') + ' %';
export const num = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
export const evTexto = (n) => (n ? `${n}.ª ev.` : '');

// ---------- Fechas (siempre en hora local, nunca UTC) ----------

export function hoyISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function aFecha(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}
export function fechaLarga(iso) {
  return iso ? aFecha(iso).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
}
export function fechaCorta(iso) {
  return iso ? aFecha(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }) : '';
}
export function minutos(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}
export function hhmm(min) {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}
// Para <input type="time">, que exige dos cifras en la hora.
export function horaInput(h) {
  if (!h) return '';
  const [a, b] = h.split(':');
  return `${a.padStart(2, '0')}:${(b || '00').padStart(2, '0')}`;
}
export function horaCorta(h) {
  if (!h) return '';
  const [a, b] = h.split(':');
  return `${Number(a)}:${b}`;
}

// ---------- Datos de la programación ----------

export function modulo(codigo) {
  return D.porTipo('modulo').find((m) => m.codigo === codigo);
}
export function grupo(codigo) {
  return D.porTipo('grupo').find((g) => g.codigo === codigo);
}
export function grupos() {
  return D.porTipo('grupo').sort((a, b) => a.codigo.localeCompare(b.codigo));
}
export function modulos() {
  return D.porTipo('modulo').sort((a, b) => a.grupo.localeCompare(b.grupo) || a.codigo.localeCompare(b.codigo));
}
export function modulosDeGrupo(codigoGrupo) {
  return modulos().filter((m) => m.grupo === codigoGrupo);
}
export function alumnosDe(codigoGrupo) {
  return D.porTipo('alumno').filter((a) => a.grupo === codigoGrupo).sort((a, b) => a.orden - b.orden);
}
export function alumno(clave) {
  return D.porTipo('alumno').find((a) => a.clave === clave);
}
export function utsDe(codigosModulo) {
  const uts = new Set();
  for (const c of codigosModulo) for (const ce of modulo(c)?.ce || []) if (ce.ut) uts.add(ce.ut);
  return [...uts].sort((a, b) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')));
}
export function listas() {
  return D.uno('listas') || { tiposAnotacion: [], encargadoItems: [], libretaApartados: [] };
}

// ---------- Rutas: #/ruta/param?clave=valor ----------

export function rutaActual() {
  const h = location.hash || '#/hoy';
  const [camino, consulta = ''] = h.slice(2).split('?');
  const [ruta, param] = camino.split('/');
  return { ruta: ruta || 'hoy', param: param ? decodeURIComponent(param) : '', q: Object.fromEntries(new URLSearchParams(consulta)) };
}
export function ir(hash) {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}

export function primeraLinea(texto, max = 90) {
  const l = String(texto || '').trim().split('\n')[0];
  return l.length > max ? l.slice(0, max - 1) + '…' : l;
}

// Guardado diferido: agrupa muchas pulsaciones en un solo guardado.
export function diferido(fn, ms = 700) {
  let t = null;
  const f = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  f.ya = (...a) => { clearTimeout(t); return fn(...a); };
  f.cancelar = () => clearTimeout(t);
  return f;
}

// Siglas de los módulos, junto al código: «1274 OCRC».
export const SIGLAS = { 1274: 'OCRC', 1276: 'GRC', 1279: 'SG' };
export function etiqueta(codigo) {
  const s = modulo(codigo)?.sigla || SIGLAS[codigo];
  return s ? `${codigo} ${s}` : String(codigo);
}
export function etiquetas(codigos, sep = ' + ') {
  return (codigos || []).map(etiqueta).join(sep);
}
