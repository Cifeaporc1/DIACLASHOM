// Interfaz de DIACLASHOM: acceso, marco, módulos, alumnos, ajustes y enrutado.
import * as D from './datos.js';
import { VERSION_APP, BLOQUEO_INACTIVIDAD } from './config.js';
import { esc, pct, num, evTexto, modulo, grupo, alumnosDe, rutaActual, etiqueta, nombreHTML, nombresOcultos, alternarNombres } from './util.js';
import * as Nombres from './nombres.js';
import * as Agenda from './agenda.js';
import * as Curso from './curso.js';
import * as Diario from './diario.js';
import * as Calificar from './calificar.js';
import * as Cierre from './cierre.js';
import * as Exportar from './exportar.js';

const raiz = document.getElementById('app');
let pantallaEditable = false;

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
  { ruta: 'diario', texto: 'Diario', ico: '✎' },
  { ruta: 'notas', texto: 'Notas', ico: '✓' },
  { ruta: 'alumnos', texto: 'Alumnos', ico: '◉' },
  { ruta: 'ajustes', texto: 'Más', ico: '⋯' },
];

function estadoSync() {
  const s = D.infoSync();
  if (s.sincronizando) return { clase: 'pendiente', texto: 'Sincronizando…' };
  if (!navigator.onLine) return { clase: '', texto: 'Sin conexión' };
  if (s.aviso) return { clase: 'error', texto: 'Revisar' };
  if (s.ultimaSync) return { clase: 'ok', texto: 'Al día' };
  return { clase: 'pendiente', texto: 'Pendiente' };
}

function marco(titulo, cuerpo, { volver = null, pestana = null, editable = false } = {}) {
  pantallaEditable = editable;
  const s = estadoSync();
  raiz.innerHTML = `
    <div class="marco">
      <header class="cabecera">
        <div class="barra-marca">
          <a href="#/hoy" class="marca-mini"><img src="iconos/logo-mini.png" alt="" width="40" height="40"><span>DIACLASHOM</span></a>
          <button class="estado-sync ojo ${nombresOcultos() ? 'activo' : ''}" type="button" id="b-ojo" title="${nombresOcultos() ? 'Mostrar nombres' : 'Ocultar nombres'}" aria-pressed="${nombresOcultos()}">${nombresOcultos() ? 'Claves' : 'Nombres'}</button>
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
  document.getElementById('b-ojo').addEventListener('click', () => { alternarNombres(); pintar(); });
}

// ---------- Módulos ----------

function vistaModulos() {
  const mods = D.porTipo('modulo').sort((a, b) => a.grupo.localeCompare(b.grupo) || a.codigo.localeCompare(b.codigo));
  marco('Módulos', mods.map((m) => `
    <a class="tarjeta" href="#/modulo/${esc(m.codigo)}">
      <div class="fila"><span class="titulo crece">${esc(etiqueta(m.codigo))} · ${esc(m.nombre)}</span><span class="chip">${esc(grupo(m.grupo)?.nombre || '')}</span></div>
      <div class="sub">${m.ra.length} RA · ${m.ce.length} CE · ${m.evaluaciones} evaluaciones · ${num(m.horas)} h</div>
    </a>`).join('') || '<p class="vacio">No hay módulos cargados.</p>', { pestana: 'ajustes' });
}

function vistaModulo(codigo) {
  const m = modulo(codigo);
  if (!m) return marco('Módulo', '<p class="vacio">No encontrado.</p>', { volver: '#/modulos', pestana: 'ajustes' });
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
  marco(`${etiqueta(m.codigo)} · ${m.nombre}`, `
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
  `, { volver: '#/modulos', pestana: 'ajustes' });
}

// ---------- Alumnos ----------

let grupoElegido = 'G1';

function vistaAlumnos() {
  const grupos = D.porTipo('grupo').sort((a, b) => a.codigo.localeCompare(b.codigo));
  if (!grupos.find((g) => g.codigo === grupoElegido) && grupos[0]) grupoElegido = grupos[0].codigo;
  const alumnos = alumnosDe(grupoElegido);
  marco('Alumnos', `
    <div class="segmento">${grupos.map((g) => `<button type="button" data-grupo="${esc(g.codigo)}" class="${g.codigo === grupoElegido ? 'activo' : ''}">${esc(g.nombre)}</button>`).join('')}</div>
    <p class="sub" style="color:var(--texto-suave);margin:0 0 12px">${alumnos.length} alumnos${nombresOcultos() ? ' · nombres ocultos' : ''}</p>
    <div class="rejilla-claves">${alumnos.map((a) => `<a href="#/alumno/${esc(a.clave)}">${nombreHTML(a.clave)}</a>`).join('')}</div>
  `, { pestana: 'alumnos' });
  raiz.querySelectorAll('[data-grupo]').forEach((b) => b.addEventListener('click', () => { grupoElegido = b.dataset.grupo; vistaAlumnos(); }));
}

// ---------- Ajustes ----------

async function vistaAjustes() {
  const s = D.infoSync();
  const pend = await D.pendientes();
  const correo = await D.correoGuardado();
  const curso = D.uno('curso');
  marco('Más', `
    <h2>Exportar</h2>
    <div class="tarjeta botones">
      <button class="boton" type="button" id="b-excel">Descargar Excel (solo claves)</button>
      <button class="boton secundario" type="button" id="b-excel-nombres">Descargar Excel con nombres</button>
      <p class="sub" style="margin:0">Se genera en este aparato. El archivo no va cifrado: el que lleva nombres, guárdalo solo en tus aparatos.</p>
    </div>
    <h2>Alumnos</h2>
    <a class="tarjeta" href="#/nombres"><div class="titulo">Nombres de alumnos</div><div class="sub">${D.porTipo('alumno').filter((a) => a.apellido1 || a.nombre).length} de ${D.porTipo('alumno').filter((a) => a.activo !== false).length} con nombre · importar desde Excel</div></a>
    <h2>Organización</h2>
    <a class="tarjeta" href="#/mes"><div class="titulo">Calendario y horarios</div><div class="sub">Calendario escolar, Google Calendar, tu horario y el de 1.º y 2.º GASA</div></a>
    <a class="tarjeta" href="#/semana"><div class="titulo">Semana</div><div class="sub">Tus clases y los eventos de Google Calendar</div></a>
    <a class="tarjeta" href="#/calendario"><div class="titulo">Google Calendar</div><div class="sub">${D.uno('calendario') ? 'Conectado · cambiar o desconectar' : 'Conectar un calendario (solo lectura)'}</div></a>
    <a class="tarjeta" href="#/reuniones"><div class="titulo">Reuniones y tareas</div><div class="sub">Departamento, claustros, equipos docentes y lo que te toca hacer</div></a>
    <h2>Programación</h2>
    <a class="tarjeta" href="#/modulos"><div class="titulo">Módulos, RA y CE</div><div class="sub">Pesos, instrumentos, unidades de trabajo y límites de faltas</div></a>
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
  for (const [id, conNombres] of [['b-excel', false], ['b-excel-nombres', true]]) {
    document.getElementById(id).addEventListener('click', async (ev) => {
      const b = ev.currentTarget;
      const texto = b.textContent;
      b.disabled = true;
      b.textContent = 'Preparando el Excel…';
      try { await Exportar.descargarExcel({ conNombres }); } catch (e) { alert(`No se ha podido generar el Excel: ${e.message}`); }
      b.disabled = false;
      b.textContent = texto;
    });
  }
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
    const { ruta, param, q } = rutaActual();
    switch (ruta) {
      case 'diario': return Diario.vistaDiario();
      case 'sesion': return Diario.vistaSesion(param);
      case 'anotar': return Diario.vistaAnotacion(null, q);
      case 'anotacion': return Diario.vistaAnotacion(param, q);
      case 'charla': return Diario.vistaCharla(param === 'nueva' ? null : param, q);
      case 'reuniones': return Diario.vistaReuniones();
      case 'notas': return Calificar.vistaNotas();
      case 'practica': return Calificar.vistaPractica(param);
      case 'calificacion': return param === 'nueva' ? Calificar.nuevaCalificacion(q) : Calificar.vistaCalificacion(param);
      case 'libreta': return Calificar.vistaLibreta(param);
      case 'faltas': return Cierre.vistaFaltas(param);
      case 'final': return Cierre.vistaFinal(param);
      case 'final-alumno': { const [mod, clave] = location.hash.split('?')[0].split('/').slice(2).map(decodeURIComponent); return Cierre.vistaFinalAlumno(mod, clave); }
      case 'nota-alumno': { const [mod, clave] = location.hash.split('?')[0].split('/').slice(2).map(decodeURIComponent); return Calificar.vistaNotaAlumno(mod, clave, q); }
      case 'reunion': return Diario.vistaReunion(param);
      case 'modulos': return vistaModulos();
      case 'modulo': return vistaModulo(param);
      case 'alumnos': return vistaAlumnos();
      case 'alumno': return Diario.vistaAlumno(param);
      case 'nombres': return Nombres.vistaNombres();
      case 'semana': return Agenda.vistaSemana(q);
      case 'mes': return Curso.vistaMes(q);
      case 'horarios': return Curso.vistaHorarios(q);
      case 'calendario': return Agenda.vistaCalendario();
      case 'ajustes': return await vistaAjustes();
      default: return Diario.vistaHoy();
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
    if (pantallaEditable) return; // en formularios no se repinta: se perdería lo escrito
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

Diario.configurar({ marco });
Calificar.configurar({ marco });
Cierre.configurar({ marco });
Nombres.configurar({ marco });
Agenda.configurar({ marco, pintar: () => pintar() });
Curso.configurar({ marco, pintar: () => pintar() });
pintar();
