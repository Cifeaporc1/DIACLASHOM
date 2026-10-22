// Agenda: eventos de un calendario de Google (solo lectura) junto al horario de clases.
// La dirección secreta iCal se guarda cifrada como un registro más («calendario»).
import * as D from './datos.js';
import * as Nube from './nube.js';
import { leerICS, eventosEntre } from './ical.js';
import { esc, hoyISO, fechaLarga, fechaCorta, hhmm, modulo, grupo, etiqueta, ir, primeraLinea } from './util.js';
import { bloquesDelDia } from './diario.js';

let marco = null;
let repintar = () => {};
export function configurar(opciones) {
  marco = opciones.marco;
  repintar = opciones.pintar || repintar;
}
const raiz = () => document.getElementById('app');
const $ = (sel) => raiz().querySelector(sel);
const $$ = (sel) => [...raiz().querySelectorAll(sel)];

const cache = { eventos: null, cargado: 0, error: null, cargando: null, url: null };
export const configCalendario = () => D.uno('calendario');

export async function cargarEventos(forzar = false) {
  const conf = configCalendario();
  if (!conf?.url) return null;
  if (cache.url !== conf.url) { cache.eventos = null; cache.cargado = 0; cache.url = conf.url; }
  if (!forzar && cache.eventos && Date.now() - cache.cargado < 10 * 60 * 1000) return cache.eventos;
  if (!navigator.onLine) { cache.error = 'Sin conexión: no se puede leer el calendario.'; return cache.eventos; }
  if (!cache.cargando) {
    cache.cargando = Nube.leerCalendario(conf.url)
      .then((ics) => { cache.eventos = leerICS(ics); cache.cargado = Date.now(); cache.error = null; })
      .catch((e) => { cache.error = e.message; })
      .finally(() => { cache.cargando = null; });
  }
  await cache.cargando;
  return cache.eventos;
}

// Carga en segundo plano y repinta la pantalla actual cuando llegan los eventos.
function cargarYRepintar(ruta) {
  if (!configCalendario()?.url || cache.cargando) return;
  if (cache.eventos && Date.now() - cache.cargado < 10 * 60 * 1000) return;
  cargarEventos().then(() => { if (location.hash.startsWith(ruta)) repintar(); });
}

const horaTexto = (d) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
const claveEvento = (e) => `${e.uid}|${e.inicio.getTime()}`;

function creadoDesde(e) {
  const k = claveEvento(e);
  return D.porTipo('reunion').find((x) => x.origenCalendario === k) || D.porTipo('sesion').find((x) => x.origenCalendario === k);
}

export function tarjetaEvento(e, i) {
  const ya = creadoDesde(e);
  return `<details class="evento">
    <summary>
      <span class="hora">${e.todoElDia ? 'Todo el día' : `${horaTexto(e.inicio)}–${horaTexto(e.fin)}`}</span>
      <span class="crece"><strong>${esc(e.titulo)}</strong>${e.lugar ? `<span class="sub">${esc(e.lugar)}</span>` : ''}</span>
      ${ya ? '<span class="chip">En la app</span>' : ''}
    </summary>
    ${e.descripcion ? `<p class="extracto">${esc(primeraLinea(e.descripcion, 200))}</p>` : ''}
    <div class="botones dos">
      ${ya
        ? `<a class="boton pequeno secundario" href="#/${ya.tipo === 'reunion' ? 'reunion' : 'sesion'}/${esc(ya.id)}">Abrir en la app</a>`
        : `<button class="boton pequeno" type="button" data-crear="reunion" data-ev="${i}">Crear reunión</button>
           <button class="boton pequeno secundario" type="button" data-crear="salida" data-ev="${i}">Crear salida o sesión</button>`}
    </div>
  </details>`;
}

const TIPOS_REUNION = [['claustro', 'Claustro'], ['departamento', 'Departamento'], ['evaluaci', 'Sesión de evaluación'], ['equipo docente', 'Equipo docente'], ['ccp', 'CCP']];

async function crearDesde(e, tipo) {
  const fecha = hoyISO(e.inicio);
  const texto = [e.titulo, e.descripcion].filter(Boolean).join('\n');
  if (tipo === 'reunion') {
    const t = e.titulo.toLowerCase();
    const clase = (TIPOS_REUNION.find(([k]) => t.includes(k)) || [null, 'Otra'])[1];
    const [r] = await D.guardar({ tipo: 'reunion', fecha, clase, asistentes: '', temas: texto, acuerdos: '', tareas: [], origenCalendario: claveEvento(e) });
    ir(`#/reunion/${r.id}`);
  } else {
    const [s] = await D.guardar({
      tipo: 'sesion', fecha, inicio: e.todoElDia ? '' : hhmm(e.inicio.getHours() * 60 + e.inicio.getMinutes()), fin: e.todoElDia ? '' : hhmm(e.fin.getHours() * 60 + e.fin.getMinutes()),
      grupo: '', modulos: [], clase: 'salida', lugar: e.lugar || e.titulo, ut: '', ces: [], diario: texto, valoracion: 0, comoFue: '', cambios: '', marcas: {}, origenCalendario: claveEvento(e),
    });
    ir(`#/sesion/${s.id}`);
  }
}

export function enlazarEventos(lista) {
  $$('[data-crear]').forEach((b) => b.addEventListener('click', () => { b.disabled = true; crearDesde(lista[Number(b.dataset.ev)], b.dataset.crear); }));
}

// Eventos de Google entre dos fechas para otras pantallas (null si aún no se han leído).
export function eventosGoogle(desde, hasta, ruta) {
  if (configCalendario()?.url) cargarYRepintar(ruta);
  return cache.eventos ? eventosEntre(cache.eventos, desde, hasta) : null;
}
export const estadoGoogle = () => ({ conectado: !!configCalendario()?.url, error: cache.error, leido: !!cache.eventos });

// Bloque para la pantalla Hoy.
export function bloqueHoy() {
  const conf = configCalendario();
  if (!conf?.url) return { html: '<a class="tarjeta" href="#/calendario"><div class="titulo">Conectar Google Calendar</div><div class="sub">Para ver aquí tus eventos de la semana</div></a>', enlazar: () => {} };
  cargarYRepintar('#/hoy');
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const manana = new Date(hoy); manana.setDate(hoy.getDate() + 1);
  const lista = cache.eventos ? eventosEntre(cache.eventos, hoy, manana) : [];
  const html = `<h2>Calendario · hoy</h2><div class="tarjeta">
    ${cache.error ? `<p class="mensaje aviso">${esc(cache.error)}</p>` : ''}
    ${!cache.eventos && !cache.error ? '<p class="vacio">Cargando…</p>' : (lista.length ? lista.map(tarjetaEvento).join('') : '<p class="vacio">Sin eventos hoy.</p>')}
    <a class="boton secundario" href="#/semana">Ver la semana</a>
  </div>`;
  return { html, enlazar: () => enlazarEventos(lista) };
}

// ---------- Semana ----------

export function vistaSemana(q) {
  const desplaz = Number(q.s || 0);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const lunes = new Date(hoy); lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7) + desplaz * 7);
  const domingoFin = new Date(lunes); domingoFin.setDate(lunes.getDate() + 7);
  const conf = configCalendario();
  if (conf?.url) cargarYRepintar('#/semana');
  const eventos = cache.eventos ? eventosEntre(cache.eventos, lunes, domingoFin) : [];
  const dias = Array.from({ length: 7 }, (_, i) => { const d = new Date(lunes); d.setDate(lunes.getDate() + i); return d; });
  const titulo = `${fechaCorta(hoyISO(dias[0]))} – ${fechaCorta(hoyISO(dias[6]))}`;

  marco('Semana', `
    <div class="nav-semana">
      <a class="boton pequeno secundario" href="#/semana?s=${desplaz - 1}">‹ Anterior</a>
      <strong>${esc(titulo)}</strong>
      <a class="boton pequeno secundario" href="#/semana?s=${desplaz + 1}">Siguiente ›</a>
    </div>
    ${desplaz ? '<p style="text-align:center;margin:0 0 12px"><a href="#/semana">Volver a esta semana</a></p>' : ''}
    ${!conf?.url ? '<a class="tarjeta" href="#/calendario"><div class="titulo">Conectar Google Calendar</div><div class="sub">Ahora solo ves tus clases</div></a>' : ''}
    ${cache.error ? `<p class="mensaje aviso">${esc(cache.error)}</p>` : ''}
    ${conf?.url && !cache.eventos && !cache.error ? '<p class="vacio">Cargando el calendario…</p>' : ''}
    ${dias.map((d) => {
      const iso = hoyISO(d);
      const deHoy = eventos.filter((e) => e.inicio < new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) && e.fin > d);
      const clases = bloquesDelDia(d.getDay()).filter((b) => b.modulo);
      if (!deHoy.length && !clases.length && [0, 6].includes(d.getDay())) return '';
      return `<h2 class="${iso === hoyISO(hoy) ? 'dia-hoy' : ''}">${esc(fechaLarga(iso))}</h2>
        <div class="tarjeta">
          ${clases.map((b) => { const m = modulo(b.modulo); return `<div class="clase-semana"><span class="hora">${hhmm(b.inicio)}–${hhmm(b.fin)}</span><span>${esc(etiqueta(m.codigo))} <span class="sub" style="display:inline">· ${esc(grupo(m.grupo)?.nombre || '')}</span></span></div>`; }).join('')}
          ${deHoy.map((e) => tarjetaEvento(e, eventos.indexOf(e))).join('')}
          ${!clases.length && !deHoy.length ? '<p class="vacio">Nada.</p>' : ''}
        </div>`;
    }).join('')}
    ${conf?.url ? '<div class="botones"><button class="boton secundario" type="button" id="b-recargar">Volver a leer el calendario</button></div>' : ''}
  `, { volver: '#/hoy', pestana: 'hoy' });
  enlazarEventos(eventos);
  $('#b-recargar')?.addEventListener('click', async () => { await cargarEventos(true); repintar(); });
}

// ---------- Configuración ----------

export function vistaCalendario(mensaje) {
  const conf = configCalendario();
  marco('Google Calendar', `
    ${mensaje ? `<div class="mensaje ${mensaje.tipo}">${esc(mensaje.texto)}</div>` : ''}
    <div class="tarjeta">
      <p class="ayuda" style="margin:0">La app muestra los eventos de uno de tus calendarios, solo para leerlos: no crea ni cambia nada en Google. La dirección se guarda cifrada.</p>
    </div>
    <h2>Cómo conseguir la dirección (en el PC)</h2>
    <ol class="tarjeta pasos">
      <li>Abre Google Calendar en el navegador.</li>
      <li>En la lista «Mis calendarios», pasa el ratón por el calendario, pulsa los tres puntos y luego «Configuración y uso compartido».</li>
      <li>Baja hasta «Integrar el calendario» y copia la «Dirección secreta en formato iCal». Empieza por https://calendar.google.com/calendar/ical/ y termina en basic.ics.</li>
      <li>Pégala aquí abajo.</li>
    </ol>
    <form id="f-cal" class="formulario tarjeta">
      <label class="campo"><span>Dirección secreta en formato iCal</span><input type="url" name="url" value="${esc(conf?.url || '')}" required placeholder="https://calendar.google.com/calendar/ical/…/basic.ics" autocomplete="off"></label>
      <div class="botones"><button class="boton" type="submit">Guardar y probar</button>
      ${conf ? '<button class="boton peligro" type="button" id="b-quitar">Desconectar calendario</button>' : ''}</div>
    </form>
    <p class="ayuda">Esa dirección da acceso de lectura a todo el calendario. No la compartas. Si alguna vez crees que se ha filtrado, en Google Calendar puedes «Restablecerla» y pegar aquí la nueva.</p>
  `, { volver: '#/ajustes', pestana: 'ajustes', editable: true });
  $('#f-cal').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const url = new FormData(ev.target).get('url').trim();
    if (!/^https:\/\/calendar\.google\.com\/calendar\/ical\/.+\.ics$/.test(url)) {
      vistaCalendario({ tipo: 'error', texto: 'No parece una dirección iCal de Google Calendar. Debe empezar por https://calendar.google.com/calendar/ical/ y terminar en .ics.' });
      return;
    }
    const b = ev.target.querySelector('button[type=submit]');
    b.disabled = true; b.textContent = 'Probando…';
    const c = configCalendario() || { tipo: 'calendario' };
    c.url = url;
    await D.guardar(c);
    cache.url = null;
    await cargarEventos(true);
    if (cache.error) vistaCalendario({ tipo: 'error', texto: `Guardada, pero no se ha podido leer: ${cache.error}` });
    else vistaCalendario({ tipo: 'info', texto: `Conectado: ${cache.eventos.length} eventos leídos. Los verás en Hoy y en la Semana.` });
  });
  $('#b-quitar')?.addEventListener('click', async () => {
    if (!confirm('¿Desconectar el calendario? No se borra nada en Google.')) return;
    await D.borrar(conf.id);
    cache.eventos = null; cache.url = null;
    vistaCalendario({ tipo: 'info', texto: 'Calendario desconectado.' });
  });
}
