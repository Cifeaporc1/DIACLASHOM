// Calendario del curso (mes) y horarios (el tuyo y los de cada grupo).
// El calendario escolar y los horarios de grupo vienen incluidos en datos/calendario-horarios-2026-2027.json
// (decisión de Luis: también con los nombres de los profesores). Si se importa otro archivo desde la app,
// se guarda cifrado y tiene prioridad sobre el incluido.
import * as D from './datos.js';
import * as Agenda from './agenda.js';
import { esc, hoyISO, aFecha, fechaLarga, minutos, hhmm, modulo, grupo, etiqueta, horaCorta } from './util.js';
import { bloquesDelDia } from './diario.js';

let marco = null;
let repintar = () => {};
export function configurar(opciones) {
  marco = opciones.marco;
  repintar = opciones.pintar || repintar;
}

// Datos incluidos con la app (se leen una vez y quedan en la caché de la app para usarla sin conexión).
const ARCHIVO_INCLUIDO = 'datos/calendario-horarios-2026-2027.json';
let incluido = null;
let pidiendo = null;
function cargarIncluido() {
  if (incluido || pidiendo) return;
  pidiendo = fetch(ARCHIVO_INCLUIDO)
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      if (j?.diaclashom !== 'importacion') return;
      incluido = j;
      const h = location.hash;
      if (h.startsWith('#/mes') || h.startsWith('#/horarios') || h === '' || h.startsWith('#/hoy')) repintar();
    })
    .catch(() => {})
    .finally(() => { pidiendo = null; });
}
const raiz = () => document.getElementById('app');
const $ = (sel) => raiz().querySelector(sel);

const NOMBRE_GRUPO = { G1: '1.º GASA', G2: '2.º GASA' };
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const FRANJA = 55;

function escolar() {
  const propio = D.uno('calEscolar');
  if (propio) return propio;
  cargarIncluido();
  return incluido?.calendarioEscolar ? { fuente: incluido.calendarioEscolar.fuente, eventos: incluido.calendarioEscolar.eventos } : null;
}
function horarioGrupo(g) {
  const propio = D.porTipo('horarioGrupo').find((h) => h.grupo === g);
  if (propio) return propio;
  cargarIncluido();
  return (incluido?.horariosGrupo || []).find((h) => h.grupo === g);
}

// ---------- Calendario escolar ----------

// Las fechas iguales para 1.º y 2.º se juntan en una sola línea.
function eventosEscolares(filtro) {
  const juntos = new Map();
  for (const e of escolar()?.eventos || []) {
    const k = `${e.fecha}|${e.hasta || ''}|${e.texto}|${e.clase}`;
    if (juntos.has(k)) juntos.get(k).grupos = [...new Set([...juntos.get(k).grupos, ...e.grupos])].sort();
    else juntos.set(k, { ...e, grupos: [...e.grupos] });
  }
  return [...juntos.values()]
    .filter((e) => !filtro || e.grupos.includes(filtro))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hasta || a.fecha).localeCompare(b.hasta || b.fecha));
}
const dentro = (e, iso) => iso >= e.fecha && iso <= (e.hasta || e.fecha);
function rangoTexto(e) {
  const f = (iso) => aFecha(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return e.hasta ? `${f(e.fecha)} – ${f(e.hasta)}` : f(e.fecha);
}
function etiquetaGrupos(e) {
  if (e.grupos.length > 1) return '<span class="cg cg-todos">1.º y 2.º</span>';
  return `<span class="cg cg-${e.grupos[0]}">${esc(NOMBRE_GRUPO[e.grupos[0]] || e.grupos[0])}</span>`;
}
function filaEscolar(e) {
  return `<div class="escolar-item">${etiquetaGrupos(e)}<span class="crece">${esc(e.texto)}${e.hasta ? `<span class="sub">${esc(rangoTexto(e))}</span>` : ''}</span></div>`;
}

// ---------- Mes ----------

const isoMes = (d) => hoyISO(d).slice(0, 7);

export function vistaMes(q) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const mes = /^\d{4}-\d{2}$/.test(q.m || '') ? q.m : isoMes(hoy);
  const [y, m] = mes.split('-').map(Number);
  const primero = new Date(y, m - 1, 1);
  const ultimo = new Date(y, m, 0);
  const sel = /^\d{4}-\d{2}-\d{2}$/.test(q.d || '') && q.d.startsWith(mes) ? q.d : (isoMes(hoy) === mes ? hoyISO(hoy) : hoyISO(primero));
  const filtro = ['G1', 'G2'].includes(q.g) ? q.g : '';
  const enlace = (extra) => `#/mes?${new URLSearchParams({ m: mes, d: sel, ...(filtro ? { g: filtro } : {}), ...extra })}`;

  // Rejilla de lunes a domingo
  const inicio = new Date(primero); inicio.setDate(1 - ((primero.getDay() + 6) % 7));
  const fin = new Date(ultimo); fin.setDate(ultimo.getDate() + (7 - ((ultimo.getDay() + 6) % 7)));
  const google = Agenda.eventosGoogle(inicio, fin, '#/mes');
  const est = Agenda.estadoGoogle();
  const esc1 = eventosEscolares(filtro);
  const fechas = esc1.filter((e) => e.clase !== 'periodo');

  const celdas = [];
  for (let d = new Date(inicio); d < fin; d.setDate(d.getDate() + 1)) {
    const iso = hoyISO(d);
    const sig = new Date(d); sig.setDate(d.getDate() + 1);
    const deDia = fechas.filter((e) => dentro(e, iso));
    const gDia = (google || []).filter((e) => e.inicio < sig && e.fin > d);
    const puntos = [
      ...new Set(deDia.map((e) => (e.grupos.length > 1 ? 'todos' : e.grupos[0]))),
    ].map((g) => `<i class="p p-${g}"></i>`).join('') + (gDia.length ? '<i class="p p-google"></i>' : '');
    const clases = [
      iso.startsWith(mes) ? '' : 'fuera',
      iso === hoyISO(hoy) ? 'hoy' : '',
      iso === sel ? 'sel' : '',
      [0, 6].includes(d.getDay()) ? 'finde' : '',
    ].filter(Boolean).join(' ');
    celdas.push(`<a class="dia ${clases}" href="${enlace({ m: iso.slice(0, 7), d: iso })}" aria-label="${esc(fechaLarga(iso))}"><span>${d.getDate()}</span><span class="puntos">${puntos}</span></a>`);
  }

  // Detalle del día elegido
  const dSel = aFecha(sel);
  const dSig = new Date(dSel); dSig.setDate(dSel.getDate() + 1);
  const periodos = esc1.filter((e) => e.clase === 'periodo' && dentro(e, sel));
  const delDia = fechas.filter((e) => dentro(e, sel));
  const gSel = (google || []).filter((e) => e.inicio < dSig && e.fin > dSel);
  const misClases = [0, 6].includes(dSel.getDay()) ? [] : bloquesDelDia(dSel.getDay());
  const delMes = fechas.filter((e) => e.fecha.startsWith(mes) || (e.hasta && e.fecha < `${mes}-01` && e.hasta >= `${mes}-01`));

  const nombreMes = primero.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const mesAnt = isoMes(new Date(y, m - 2, 1));
  const mesSig = isoMes(new Date(y, m, 1));

  marco('Calendario', `
    ${pestanas('mes')}
    ${!escolar() ? '<p class="vacio">Cargando el calendario escolar…</p>' : ''}
    <div class="nav-semana">
      <a class="boton pequeno secundario" href="#/mes?${new URLSearchParams({ m: mesAnt, ...(filtro ? { g: filtro } : {}) })}">‹</a>
      <strong class="mes-titulo">${esc(nombreMes)}</strong>
      <a class="boton pequeno secundario" href="#/mes?${new URLSearchParams({ m: mesSig, ...(filtro ? { g: filtro } : {}) })}">›</a>
    </div>
    <div class="filtro-grupos" role="group" aria-label="Qué fechas del calendario escolar ver">
      ${[['', 'Todo'], ['G1', '1.º GASA'], ['G2', '2.º GASA']].map(([g, t]) => `<a class="chip-filtro ${filtro === g ? 'activo' : ''}" href="#/mes?${new URLSearchParams({ m: mes, d: sel, ...(g ? { g } : {}) })}">${t}</a>`).join('')}
      ${isoMes(hoy) !== mes ? `<a class="chip-filtro" href="#/mes${filtro ? `?g=${filtro}` : ''}">Hoy</a>` : ''}
    </div>
    <div class="tarjeta mes">
      <div class="mes-cab">${DIAS_CORTOS.map((d) => `<span>${d}</span>`).join('')}</div>
      <div class="mes-rejilla">${celdas.join('')}</div>
      <div class="leyenda"><span><i class="p p-G1"></i>1.º</span><span><i class="p p-G2"></i>2.º</span><span><i class="p p-todos"></i>Ambos</span>${est.conectado ? '<span><i class="p p-google"></i>Google</span>' : ''}</div>
    </div>
    ${est.error ? `<p class="mensaje aviso">${esc(est.error)}</p>` : ''}

    <h2 class="${sel === hoyISO(hoy) ? 'dia-hoy' : ''}">${esc(fechaLarga(sel))}</h2>
    <div class="tarjeta">
      ${periodos.length ? `<div class="periodos">${periodos.map((e) => `<span>${esc(NOMBRE_GRUPO[e.grupos[0]] && e.grupos.length === 1 ? NOMBRE_GRUPO[e.grupos[0]] : '1.º y 2.º')} · ${esc(e.texto)} <small>(${esc(rangoTexto(e))})</small></span>`).join('')}</div>` : ''}
      ${delDia.map(filaEscolar).join('')}
      ${gSel.map((e) => Agenda.tarjetaEvento(e, (google || []).indexOf(e))).join('')}
      ${misClases.length ? `<div class="mis-clases">${misClases.map((b) => `<div class="clase-semana"><span class="hora">${hhmm(b.inicio)}–${hhmm(b.fin)}</span><span>${b.modulo ? `${esc(etiqueta(b.modulo))} <span class="sub" style="display:inline">· ${esc(grupo(modulo(b.modulo)?.grupo)?.nombre || '')}</span>` : esc(b.texto)}</span></div>`).join('')}</div>` : ''}
      ${!delDia.length && !gSel.length && !misClases.length ? `<p class="vacio">${est.conectado && !est.leido && !est.error ? 'Cargando el calendario…' : 'Nada este día.'}</p>` : ''}
    </div>

    ${delMes.length ? `<h2>Fechas de ${esc(primero.toLocaleDateString('es-ES', { month: 'long' }))}</h2>
    <div class="tarjeta lista-fechas">${delMes.map((e) => `<a href="${enlace({ d: e.fecha < `${mes}-01` ? `${mes}-01` : e.fecha })}" class="escolar-item"><span class="fecha-peq">${esc(rangoTexto(e))}</span>${etiquetaGrupos(e)}<span class="crece">${esc(e.texto)}</span></a>`).join('')}</div>` : ''}
    ${escolar()?.fuente ? `<p class="ayuda">${esc(escolar().fuente)}. Los festivos y vacaciones no venían en ese documento.</p>` : ''}
  `, { volver: '#/ajustes', pestana: 'ajustes' });
  Agenda.enlazarEventos(google || []);
}

function pestanas(activa) {
  return `<div class="segmentos">
    <a href="#/mes" class="${activa === 'mes' ? 'activo' : ''}">Mes</a>
    <a href="#/horarios" class="${activa === 'horarios' ? 'activo' : ''}">Horarios</a>
  </div>`;
}

// ---------- Horarios ----------

const COLORES_MIOS = { 1274: '#8eb4f4', 1276: '#ffc000', 1279: '#92d050' };

function franjasMias() {
  return (D.uno('horario')?.franjas || []).map((f) => {
    if (f.modulo) {
      const m = modulo(f.modulo);
      return { dia: f.dia, inicio: f.inicio, texto: etiqueta(f.modulo), corto: etiqueta(f.modulo), profe: grupo(m?.grupo)?.nombre || '', color: COLORES_MIOS[f.modulo] || '#d9d5c8' };
    }
    return { dia: f.dia, inicio: f.inicio, texto: f.texto, corto: f.texto.charAt(0) + f.texto.slice(1).toLowerCase(), profe: '', color: '#ffff3b' };
  });
}

function tablaHorario(franjas) {
  const horas = [...new Set(franjas.map((f) => f.inicio))].sort((a, b) => minutos(a) - minutos(b));
  if (!horas.length) return '<p class="vacio">Sin horario.</p>';
  const ahora = new Date();
  const diaHoy = ahora.getDay();
  const minAhora = ahora.getHours() * 60 + ahora.getMinutes();
  const celda = (d, h) => franjas.find((f) => f.dia === d && f.inicio === h);
  const igual = (a, b) => a && b && a.texto === b.texto && a.profe === b.profe;
  // Se unen las horas seguidas de lo mismo (sin el recreo por medio)
  const seguidas = (h1, h2) => minutos(h2) - minutos(h1) === FRANJA;
  const ocupado = new Set();
  let filas = '';
  horas.forEach((h, i) => {
    if (i > 0 && !seguidas(horas[i - 1], h)) {
      filas += `<tr class="recreo"><th>${esc(horaCorta(hhmm(minutos(horas[i - 1]) + FRANJA)))}</th><td colspan="5">Recreo</td></tr>`;
    }
    let tds = '';
    for (let d = 1; d <= 5; d++) {
      if (ocupado.has(`${d}|${h}`)) continue;
      const c = celda(d, h);
      let span = 1;
      while (i + span < horas.length && seguidas(horas[i + span - 1], horas[i + span]) && igual(c, celda(d, horas[i + span]))) {
        ocupado.add(`${d}|${horas[i + span]}`); span++;
      }
      const ini = minutos(h);
      const ya = d === diaHoy && minAhora >= ini && minAhora < ini + span * FRANJA;
      tds += c
        ? `<td rowspan="${span}" class="${ya ? 'ahora' : ''}" style="--fondo-celda:${esc(c.color || '#e7e5de')}"><span class="largo">${esc(c.texto)}</span><span class="corto">${esc(c.corto || c.texto)}</span>${c.profe ? `<small>${esc(c.profe)}</small>` : ''}</td>`
        : `<td rowspan="${span}" class="libre ${ya ? 'ahora' : ''}"></td>`;
    }
    filas += `<tr><th>${esc(h)}</th>${tds}</tr>`;
  });
  return `<div class="horario-envoltura"><table class="horario">
    <thead><tr><th></th>${DIAS.map((n, i) => `<th class="${i + 1 === diaHoy ? 'hoy' : ''}"><span class="largo">${n}</span><span class="corto">${n.slice(0, 3)}</span></th>`).join('')}</tr></thead>
    <tbody>${filas}</tbody></table></div>`;
}

export function vistaHorarios(q, mensaje) {
  const v = ['mio', 'G1', 'G2', 'importar'].includes(q.v) ? q.v : 'mio';
  const propios = D.porTipo('horarioGrupo').length > 0 || !!D.uno('calEscolar');
  const ver = v === 'mio' ? franjasMias() : (horarioGrupo(v)?.franjas || []);
  marco('Calendario', `
    ${pestanas('horarios')}
    ${mensaje ? `<div class="mensaje ${mensaje.tipo}">${esc(mensaje.texto)}</div>` : ''}
    <div class="filtro-grupos">
      ${[['mio', 'Mío'], ['G1', '1.º GASA'], ['G2', '2.º GASA']].map(([k, t]) => `<a class="chip-filtro ${v === k ? 'activo' : ''}" href="#/horarios?v=${k}">${t}</a>`).join('')}
    </div>
    ${v === 'importar' ? '' : (v !== 'mio' && !horarioGrupo(v)
      ? '<p class="vacio">Cargando el horario…</p>'
      : `<div class="tarjeta horario-tarjeta">${tablaHorario(ver)}</div>`)}
    <details class="tarjeta importar">
      <summary>Cambiar calendario u horarios</summary>
      <form class="formulario" id="f-importar">
        <p class="ayuda" style="margin:0">${propios
          ? 'Estás usando un archivo importado por ti. Si importas otro, sustituye a este.'
          : 'Ahora ves los que vienen con la app. Si cambian los horarios o el calendario, pásame los nuevos y te preparo un archivo para cargarlo aquí.'}</p>
        <label class="campo"><span>Archivo .json</span><input type="file" name="archivo" accept=".json,application/json" required></label>
        <div class="botones"><button class="boton secundario" type="submit">Importar</button></div>
      </form>
    </details>
  `, { volver: '#/ajustes', pestana: 'ajustes' });

  $('#f-importar').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const boton = ev.target.querySelector('button');
    boton.disabled = true;
    try {
      const archivo = ev.target.archivo.files[0];
      const datos = JSON.parse(await archivo.text());
      const r = await importar(datos);
      vistaHorarios({ v: v === 'importar' ? 'G1' : v }, { tipo: 'info', texto: `Importado: ${r.fechas} fechas del calendario escolar y ${r.horarios} horarios de grupo.` });
    } catch (e) {
      vistaHorarios({ v }, { tipo: 'error', texto: e.message });
    }
  });
}

export async function importar(datos) {
  if (datos?.diaclashom !== 'importacion') throw new Error('Este archivo no es de DIACLASHOM.');
  const nuevos = [];
  const viejos = [];
  if (datos.calendarioEscolar) {
    const ev = datos.calendarioEscolar.eventos;
    if (!Array.isArray(ev) || ev.some((e) => !/^\d{4}-\d{2}-\d{2}$/.test(e.fecha) || !e.texto || !Array.isArray(e.grupos))) throw new Error('El calendario escolar del archivo no es válido.');
    viejos.push(...D.porTipo('calEscolar'));
    nuevos.push({ tipo: 'calEscolar', curso: datos.curso, fuente: datos.calendarioEscolar.fuente || '', eventos: ev });
  }
  for (const h of datos.horariosGrupo || []) {
    if (!h.grupo || !Array.isArray(h.franjas)) throw new Error('Un horario de grupo del archivo no es válido.');
    viejos.push(...D.porTipo('horarioGrupo').filter((x) => x.grupo === h.grupo));
    nuevos.push({ tipo: 'horarioGrupo', curso: datos.curso, grupo: h.grupo, nombre: h.nombre || '', franjas: h.franjas });
  }
  if (!nuevos.length) throw new Error('El archivo no trae ni calendario ni horarios.');
  for (const x of viejos) await D.borrar(x.id);
  await D.guardar(nuevos);
  return { fechas: nuevos.find((n) => n.tipo === 'calEscolar')?.eventos.length || 0, horarios: nuevos.filter((n) => n.tipo === 'horarioGrupo').length };
}

// Línea para la pantalla Hoy: fechas del calendario escolar de hoy.
export function avisoHoy() {
  const iso = hoyISO();
  const hoy = eventosEscolares('').filter((e) => e.clase !== 'periodo' && dentro(e, iso));
  if (!hoy.length) return '';
  return `<h2>Calendario escolar · hoy</h2><a class="tarjeta" href="#/mes">${hoy.map(filaEscolar).join('')}</a>`;
}
