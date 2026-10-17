// Interfaz de DIACLASHOM (fase 1): acceso, inicio, módulos, alumnos y ajustes.
import * as D from './datos.js';
import { VERSION_APP, BLOQUEO_INACTIVIDAD } from './config.js';

const raiz = document.getElementById('app');
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DURACION_FRANJA = 55; // minutos

// ---------- Utilidades ----------

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (x) => `${Math.round(x * 1000) / 10}`.replace('.', ',') + ' %';
const num = (x) => String(Math.round(x * 100) / 100).replace('.', ',');
const evTexto = (n) => (n ? `${n}.ª ev.` : '');

function minutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
function hhmm(min) {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}

function modulo(codigo) {
  return D.porTipo('modulo').find((m) => m.codigo === codigo);
}
function grupo(codigo) {
  return D.porTipo('grupo').find((g) => g.codigo === codigo);
}
function alumnosDe(codigoGrupo) {
  return D.porTipo('alumno').filter((a) => a.grupo === codigoGrupo).sort((a, b) => a.orden - b.orden);
}

// ---------- Acceso ----------

async function pintarAcceso(mensaje) {
  const configurado = await D.aparatoConfigurado();
  if (configurado) return pintarDesbloqueo(mensaje);
  pintarPrimeraVez('entrar', mensaje);
}

async function pintarDesbloqueo(mensaje) {
  const correo = await D.correoGuardado();
  raiz.innerHTML = `
    <div class="acceso">
      <img class="logo-acceso" src="iconos/logo.png" alt="DIACLASHOM" width="240" height="240">
      <p class="lema">Cuaderno del profesor · ${esc(correo)}</p>
      ${mensaje ? `<div class="mensaje ${mensaje.tipo}">${esc(mensaje.texto)}</div>` : ''}
      <form id="f-desbloqueo" autocomplete="on">
        <input type="email" name="usuario" value="${esc(correo)}" autocomplete="username" hidden>
        <label class="campo"><span>Clave</span>
          <input type="password" name="clave" autocomplete="current-password" required autofocus>
        </label>
        <button class="boton" type="submit">Desbloquear</button>
      </form>
      <p class="pie"><button class="enlace" id="b-olvidar" type="button">Usar otra cuenta en este aparato</button></p>
    </div>`;
  const f = document.getElementById('f-desbloqueo');
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const boton = f.querySelector('button');
    boton.disabled = true;
    boton.textContent = 'Abriendo… unos segundos';
    try {
      await D.desbloquear(f.clave.value);
      if (!location.hash) location.hash = '#/hoy';
      pintar();
    } catch (e) {
      pintarDesbloqueo({ tipo: 'error', texto: e.message });
    }
  });
  document.getElementById('b-olvidar').addEventListener('click', async () => {
    if (!confirm('Se borrarán de este aparato los datos guardados aquí. Los que ya estén en la nube no se pierden. ¿Seguir?')) return;
    await D.olvidarAparato();
    pintarAcceso();
  });
}

function pintarPrimeraVez(modo, mensaje) {
  const crear = modo === 'crear';
  raiz.innerHTML = `
    <div class="acceso">
      <img class="logo-acceso" src="iconos/logo.png" alt="DIACLASHOM" width="240" height="240">
      <p class="lema">Cuaderno del profesor</p>
      <div class="segmento" role="tablist">
        <button type="button" data-modo="entrar" class="${crear ? '' : 'activo'}">Ya tengo cuenta</button>
        <button type="button" data-modo="crear" class="${crear ? 'activo' : ''}">Crear cuenta</button>
      </div>
      ${mensaje ? `<div class="mensaje ${mensaje.tipo}">${esc(mensaje.texto)}</div>` : ''}
      ${crear ? `<div class="mensaje aviso">Solo la primera vez de todas. Si olvidas la clave, los datos no se pueden recuperar: nadie la conoce salvo tú. Apúntala en papel.</div>` : ''}
      <form id="f-acceso" autocomplete="on">
        <label class="campo"><span>Correo</span>
          <input type="email" name="correo" autocomplete="username" required>
        </label>
        <label class="campo"><span>Clave${crear ? ' (mínimo 10 caracteres)' : ''}</span>
          <input type="password" name="clave" autocomplete="${crear ? 'new-password' : 'current-password'}" minlength="${crear ? 10 : 1}" required>
        </label>
        ${crear ? `
        <label class="campo"><span>Repite la clave</span>
          <input type="password" name="clave2" autocomplete="new-password" required>
        </label>
        <label class="casilla"><input type="checkbox" name="apuntada" required>
          <span>He apuntado la clave en papel y sé que sin ella no hay forma de recuperar los datos.</span>
        </label>` : ''}
        <button class="boton" type="submit">${crear ? 'Crear cuenta y entrar' : 'Entrar'}</button>
      </form>
      <p class="pie">Los datos se cifran en este aparato antes de guardarse en la nube.</p>
    </div>`;
  raiz.querySelectorAll('[data-modo]').forEach((b) => b.addEventListener('click', () => pintarPrimeraVez(b.dataset.modo)));
  const f = document.getElementById('f-acceso');
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (crear && f.clave.value !== f.clave2.value) {
      return pintarPrimeraVez(modo, { tipo: 'error', texto: 'Las dos claves no coinciden.' });
    }
    if (!navigator.onLine) {
      return pintarPrimeraVez(modo, { tipo: 'error', texto: 'La primera vez en cada aparato hace falta conexión.' });
    }
    const boton = f.querySelector('button[type=submit]');
    boton.disabled = true;
    boton.textContent = 'Preparando el cifrado… unos segundos';
    try {
      await D.primerAcceso(f.correo.value, f.clave.value, crear);
      location.hash = '#/hoy';
      pintar();
    } catch (e) {
      let texto = e.message;
      if (/invalid login credentials/i.test(texto)) texto = 'Correo o clave incorrectos. Si es la primera vez de todas, usa «Crear cuenta».';
      if (/already registered|already been registered/i.test(texto)) texto = 'Ese correo ya tiene cuenta. Usa «Ya tengo cuenta».';
      pintarPrimeraVez(modo, { tipo: 'error', texto });
    }
  });
}

// ---------- Marco de la app ----------

const PESTANAS = [
  { ruta: 'hoy', texto: 'Hoy', ico: '◷' },
  { ruta: 'modulos', texto: 'Módulos', ico: '▤' },
  { ruta: 'alumnos', texto: 'Alumnos', ico: '◉' },
  { ruta: 'ajustes', texto: 'Ajustes', ico: '⚙' },
];

function estadoSync() {
  const s = D.infoSync();
  if (s.sincronizando) return { clase: 'pendiente', texto: 'Sincronizando…' };
  if (!navigator.onLine) return { clase: '', texto: 'Sin conexión' };
  if (s.aviso) return { clase: 'error', texto: 'Revisar' };
  if (s.ultimaSync) return { clase: 'ok', texto: 'Al día' };
  return { clase: 'pendiente', texto: 'Pendiente' };
}

function marco(titulo, cuerpo, { volver = null, pestana = null } = {}) {
  const s = estadoSync();
  raiz.innerHTML = `
    <div class="marco">
      <header class="cabecera">
        <div class="barra-marca">
          <a href="#/hoy" class="marca-mini"><img src="iconos/logo-mini.png" alt="" width="40" height="40"><span>DIACLASHOM</span></a>
          <button class="estado-sync ${s.clase}" type="button" id="b-sync" title="Sincronizar ahora"><i></i>${esc(s.texto)}</button>
        </div>
        <div class="barra-titulo">
          ${volver ? `<button class="volver" type="button" aria-label="Volver" data-volver="${esc(volver)}">‹</button>` : ''}
          <h1>${esc(titulo)}</h1>
        </div>
      </header>
      <main>${cuerpo}</main>
      <nav class="navegacion" aria-label="Secciones"><div class="dentro">
        ${PESTANAS.map((p) => `<a href="#/${p.ruta}" class="${p.ruta === pestana ? 'activo' : ''}"><span class="ico" aria-hidden="true">${p.ico}</span>${p.texto}</a>`).join('')}
      </div></nav>
    </div>`;
  raiz.querySelector('[data-volver]')?.addEventListener('click', (e) => { location.hash = e.currentTarget.dataset.volver; });
  document.getElementById('b-sync').addEventListener('click', () => D.sincronizar());
}

// ---------- Hoy ----------

function bloquesDelDia(dia) {
  const horario = D.uno('horario');
  if (!horario) return [];
  const franjas = horario.franjas.filter((f) => f.dia === dia).sort((a, b) => minutos(a.inicio) - minutos(b.inicio));
  const bloques = [];
  for (const f of franjas) {
    const ini = minutos(f.inicio);
    const ultimo = bloques[bloques.length - 1];
    if (ultimo && ultimo.clave === (f.modulo || f.texto) && ultimo.fin === ini) {
      ultimo.fin = ini + DURACION_FRANJA;
    } else {
      bloques.push({ clave: f.modulo || f.texto, modulo: f.modulo, texto: f.texto, inicio: ini, fin: ini + DURACION_FRANJA });
    }
  }
  return bloques;
}

function pintarBloques(bloques) {
  if (!bloques.length) return '<p class="vacio">Sin clases.</p>';
  return bloques.map((b) => {
    const m = b.modulo ? modulo(b.modulo) : null;
    const g = m ? grupo(m.grupo) : null;
    return `<div class="franja ${m ? '' : 'otro'}">
      <div class="hora">${hhmm(b.inicio)}–${hhmm(b.fin)}</div>
      <div class="materia">${m
        ? `<a href="#/modulo/${esc(m.codigo)}" style="color:inherit"><strong>${esc(m.codigo)}</strong> ${esc(m.nombre)}</a><div class="sub" style="color:var(--texto-suave);font-size:.9rem">${esc(g?.nombre || '')}</div>`
        : esc(b.texto.charAt(0) + b.texto.slice(1).toLowerCase())}</div>
    </div>`;
  }).join('');
}

function vistaHoy() {
  const hoy = new Date();
  const fecha = hoy.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  let siguiente = new Date(hoy);
  do { siguiente.setDate(siguiente.getDate() + 1); } while ([0, 6].includes(siguiente.getDay()));
  const fechaSig = siguiente.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  marco('Hoy', `
    <h2>${esc(fecha)}</h2>
    <div class="tarjeta">${pintarBloques(bloquesDelDia(hoy.getDay()))}</div>
    <h2>Próximo día de clase · ${esc(fechaSig)}</h2>
    <div class="tarjeta">${pintarBloques(bloquesDelDia(siguiente.getDay()))}</div>
    <div class="mensaje info">Versión ${esc(VERSION_APP)}: base cifrada, programación y alumnos. Las sesiones, notas y reuniones llegan en las siguientes fases.</div>
  `, { pestana: 'hoy' });
}

// ---------- Módulos ----------

function vistaModulos() {
  const mods = D.porTipo('modulo').sort((a, b) => a.grupo.localeCompare(b.grupo) || a.codigo.localeCompare(b.codigo));
  marco('Módulos', mods.map((m) => `
    <a class="tarjeta" href="#/modulo/${esc(m.codigo)}">
      <div class="fila"><span class="titulo crece">${esc(m.codigo)} · ${esc(m.nombre)}</span><span class="chip">${esc(grupo(m.grupo)?.nombre || '')}</span></div>
      <div class="sub">${m.ra.length} RA · ${m.ce.length} CE · ${m.evaluaciones} evaluaciones · ${num(m.horas)} h</div>
    </a>`).join('') || '<p class="vacio">No hay módulos cargados.</p>', { pestana: 'modulos' });
}

function vistaModulo(codigo) {
  const m = modulo(codigo);
  if (!m) return marco('Módulo', '<p class="vacio">No encontrado.</p>', { volver: '#/modulos', pestana: 'modulos' });
  const cuenta = (i) => m.ce.filter((c) => c.instrumento === i).length;
  const ras = m.ra.map((ra) => {
    const ces = m.ce.filter((c) => c.ra === ra.codigo);
    return `<details class="ra">
      <summary>
        <div class="fila"><strong class="crece">${esc(ra.codigo)}</strong><span class="chip">${pct(ra.peso)}</span><span class="chip neutro">${esc(ra.ut)} · ${evTexto(ra.ev)}</span></div>
        <div class="texto">${esc(ra.texto)}</div>
      </summary>
      ${ces.map((c) => `<div class="ce">
        <div class="cab"><span class="cod">${esc(c.codigo)}</span><span class="chip">${pct(c.peso)}</span><span class="chip neutro">${esc(c.instrumento)}</span><span class="chip neutro">${esc(c.actividad || '')}</span></div>
        <div class="texto">${esc(c.texto)}</div>
      </div>`).join('')}
    </details>`;
  }).join('');
  marco(`${m.codigo} · ${m.nombre}`, `
    <div class="tarjeta">
      <dl class="datos">
        <dt>Grupo</dt><dd>${esc(grupo(m.grupo)?.nombre || '')}</dd>
        <dt>Horas de la fase de centro</dt><dd>${num(m.horas)} h</dd>
        <dt>Límite de faltas (${pct(m.pctFaltas)})</dt><dd>${num(m.horas * m.pctFaltas)} h</dd>
        <dt>Evaluaciones</dt><dd>${m.evaluaciones}</dd>
        <dt>Fase de centro / empresa</dt><dd>${pct(m.pesoFC)} / ${pct(m.pesoFE)}</dd>
        <dt>Libreta imprescindible para PP</dt><dd>${m.libretaImprescindible ? 'Sí' : 'No'}</dd>
        <dt>CE por instrumento</dt><dd>PE ${cuenta('PE')} · PP ${cuenta('PP')} · TP ${cuenta('TP')} · OD ${cuenta('OD')}</dd>
      </dl>
    </div>
    <h2>Resultados de aprendizaje</h2>
    ${ras}
  `, { volver: '#/modulos', pestana: 'modulos' });
}

// ---------- Alumnos ----------

let grupoElegido = 'G1';

function vistaAlumnos() {
  const grupos = D.porTipo('grupo').sort((a, b) => a.codigo.localeCompare(b.codigo));
  if (!grupos.find((g) => g.codigo === grupoElegido) && grupos[0]) grupoElegido = grupos[0].codigo;
  const alumnos = alumnosDe(grupoElegido);
  marco('Alumnos', `
    <div class="segmento">${grupos.map((g) => `<button type="button" data-grupo="${esc(g.codigo)}" class="${g.codigo === grupoElegido ? 'activo' : ''}">${esc(g.nombre)}</button>`).join('')}</div>
    <p class="sub" style="color:var(--texto-suave);margin:0 0 12px">${alumnos.length} alumnos · solo claves, sin nombres</p>
    <div class="rejilla-claves">${alumnos.map((a) => `<a href="#/alumno/${esc(a.clave)}">${esc(a.clave)}</a>`).join('')}</div>
  `, { pestana: 'alumnos' });
  raiz.querySelectorAll('[data-grupo]').forEach((b) => b.addEventListener('click', () => { grupoElegido = b.dataset.grupo; vistaAlumnos(); }));
}

function vistaAlumno(clave) {
  const a = D.porTipo('alumno').find((x) => x.clave === clave);
  if (!a) return marco('Alumno', '<p class="vacio">No encontrado.</p>', { volver: '#/alumnos', pestana: 'alumnos' });
  const mods = D.porTipo('modulo').filter((m) => m.grupo === a.grupo);
  marco(a.clave, `
    <div class="tarjeta">
      <dl class="datos">
        <dt>Grupo</dt><dd>${esc(grupo(a.grupo)?.nombre || '')}</dd>
        <dt>Número de lista</dt><dd>${a.orden}</dd>
        <dt>Estado</dt><dd>${a.activo ? 'Activo' : 'Baja'}</dd>
      </dl>
    </div>
    <h2>Módulos</h2>
    <ul class="lista tarjeta">${mods.map((m) => `<li><a href="#/modulo/${esc(m.codigo)}">${esc(m.codigo)} · ${esc(m.nombre)}</a></li>`).join('')}</ul>
    <p class="vacio">Sus notas, anotaciones y charlas aparecerán aquí en las siguientes fases.</p>
  `, { volver: '#/alumnos', pestana: 'alumnos' });
}

// ---------- Ajustes ----------

async function vistaAjustes() {
  const s = D.infoSync();
  const pend = await D.pendientes();
  const correo = await D.correoGuardado();
  const curso = D.uno('curso');
  marco('Ajustes', `
    <h2>Sincronización</h2>
    <div class="tarjeta">
      ${s.aviso ? `<div class="mensaje aviso">${esc(s.aviso)}</div>` : ''}
      <dl class="datos">
        <dt>Cuenta</dt><dd>${esc(correo)}</dd>
        <dt>Cambios sin subir</dt><dd>${pend}</dd>
        <dt>Última sincronización</dt><dd>${s.ultimaSync ? esc(s.ultimaSync.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })) : '—'}</dd>
        ${s.ilegibles ? `<dt>Registros que no se han podido descifrar</dt><dd>${s.ilegibles}</dd>` : ''}
      </dl>
      <div class="botones" style="margin-top:12px"><button class="boton secundario" id="b-sincronizar" type="button">Sincronizar ahora</button></div>
    </div>
    <h2>Seguridad</h2>
    <div class="tarjeta botones">
      <button class="boton" id="b-bloquear" type="button">Bloquear ahora</button>
      <button class="boton secundario" id="b-copia" type="button">Descargar copia de seguridad cifrada</button>
      <p class="sub" style="color:var(--texto-suave);margin:0">La app se bloquea sola tras 10 minutos sin usarla. La copia solo se puede abrir con tu clave.</p>
    </div>
    <h2>Este aparato</h2>
    <div class="tarjeta botones">
      <button class="boton peligro" id="b-olvidar" type="button">Olvidar este aparato</button>
      <p class="sub" style="color:var(--texto-suave);margin:0">Borra los datos guardados en este aparato y cierra la sesión. Lo que ya está en la nube no se pierde.</p>
    </div>
    <p class="pie">DIACLASHOM ${esc(VERSION_APP)} · curso ${esc(curso?.nombre || '')}</p>
  `, { pestana: 'ajustes' });
  document.getElementById('b-sincronizar').addEventListener('click', () => D.sincronizar());
  document.getElementById('b-bloquear').addEventListener('click', () => { D.bloquear(); });
  document.getElementById('b-copia').addEventListener('click', descargarCopia);
  document.getElementById('b-olvidar').addEventListener('click', async () => {
    const pendientes = await D.pendientes();
    const extra = pendientes ? ` Hay ${pendientes} cambios sin subir que se perderán.` : '';
    if (!confirm(`Se borrarán los datos de este aparato.${extra} ¿Seguir?`)) return;
    await D.olvidarAparato();
    pintarAcceso();
  });
}

async function descargarCopia() {
  const copia = await D.copiaSeguridad();
  const blob = new Blob([JSON.stringify(copia)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `diaclashom-copia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- Enrutado ----------

let pintando = false;
async function pintar() {
  if (pintando) return;
  pintando = true;
  try {
    if (!D.desbloqueado()) return await pintarAcceso();
    const [, ruta, param] = (location.hash || '#/hoy').split('/');
    const p = param ? decodeURIComponent(param) : '';
    switch (ruta) {
      case 'modulos': return vistaModulos();
      case 'modulo': return vistaModulo(p);
      case 'alumnos': return vistaAlumnos();
      case 'alumno': return vistaAlumno(p);
      case 'ajustes': return await vistaAjustes();
      default: return vistaHoy();
    }
  } finally {
    pintando = false;
  }
}

window.addEventListener('hashchange', pintar);
window.addEventListener('online', () => { D.sincronizar(); pintar(); });
window.addEventListener('offline', pintar);

// Repintar al cambiar el estado, sin perder lo que se está escribiendo en un formulario.
let repintado = null;
D.onCambio(() => {
  clearTimeout(repintado);
  repintado = setTimeout(() => {
    if (!D.desbloqueado()) return pintar();
    const activo = document.activeElement;
    if (activo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activo.tagName)) return;
    const y = window.scrollY;
    const abiertos = [...raiz.querySelectorAll('details[open]')].map((d) => d.querySelector('strong')?.textContent);
    Promise.resolve(pintar()).then(() => {
      raiz.querySelectorAll('details').forEach((d) => { if (abiertos.includes(d.querySelector('strong')?.textContent)) d.open = true; });
      window.scrollTo(0, y);
    });
  }, 150);
});

// ---------- Bloqueo automático ----------

let ultimaActividad = Date.now();
['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((t) => window.addEventListener(t, () => { ultimaActividad = Date.now(); }, { passive: true }));
setInterval(() => {
  if (D.desbloqueado() && Date.now() - ultimaActividad > BLOQUEO_INACTIVIDAD) D.bloquear();
}, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && D.desbloqueado() && Date.now() - ultimaActividad > BLOQUEO_INACTIVIDAD) D.bloquear();
});

// ---------- Instalación y arranque ----------

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

pintar();
