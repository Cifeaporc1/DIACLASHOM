// Estado de la app: registros descifrados en memoria, guardado cifrado y sincronización.
import * as C from './cripto.js';
import * as A from './almacen.js';
import * as N from './nube.js';
import { VERSION_APP } from './config.js';

const estado = {
  llave: null,
  datos: new Map(),
  sincronizando: false,
  ultimaSync: null,
  aviso: null,
  ilegibles: 0,
};
const oyentes = new Set();
let temporizadorSync = null;

export function onCambio(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}
function avisar() {
  for (const fn of oyentes) {
    try { fn(); } catch (e) { console.error(e); }
  }
}

export const desbloqueado = () => !!estado.llave;
export const infoSync = () => ({ sincronizando: estado.sincronizando, ultimaSync: estado.ultimaSync, aviso: estado.aviso, ilegibles: estado.ilegibles });

export async function aparatoConfigurado() {
  return !!(await A.leerMeta('sal'));
}
export async function correoGuardado() {
  return (await A.leerMeta('correo')) || '';
}

// ---------- Acceso ----------

export async function desbloquear(clave) {
  const [sal, iter, ver] = await Promise.all([A.leerMeta('sal'), A.leerMeta('iteraciones'), A.leerMeta('verificador')]);
  const llave = await C.llaveCifrado(clave, sal, iter);
  if (!(await C.comprobarVerificador(llave, ver))) throw new Error('Clave incorrecta.');
  estado.llave = llave;
  await cargarLocal();
  avisar();
  // La sesión con la nube se renueva en segundo plano; sin conexión la app funciona igual.
  asegurarSesion(clave).then(() => sincronizar()).catch((e) => { estado.aviso = e.message; avisar(); });
}

async function asegurarSesion(clave) {
  if (!navigator.onLine) return;
  if (await N.usuarioActual()) return;
  const correo = await A.leerMeta('correo');
  await N.iniciarSesion(correo, await C.contrasenaAcceso(clave, correo));
}

// Primera vez en este aparato. crear = true solo la primera vez de todas.
export async function primerAcceso(correo, clave, crear) {
  correo = correo.trim().toLowerCase();
  const acceso = await C.contrasenaAcceso(clave, correo);
  if (crear) await N.crearCuenta(correo, acceso);
  else await N.iniciarSesion(correo, acceso);

  let perfil = await N.leerPerfil();
  let llave;
  if (!perfil) {
    const sal = C.salAleatoria();
    llave = await C.llaveCifrado(clave, sal, C.ITER_CIFRADO);
    perfil = { sal, iteraciones: C.ITER_CIFRADO, verificador: await C.crearVerificador(llave) };
    await N.crearPerfil(perfil);
  } else {
    llave = await C.llaveCifrado(clave, perfil.sal, perfil.iteraciones);
    if (!(await C.comprobarVerificador(llave, perfil.verificador))) {
      throw new Error('La clave no coincide con la de tu perfil.');
    }
  }
  await A.guardarMeta('correo', correo);
  await A.guardarMeta('sal', perfil.sal);
  await A.guardarMeta('iteraciones', perfil.iteraciones);
  await A.guardarMeta('verificador', perfil.verificador);
  await A.guardarMeta('cursor', 0);
  estado.llave = llave;
  await cargarLocal();
  await sincronizar();
  if (!porTipo('modulo').length) {
    await sembrar();
    await sincronizar();
  }
  avisar();
}

export function bloquear() {
  estado.llave = null;
  estado.datos.clear();
  avisar();
}

export async function olvidarAparato() {
  await N.cerrarSesion();
  await A.borrarTodo();
  try { localStorage.removeItem('diaclashom-sesion'); } catch { /* nada */ }
  bloquear();
}

// ---------- Lectura ----------

async function cargarLocal() {
  estado.datos.clear();
  estado.ilegibles = 0;
  for (const fila of await A.todosLosRegistros()) {
    if (fila.borrado) continue;
    try {
      estado.datos.set(fila.id, await C.descifrar(estado.llave, fila.datos, fila.id));
    } catch {
      estado.ilegibles++;
    }
  }
}

export function porTipo(tipo) {
  return [...estado.datos.values()].filter((r) => r.tipo === tipo);
}
export function obtener(id) {
  return estado.datos.get(id);
}
export function uno(tipo) {
  return porTipo(tipo)[0];
}

// ---------- Escritura ----------

export async function guardar(objetos) {
  if (!estado.llave) throw new Error('La app está bloqueada.');
  const lista = Array.isArray(objetos) ? objetos : [objetos];
  const filas = [];
  const ahora = new Date().toISOString();
  for (const o of lista) {
    if (!o.id) o.id = crypto.randomUUID();
    if (!o.creado) o.creado = ahora;
    o.mod = ahora;
    filas.push({ id: o.id, datos: await C.cifrar(estado.llave, o, o.id), borrado: false, seq: 0, sucio: true });
  }
  await A.guardarRegistros(filas);
  for (const o of lista) estado.datos.set(o.id, o);
  avisar();
  programarSync();
  return lista;
}

export async function borrar(id) {
  const datos = await C.cifrar(estado.llave, { id, borrado: true }, id);
  await A.guardarRegistros([{ id, datos, borrado: true, seq: 0, sucio: true }]);
  estado.datos.delete(id);
  avisar();
  programarSync();
}

export async function pendientes() {
  return (await A.todosLosRegistros()).filter((f) => f.sucio).length;
}

// ---------- Sincronización ----------

function programarSync() {
  clearTimeout(temporizadorSync);
  temporizadorSync = setTimeout(() => sincronizar().catch(() => {}), 3000);
}

export async function sincronizar() {
  if (!estado.llave || estado.sincronizando) return;
  if (!navigator.onLine) {
    estado.aviso = 'Sin conexión: los cambios se guardan aquí y se subirán después.';
    avisar();
    return;
  }
  estado.sincronizando = true;
  avisar();
  try {
    if (!(await N.usuarioActual())) {
      throw new Error('No hay sesión con la nube. Bloquea y vuelve a desbloquear con conexión.');
    }
    // 1. Subir lo pendiente.
    const sucias = (await A.todosLosRegistros()).filter((f) => f.sucio);
    if (sucias.length) {
      const resp = await N.subir(sucias);
      const seqPorId = new Map(resp.map((r) => [r.id, r.seq]));
      const actuales = new Map((await A.todosLosRegistros()).map((f) => [f.id, f]));
      const limpias = [];
      for (const f of sucias) {
        const ahora = actuales.get(f.id);
        // Solo se marca como subida si no ha cambiado mientras tanto.
        if (ahora && ahora.datos === f.datos) limpias.push({ ...ahora, sucio: false, seq: seqPorId.get(f.id) || ahora.seq });
      }
      await A.guardarRegistros(limpias);
    }
    // 2. Bajar lo nuevo.
    let cursor = (await A.leerMeta('cursor')) || 0;
    for (;;) {
      const lote = await N.bajar(cursor);
      if (!lote.length) break;
      const locales = new Map((await A.todosLosRegistros()).map((f) => [f.id, f]));
      const guardar = [];
      for (const r of lote) {
        cursor = Math.max(cursor, r.seq);
        const local = locales.get(r.id);
        if (local && local.sucio && local.datos !== r.datos) continue; // gana el cambio local pendiente
        guardar.push({ id: r.id, datos: r.datos, borrado: r.borrado, seq: r.seq, sucio: false });
        if (r.borrado) {
          estado.datos.delete(r.id);
        } else {
          try {
            estado.datos.set(r.id, await C.descifrar(estado.llave, r.datos, r.id));
          } catch {
            estado.ilegibles++;
          }
        }
      }
      await A.guardarRegistros(guardar);
      await A.guardarMeta('cursor', cursor);
      if (lote.length < 500) break;
    }
    estado.ultimaSync = new Date();
    estado.aviso = null;
  } catch (e) {
    estado.aviso = e.message;
  } finally {
    estado.sincronizando = false;
    avisar();
  }
}

// ---------- Carga inicial de la programación ----------

export async function sembrar() {
  const resp = await fetch('datos/programacion-2026-2027.json', { cache: 'no-cache' });
  const p = await resp.json();
  const objetos = [{ tipo: 'curso', nombre: p.curso, centro: p.centro, actual: true }];
  for (const g of p.grupos) {
    objetos.push({ tipo: 'grupo', codigo: g.id, nombre: g.nombre, curso: p.curso });
    g.claves.forEach((clave, i) => objetos.push({ tipo: 'alumno', clave, grupo: g.id, orden: i + 1, activo: true, curso: p.curso }));
  }
  for (const m of p.modulos) objetos.push({ tipo: 'modulo', curso: p.curso, ...m });
  objetos.push({ tipo: 'horario', curso: p.curso, franjas: p.horario });
  objetos.push({ tipo: 'listas', encargadoItems: p.encargadoItems, libretaApartados: p.libretaApartados, tiposAnotacion: p.tiposAnotacion });
  await guardar(objetos);
}

// ---------- Copia de seguridad (cifrada) ----------

export async function copiaSeguridad() {
  const filas = (await A.todosLosRegistros()).map(({ id, datos, borrado }) => ({ id, datos, borrado }));
  return {
    app: 'DIACLASHOM',
    version: VERSION_APP,
    fecha: new Date().toISOString(),
    correo: await A.leerMeta('correo'),
    sal: await A.leerMeta('sal'),
    iteraciones: await A.leerMeta('iteraciones'),
    verificador: await A.leerMeta('verificador'),
    registros: filas,
  };
}
