// Fase 2: diario de sesiones, salidas, anotaciones, charlas y reuniones.
import * as D from './datos.js';
import * as Calificar from './calificar.js';
import * as Agenda from './agenda.js';
import {
  esc, hoyISO, aFecha, fechaLarga, fechaCorta, minutos, hhmm, horaInput, horaCorta,
  modulo, grupo, grupos, modulos, modulosDeGrupo, alumnosDe, alumno, utsDe, listas,
  ir, primeraLinea, diferido, etiqueta, etiquetas, nombre, nombreHTML, nombreCortoHTML,
} from './util.js';

let marco = null;
export function configurar(opciones) {
  marco = opciones.marco;
}

const raiz = () => document.getElementById('app');
const $ = (sel) => raiz().querySelector(sel);
const $$ = (sel) => [...raiz().querySelectorAll(sel)];

export const TIPOS_SESION = [
  ['teoria', 'Teoría'],
  ['practica', 'Práctica'],
  ['salida', 'Salida o visita'],
  ['prueba', 'Prueba'],
  ['otra', 'Otra'],
];
const nombreTipo = (t) => (TIPOS_SESION.find((x) => x[0] === t) || ['', 'Sesión'])[1];

export const MARCAS = [
  ['destaca', 'Destaca', '+'],
  ['mal', 'Comportamiento', '−'],
  ['ausente', 'No estaba', '∅'],
];
const TIPOS_REUNION = ['Departamento', 'Claustro', 'Equipo docente', 'Sesión de evaluación', 'CCP', 'Otra'];
const VALORACIONES = ['', 'Mal', 'Regular', 'Bien', 'Muy bien', 'Excelente'];

const DURACION_FRANJA = 55;

// ---------- Horario ----------

export function bloquesDelDia(dia) {
  const horario = D.uno('horario');
  if (!horario) return [];
  const franjas = horario.franjas.filter((f) => f.dia === dia).sort((a, b) => minutos(a.inicio) - minutos(b.inicio));
  const bloques = [];
  for (const f of franjas) {
    const ini = minutos(f.inicio);
    const ultimo = bloques[bloques.length - 1];
    if (ultimo && ultimo.clave === (f.modulo || f.texto) && ultimo.fin === ini) ultimo.fin = ini + DURACION_FRANJA;
    else bloques.push({ clave: f.modulo || f.texto, modulo: f.modulo, texto: f.texto, inicio: ini, fin: ini + DURACION_FRANJA });
  }
  return bloques;
}

function sesiones() {
  return D.porTipo('sesion').sort((a, b) => (b.fecha + horaInput(b.inicio)).localeCompare(a.fecha + horaInput(a.inicio)));
}

function sesionDelBloque(fecha, b) {
  return D.porTipo('sesion').find((s) => s.fecha === fecha && s.modulos?.includes(b.modulo) && horaCorta(s.inicio) === hhmm(b.inicio));
}

async function nuevaSesion(datos) {
  const [s] = await D.guardar({
    tipo: 'sesion', fecha: hoyISO(), inicio: '', fin: '', grupo: '', modulos: [], clase: 'teoria',
    lugar: '', ut: '', ces: [], diario: '', valoracion: 0, comoFue: '', cambios: '', marcas: {},
    ...datos,
  });
  return s;
}

function tareasPendientes() {
  const lista = [];
  for (const r of D.porTipo('reunion')) for (const t of r.tareas || []) if (!t.hecha) lista.push({ reunion: r, tarea: t });
  return lista.sort((a, b) => (a.tarea.limite || '9999').localeCompare(b.tarea.limite || '9999'));
}

function pintarTareas(lista, conReunion = true) {
  if (!lista.length) return '<p class="vacio">No tienes tareas pendientes.</p>';
  const hoy = hoyISO();
  return `<ul class="lista">${lista.map(({ reunion, tarea }) => `
    <li><label class="item tarea">
      <input type="checkbox" data-tarea="${esc(tarea.id)}" data-reunion="${esc(reunion.id)}" ${tarea.hecha ? 'checked' : ''}>
      <span class="crece">${esc(tarea.texto)}
        ${conReunion ? `<span class="sub">${esc(reunion.clase || 'Reunión')} · ${esc(fechaCorta(reunion.fecha))}</span>` : ''}
      </span>
      ${tarea.limite ? `<span class="chip ${tarea.limite < hoy ? 'alerta' : 'neutro'}">${esc(fechaCorta(tarea.limite))}</span>` : ''}
    </label></li>`).join('')}</ul>`;
}

function enlazarTareas() {
  $$('[data-tarea]').forEach((c) => c.addEventListener('change', async () => {
    const r = D.obtener(c.dataset.reunion);
    const t = r?.tareas?.find((x) => x.id === c.dataset.tarea);
    if (!t) return;
    t.hecha = c.checked;
    await D.guardar(r);
    // En las listas de pendientes, la tarea hecha desaparece.
    if (t.hecha) {
      const li = c.closest('li');
      li.classList.add('hecha');
      setTimeout(() => li.remove(), 400);
    }
  }));
}

// ---------- Hoy ----------

function pintarBloques(fecha, bloques, conBotones) {
  if (!bloques.length) return '<p class="vacio">Sin clases.</p>';
  return bloques.map((b, i) => {
    const m = b.modulo ? modulo(b.modulo) : null;
    if (!m) {
      return `<div class="franja otro"><div class="hora">${hhmm(b.inicio)}–${hhmm(b.fin)}</div><div class="materia">${esc(b.texto.charAt(0) + b.texto.slice(1).toLowerCase())}</div></div>`;
    }
    const s = sesionDelBloque(fecha, b);
    return `<div class="franja">
      <div class="hora">${hhmm(b.inicio)}–${hhmm(b.fin)}</div>
      <div class="materia">
        <strong>${esc(etiqueta(m.codigo))}</strong> ${esc(m.nombre)}
        <div class="sub">${esc(grupo(m.grupo)?.nombre || '')}${s ? ` · ${esc(nombreTipo(s.clase))}${s.ut ? ' · ' + esc(s.ut) : ''}` : ''}</div>
        ${conBotones ? (s
          ? `<a class="boton pequeno secundario" href="#/sesion/${esc(s.id)}">Abrir sesión</a>`
          : `<button class="boton pequeno" type="button" data-empezar="${i}">Empezar sesión</button>`) : ''}
      </div>
    </div>`;
  }).join('');
}

export function vistaHoy() {
  const hoy = new Date();
  const fecha = hoyISO(hoy);
  const bloques = bloquesDelDia(hoy.getDay());
  const siguiente = new Date(hoy);
  do { siguiente.setDate(siguiente.getDate() + 1); } while ([0, 6].includes(siguiente.getDay()));
  const tareas = tareasPendientes();
  const recientes = sesiones().filter((s) => s.fecha < fecha).slice(0, 3);
  const agenda = Agenda.bloqueHoy();
  marco('Hoy', `
    <h2>${esc(fechaLarga(fecha))}</h2>
    <div class="tarjeta">${pintarBloques(fecha, bloques, true)}</div>
    <div class="botones dos">
      <button class="boton secundario" type="button" id="b-otra-sesion">Sesión fuera de horario</button>
      <a class="boton secundario" href="#/anotar?volver=hoy">Anotación rápida</a>
    </div>
    ${agenda.html}
    <h2>Tareas pendientes${tareas.length ? ` · ${tareas.length}` : ''}</h2>
    <div class="tarjeta">${pintarTareas(tareas)}<a class="boton secundario" href="#/reuniones">Reuniones</a></div>
    <h2>Próximo día de clase · ${esc(fechaLarga(hoyISO(siguiente)))}</h2>
    <div class="tarjeta">${pintarBloques(hoyISO(siguiente), bloquesDelDia(siguiente.getDay()), false)}</div>
    ${recientes.length ? `<h2>Últimas sesiones</h2>${recientes.map(tarjetaSesion).join('')}` : ''}
  `, { pestana: 'hoy' });
  $$('[data-empezar]').forEach((boton) => boton.addEventListener('click', async () => {
    boton.disabled = true;
    const b = bloques[Number(boton.dataset.empezar)];
    const m = modulo(b.modulo);
    const s = await nuevaSesion({ fecha, inicio: hhmm(b.inicio), fin: hhmm(b.fin), grupo: m.grupo, modulos: [m.codigo] });
    ir(`#/sesion/${s.id}`);
  }));
  $('#b-otra-sesion').addEventListener('click', async () => {
    const s = await nuevaSesion({});
    ir(`#/sesion/${s.id}`);
  });
  enlazarTareas();
  agenda.enlazar();
}

// ---------- Diario: lista de sesiones ----------

let filtroDiario = 'todas';

function tarjetaSesion(s) {
  const marcas = Object.values(s.marcas || {});
  const cuenta = (k) => marcas.filter((x) => x === k).length;
  const resumenMarcas = MARCAS.map(([k, , simbolo]) => (cuenta(k) ? `${simbolo}${cuenta(k)}` : '')).filter(Boolean).join(' ');
  return `<a class="tarjeta" href="#/sesion/${esc(s.id)}">
    <div class="fila">
      <span class="titulo crece">${esc(fechaCorta(s.fecha))}${s.inicio ? ` · ${esc(horaCorta(s.inicio))}` : ''} · ${esc(etiquetas(s.modulos) || 'Sin módulo')}</span>
      <span class="chip ${s.clase === 'salida' ? '' : 'neutro'}">${esc(nombreTipo(s.clase))}</span>
    </div>
    <div class="sub">${[s.ut, s.lugar, s.ces?.length ? `${s.ces.length} CE` : '', s.valoracion ? VALORACIONES[s.valoracion] : '', resumenMarcas].filter(Boolean).map(esc).join(' · ')}</div>
    ${s.diario ? `<div class="extracto">${esc(primeraLinea(s.diario))}</div>` : ''}
  </a>`;
}

export function vistaDiario() {
  const filtros = [['todas', 'Todas'], ...modulos().map((m) => [m.codigo, etiqueta(m.codigo)]), ['salida', 'Salidas']];
  const lista = sesiones().filter((s) => filtroDiario === 'todas' || (filtroDiario === 'salida' ? s.clase === 'salida' : s.modulos?.includes(filtroDiario)));
  marco('Diario', `
    <div class="segmento desplazable">${filtros.map(([k, t]) => `<button type="button" data-filtro="${esc(k)}" class="${k === filtroDiario ? 'activo' : ''}">${esc(t)}</button>`).join('')}</div>
    <div class="botones dos" style="margin-bottom:16px">
      <button class="boton" type="button" id="b-nueva">Nueva sesión</button>
      <a class="boton secundario" href="#/anotar?volver=diario">Anotación</a>
    </div>
    ${lista.length ? lista.map(tarjetaSesion).join('') : '<p class="vacio">Todavía no hay sesiones. Empieza una desde Hoy o con «Nueva sesión».</p>'}
  `, { pestana: 'diario' });
  $$('[data-filtro]').forEach((b) => b.addEventListener('click', () => { filtroDiario = b.dataset.filtro; vistaDiario(); }));
  $('#b-nueva').addEventListener('click', async () => {
    const s = await nuevaSesion({});
    ir(`#/sesion/${s.id}`);
  });
}

// ---------- Sesión ----------

export function vistaSesion(id) {
  const s = D.obtener(id);
  if (!s || s.tipo !== 'sesion') return marco('Sesión', '<p class="vacio">No encontrada.</p>', { volver: '#/diario', pestana: 'diario' });
  s.marcas = s.marcas || {};
  s.ces = s.ces || [];
  const anotaciones = D.porTipo('anotacion').filter((a) => a.sesion === s.id).sort((a, b) => (a.creado || '').localeCompare(b.creado || ''));
  const califSesion = [
    ...D.porTipo('practica').filter((x) => x.sesion === s.id).map((x) => ({ href: `#/practica/${x.id}`, texto: `Práctica · ${(x.ces || []).map((c) => c.codigo).join(', ') || 'sin CE'}` })),
    ...D.porTipo('calificacion').filter((x) => x.sesion === s.id).map((x) => ({ href: `#/calificacion/${x.id}`, texto: `${x.titulo || x.instrumento} · ${(x.ces || []).join(', ') || 'sin CE'}` })),
  ];

  marco(`Sesión · ${fechaCorta(s.fecha)}`, `
    <form id="f-sesion" class="formulario" autocomplete="off">
      <div class="rejilla-3">
        <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(s.fecha)}" required></label>
        <label class="campo"><span>Desde</span><input type="time" name="inicio" value="${esc(horaInput(s.inicio))}"></label>
        <label class="campo"><span>Hasta</span><input type="time" name="fin" value="${esc(horaInput(s.fin))}"></label>
      </div>
      <fieldset class="campo"><legend>Módulo</legend>
        <div class="opciones">${modulos().map((m) => `<label class="opcion"><input type="checkbox" name="modulos" value="${esc(m.codigo)}" data-grupo="${esc(m.grupo)}" ${s.modulos.includes(m.codigo) ? 'checked' : ''}><span>${esc(etiqueta(m.codigo))} <small>${esc(grupo(m.grupo)?.nombre || '')}</small></span></label>`).join('')}</div>
      </fieldset>
      <fieldset class="campo"><legend>Tipo</legend>
        <div class="opciones">${TIPOS_SESION.map(([k, t]) => `<label class="opcion"><input type="radio" name="clase" value="${k}" ${s.clase === k ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>
      </fieldset>
      <label class="campo" id="c-lugar" ${s.clase === 'salida' ? '' : 'hidden'}><span>Lugar de la salida o visita</span><input type="text" name="lugar" value="${esc(s.lugar)}"></label>
      <label class="campo"><span>Unidad de trabajo</span><select name="ut" id="s-ut"></select></label>
      <div class="campo"><span>CE trabajados</span><div id="ces" class="ces-elegir"></div></div>
      <label class="campo"><span>Qué se ha hecho</span><textarea name="diario" rows="4">${esc(s.diario)}</textarea></label>
      <fieldset class="campo"><legend>Cómo ha ido</legend>
        <div class="opciones">${[1, 2, 3, 4, 5].map((v) => `<label class="opcion"><input type="radio" name="valoracion" value="${v}" ${Number(s.valoracion) === v ? 'checked' : ''}><span>${VALORACIONES[v]}</span></label>`).join('')}</div>
      </fieldset>
      <label class="campo"><span>Comentario sobre la sesión</span><textarea name="comoFue" rows="3">${esc(s.comoFue)}</textarea></label>
      <label class="campo"><span>Qué cambiaría el año que viene</span><textarea name="cambios" rows="2">${esc(s.cambios)}</textarea></label>
      <p class="estado-guardado" id="guardado">Se guarda solo.</p>
    </form>

    <h2>Alumnos</h2>
    <p class="ayuda">Marca solo a quien destaca, a quien no se ha comportado bien o a quien no estaba. Vuelve a tocar para quitar la marca.</p>
    <div id="lista-marcas" class="tarjeta"></div>

    <h2>Anotaciones de esta sesión</h2>
    <div class="tarjeta">
      ${anotaciones.length ? `<ul class="lista">${anotaciones.map(filaAnotacion).join('')}</ul>` : '<p class="vacio">Ninguna.</p>'}
      <a class="boton secundario" href="#/anotar?sesion=${esc(s.id)}&volver=sesion/${esc(s.id)}">Añadir anotación</a>
    </div>

    <h2>Calificar</h2>
    <div class="tarjeta botones">
      <button class="boton" type="button" id="b-practica">Notas de práctica (CE PP)</button>
      <button class="boton secundario" type="button" id="b-calificar">Trabajo, prueba u observación</button>
      ${califSesion.length ? `<ul class="lista">${califSesion.map((x) => `<li><a href="${esc(x.href)}"><span class="crece">${esc(x.texto)}</span></a></li>`).join('')}</ul>` : ''}
    </div>

    <div class="botones" style="margin-top:24px"><button class="boton peligro" type="button" id="b-borrar">Borrar esta sesión</button></div>
  `, { volver: '#/diario', pestana: 'diario', editable: true });

  const f = $('#f-sesion');
  const aviso = $('#guardado');

  const modulosElegidos = () => [...f.querySelectorAll('input[name=modulos]:checked')].map((c) => c.value);

  function pintarUT() {
    const uts = utsDe(modulosElegidos());
    const sel = $('#s-ut');
    const actual = s.ut;
    sel.innerHTML = `<option value="">—</option>${uts.map((u) => `<option ${u === actual ? 'selected' : ''}>${esc(u)}</option>`).join('')}`;
    if (actual && !uts.includes(actual)) sel.insertAdjacentHTML('beforeend', `<option selected>${esc(actual)}</option>`);
  }

  function pintarCEs() {
    const mods = modulosElegidos();
    const ut = $('#s-ut').value;
    const caja = $('#ces');
    const elegido = (m, c) => s.ces.some((x) => x.modulo === m && x.codigo === c);
    let html = '';
    for (const codigo of mods) {
      const m = modulo(codigo);
      const lista = m.ce.filter((c) => (ut ? c.ut === ut : false) || elegido(codigo, c.codigo));
      if (!lista.length) continue;
      html += `<div class="ces-modulo">${mods.length > 1 ? `<div class="sub">${esc(etiqueta(codigo))}</div>` : ''}${lista.map((c) => `
        <button type="button" class="ce-chip ${elegido(codigo, c.codigo) ? 'activo' : ''}" data-m="${esc(codigo)}" data-c="${esc(c.codigo)}" title="${esc(c.texto)}">
          <strong>${esc(c.codigo)}</strong> <span>${esc(c.instrumento)}</span>
        </button>`).join('')}</div>`;
    }
    caja.innerHTML = html || `<p class="vacio">${mods.length ? 'Elige una unidad de trabajo para ver sus CE.' : 'Elige primero el módulo.'}</p>`;
    caja.querySelectorAll('.ce-chip').forEach((b) => b.addEventListener('click', () => {
      const m = b.dataset.m;
      const c = b.dataset.c;
      const i = s.ces.findIndex((x) => x.modulo === m && x.codigo === c);
      if (i >= 0) s.ces.splice(i, 1);
      else s.ces.push({ modulo: m, codigo: c });
      b.classList.toggle('activo');
      guardar();
    }));
  }

  function pintarMarcas() {
    const g = s.grupo || (s.modulos[0] && modulo(s.modulos[0])?.grupo);
    const caja = $('#lista-marcas');
    if (!g) {
      caja.innerHTML = '<p class="vacio">Elige el módulo para ver la lista.</p>';
      return;
    }
    caja.innerHTML = `<ul class="lista marcas">${alumnosDe(g).map((a) => `
      <li class="item">
        <a class="crece clave" href="#/alumno/${esc(a.clave)}" title="${esc(nombre(a.clave))}">${nombreCortoHTML(a.clave)}</a>
        ${MARCAS.map(([k, t, simbolo]) => `<button type="button" class="marca ${k} ${s.marcas[a.clave] === k ? 'activo' : ''}" data-clave="${esc(a.clave)}" data-marca="${k}" aria-pressed="${s.marcas[a.clave] === k}" title="${esc(t)}"><span aria-hidden="true">${simbolo}</span><span class="txt">${esc(t)}</span></button>`).join('')}
      </li>`).join('')}</ul>`;
    caja.querySelectorAll('.marca').forEach((b) => b.addEventListener('click', () => {
      const clave = b.dataset.clave;
      const k = b.dataset.marca;
      if (s.marcas[clave] === k) delete s.marcas[clave];
      else s.marcas[clave] = k;
      caja.querySelectorAll(`.marca[data-clave="${CSS.escape(clave)}"]`).forEach((x) => {
        const on = s.marcas[clave] === x.dataset.marca;
        x.classList.toggle('activo', on);
        x.setAttribute('aria-pressed', on);
      });
      guardar();
    }));
  }

  function leer() {
    const fd = new FormData(f);
    s.fecha = fd.get('fecha') || s.fecha;
    s.inicio = horaCorta(fd.get('inicio') || '');
    s.fin = horaCorta(fd.get('fin') || '');
    s.modulos = modulosElegidos();
    s.grupo = s.modulos[0] ? modulo(s.modulos[0]).grupo : '';
    s.clase = fd.get('clase') || 'teoria';
    s.lugar = fd.get('lugar') || '';
    s.ut = fd.get('ut') || '';
    s.diario = fd.get('diario') || '';
    s.valoracion = Number(fd.get('valoracion') || 0);
    s.comoFue = fd.get('comoFue') || '';
    s.cambios = fd.get('cambios') || '';
    // Si se quita un módulo, se quitan sus CE.
    s.ces = s.ces.filter((x) => s.modulos.includes(x.modulo));
  }

  const guardar = diferido(async () => {
    leer();
    aviso.textContent = 'Guardando…';
    await D.guardar(s);
    aviso.textContent = `Guardado a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`;
  }, 600);

  f.addEventListener('input', guardar);
  f.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.name === 'modulos') {
      // Un módulo de otro grupo deja solo ese: los alumnos no se mezclan.
      if (t.checked) f.querySelectorAll('input[name=modulos]').forEach((c) => { if (c.dataset.grupo !== t.dataset.grupo) c.checked = false; });
      leer();
      pintarUT();
      pintarCEs();
      pintarMarcas();
    }
    if (t.name === 'ut') { s.ut = t.value; pintarCEs(); }
    if (t.name === 'clase') $('#c-lugar').hidden = t.value !== 'salida';
    guardar();
  });

  $('#b-practica').addEventListener('click', async () => {
    leer();
    if (!s.modulos.length) { alert('Elige primero el módulo de la sesión.'); return; }
    await guardar.ya();
    await Calificar.abrirPractica(s);
  });
  $('#b-calificar').addEventListener('click', async () => {
    leer();
    if (!s.modulos.length) { alert('Elige primero el módulo de la sesión.'); return; }
    await guardar.ya();
    await Calificar.nuevaCalificacion({ sesion: s.id, instrumento: s.clase === 'prueba' ? 'PE' : 'TP' });
  });
  $('#b-borrar').addEventListener('click', async () => {
    if (!confirm('¿Borrar esta sesión con su diario y sus marcas? Las anotaciones y las notas se conservan.')) return;
    guardar.cancelar();
    await D.borrar(s.id);
    ir('#/diario');
  });

  // Antes de salir de la pantalla, guardar lo pendiente.
  window.addEventListener('hashchange', () => { if (D.obtener(s.id)) guardar.ya(); }, { once: true });

  pintarUT();
  pintarCEs();
  pintarMarcas();
}

// ---------- Anotaciones ----------

function filaAnotacion(a) {
  return `<li><a href="#/anotacion/${esc(a.id)}">
    <span class="crece"><strong>${a.clave ? esc(nombre(a.clave)) : 'Toda la clase'}</strong> · ${esc(a.categoria || '')}
      <span class="sub">${esc(fechaCorta(a.fecha))}${a.modulo ? ' · ' + esc(etiqueta(a.modulo)) : ''} · ${esc(primeraLinea(a.texto, 70))}</span>
    </span></a></li>`;
}

export function vistaAnotacion(id, q) {
  const existente = id ? D.obtener(id) : null;
  const sesion = q.sesion ? D.obtener(q.sesion) : (existente?.sesion ? D.obtener(existente.sesion) : null);
  const a = existente || {
    tipo: 'anotacion',
    fecha: sesion?.fecha || hoyISO(),
    sesion: sesion?.id || '',
    grupo: sesion?.grupo || (q.clave ? alumno(q.clave)?.grupo : '') || 'G1',
    clave: q.clave || '',
    modulo: sesion?.modulos?.[0] || '',
    categoria: 'Observación de clase',
    texto: '',
  };
  const volver = q.volver ? `#/${q.volver}` : (a.clave ? `#/alumno/${a.clave}` : (a.sesion ? `#/sesion/${a.sesion}` : '#/diario'));
  const categorias = listas().tiposAnotacion.filter((t) => t !== 'Charla con el alumno');

  marco(existente ? 'Anotación' : 'Nueva anotación', `
    <form id="f-anot" class="formulario">
      <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(a.fecha)}" required></label>
      <label class="campo"><span>Grupo</span><select name="grupo" id="a-grupo">${grupos().map((g) => `<option value="${esc(g.codigo)}" ${g.codigo === a.grupo ? 'selected' : ''}>${esc(g.nombre)}</option>`).join('')}</select></label>
      <label class="campo"><span>Sobre</span><select name="clave" id="a-clave"></select></label>
      <label class="campo"><span>Módulo (opcional)</span><select name="modulo" id="a-modulo"></select></label>
      <label class="campo"><span>Tipo</span><select name="categoria">${categorias.map((c) => `<option ${c === a.categoria ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      <label class="campo"><span>Anotación</span><textarea name="texto" rows="5" required>${esc(a.texto)}</textarea></label>
      <div class="botones">
        <button class="boton" type="submit">Guardar</button>
        ${existente ? '<button class="boton peligro" type="button" id="b-borrar">Borrar</button>' : ''}
      </div>
    </form>
  `, { volver, pestana: a.clave ? 'alumnos' : 'diario', editable: true });

  const f = $('#f-anot');
  function pintarSelects() {
    const g = $('#a-grupo').value;
    $('#a-clave').innerHTML = `<option value="">Toda la clase</option>${alumnosDe(g).map((x) => `<option value="${esc(x.clave)}" ${x.clave === a.clave ? 'selected' : ''}>${esc(nombre(x.clave))}</option>`).join('')}`;
    $('#a-modulo').innerHTML = `<option value="">—</option>${modulosDeGrupo(g).map((m) => `<option value="${esc(m.codigo)}" ${m.codigo === a.modulo ? 'selected' : ''}>${esc(etiqueta(m.codigo))} · ${esc(m.nombre)}</option>`).join('')}`;
  }
  $('#a-grupo').addEventListener('change', pintarSelects);
  pintarSelects();
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f);
    Object.assign(a, { fecha: fd.get('fecha'), grupo: fd.get('grupo'), clave: fd.get('clave'), modulo: fd.get('modulo'), categoria: fd.get('categoria'), texto: fd.get('texto').trim() });
    await D.guardar(a);
    ir(volver);
  });
  $('#b-borrar')?.addEventListener('click', async () => {
    if (!confirm('¿Borrar esta anotación?')) return;
    await D.borrar(a.id);
    ir(volver);
  });
}

// ---------- Charlas con alumnos ----------

export function vistaCharla(id, q) {
  const existente = id ? D.obtener(id) : null;
  const c = existente || { tipo: 'charla', fecha: hoyISO(), clave: q.clave || '', motivo: '', contenido: '', acuerdos: '' };
  const al = alumno(c.clave);
  const volver = `#/alumno/${c.clave}`;
  marco(existente ? `Charla · ${nombre(c.clave)}` : `Nueva charla · ${nombre(c.clave)}`, `
    <form id="f-charla" class="formulario">
      <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(c.fecha)}" required></label>
      ${al ? '' : `<label class="campo"><span>Alumno</span><select name="clave">${grupos().map((g) => `<optgroup label="${esc(g.nombre)}">${alumnosDe(g.codigo).map((x) => `<option value="${esc(x.clave)}">${esc(nombre(x.clave))}</option>`).join('')}</optgroup>`).join('')}</select></label>`}
      <label class="campo"><span>Motivo</span><input type="text" name="motivo" value="${esc(c.motivo)}" placeholder="Por qué habéis hablado"></label>
      <label class="campo"><span>De qué habéis hablado</span><textarea name="contenido" rows="6" required>${esc(c.contenido)}</textarea></label>
      <label class="campo"><span>Acuerdos</span><textarea name="acuerdos" rows="3">${esc(c.acuerdos)}</textarea></label>
      <div class="botones">
        <button class="boton" type="submit">Guardar</button>
        ${existente ? '<button class="boton peligro" type="button" id="b-borrar">Borrar</button>' : ''}
      </div>
    </form>
  `, { volver, pestana: 'alumnos', editable: true });
  const f = $('#f-charla');
  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(f);
    Object.assign(c, { fecha: fd.get('fecha'), clave: fd.get('clave') || c.clave, motivo: fd.get('motivo').trim(), contenido: fd.get('contenido').trim(), acuerdos: fd.get('acuerdos').trim() });
    await D.guardar(c);
    ir(`#/alumno/${c.clave}`);
  });
  $('#b-borrar')?.addEventListener('click', async () => {
    if (!confirm('¿Borrar esta charla?')) return;
    await D.borrar(c.id);
    ir(volver);
  });
}

// ---------- Ficha del alumno ----------

export function vistaAlumno(clave) {
  const a = alumno(clave);
  if (!a) return marco('Alumno', '<p class="vacio">No encontrado.</p>', { volver: '#/alumnos', pestana: 'alumnos' });
  const mods = modulosDeGrupo(a.grupo);
  const sesionesConMarca = sesiones().filter((s) => s.marcas?.[clave]);
  const cuenta = (k) => sesionesConMarca.filter((s) => s.marcas[clave] === k).length;
  const charlas = D.porTipo('charla').filter((c) => c.clave === clave).sort((x, y) => y.fecha.localeCompare(x.fecha));
  const anotaciones = D.porTipo('anotacion').filter((x) => x.clave === clave).sort((x, y) => y.fecha.localeCompare(x.fecha));

  marco(nombre(a.clave), `
    <div class="tarjeta">
      <dl class="datos">
        <dt>Clave</dt><dd>${esc(a.clave)}</dd>
        <dt>Grupo</dt><dd>${esc(grupo(a.grupo)?.nombre || '')}</dd>
        <dt>Número de lista</dt><dd>${a.orden}</dd>
        <dt>Módulos</dt><dd>${mods.map((m) => esc(etiqueta(m.codigo))).join(' · ')}</dd>
      </dl>
    </div>

    <details class="tarjeta editar-nombre">
      <summary>Editar nombre</summary>
      <form id="f-nombre" class="formulario" style="margin-top:12px">
        <div class="rejilla-2">
          <label class="campo"><span>Primer apellido</span><input type="text" name="apellido1" value="${esc(a.apellido1 || '')}"></label>
          <label class="campo"><span>Segundo apellido</span><input type="text" name="apellido2" value="${esc(a.apellido2 || '')}"></label>
        </div>
        <label class="campo"><span>Nombre</span><input type="text" name="nombre" value="${esc(a.nombre || '')}"></label>
        <button class="boton" type="submit">Guardar nombre</button>
      </form>
    </details>

    <h2>Notas</h2>
    ${Calificar.resumenAlumno(clave)}

    <h2>En clase</h2>
    <div class="tarjeta">
      <div class="resumen-marcas">${MARCAS.map(([k, t, simbolo]) => `<div class="marca-resumen ${k}"><strong>${simbolo} ${cuenta(k)}</strong><span>${esc(t)}</span></div>`).join('')}</div>
      ${sesionesConMarca.length ? `<ul class="lista">${sesionesConMarca.slice(0, 15).map((s) => {
        const m = MARCAS.find((x) => x[0] === s.marcas[clave]);
        return `<li><a href="#/sesion/${esc(s.id)}"><span class="crece">${esc(fechaCorta(s.fecha))} · ${esc(etiquetas(s.modulos))}<span class="sub">${esc(nombreTipo(s.clase))}${s.ut ? ' · ' + esc(s.ut) : ''}</span></span><span class="chip marca-chip ${m[0]}">${m[2]} ${esc(m[1])}</span></a></li>`;
      }).join('')}</ul>` : '<p class="vacio">Sin marcas en las sesiones.</p>'}
    </div>

    <h2>Charlas</h2>
    <div class="tarjeta">
      ${charlas.length ? `<ul class="lista">${charlas.map((c) => `<li><a href="#/charla/${esc(c.id)}"><span class="crece">${esc(fechaCorta(c.fecha))} · ${esc(c.motivo || 'Charla')}<span class="sub">${esc(primeraLinea(c.contenido, 80))}</span></span></a></li>`).join('')}</ul>` : '<p class="vacio">Ninguna.</p>'}
      <a class="boton secundario" href="#/charla/nueva?clave=${esc(clave)}">Nueva charla</a>
    </div>

    <h2>Anotaciones</h2>
    <div class="tarjeta">
      ${anotaciones.length ? `<ul class="lista">${anotaciones.map(filaAnotacion).join('')}</ul>` : '<p class="vacio">Ninguna.</p>'}
      <a class="boton secundario" href="#/anotar?clave=${esc(clave)}&volver=alumno/${esc(clave)}">Nueva anotación</a>
    </div>

  `, { volver: '#/alumnos', pestana: 'alumnos' });
  $('#f-nombre').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    a.apellido1 = fd.get('apellido1').trim();
    a.apellido2 = fd.get('apellido2').trim();
    a.nombre = fd.get('nombre').trim();
    await D.guardar(a);
    vistaAlumno(clave);
  });
}

// ---------- Reuniones ----------

export function vistaReuniones() {
  const lista = D.porTipo('reunion').sort((a, b) => b.fecha.localeCompare(a.fecha));
  const tareas = tareasPendientes();
  marco('Reuniones', `
    <div class="botones" style="margin-bottom:16px"><button class="boton" type="button" id="b-nueva">Nueva reunión</button></div>
    <h2>Tareas pendientes${tareas.length ? ` · ${tareas.length}` : ''}</h2>
    <div class="tarjeta">${pintarTareas(tareas)}</div>
    <h2>Reuniones</h2>
    ${lista.length ? lista.map((r) => {
      const pend = (r.tareas || []).filter((t) => !t.hecha).length;
      return `<a class="tarjeta" href="#/reunion/${esc(r.id)}">
        <div class="fila"><span class="titulo crece">${esc(fechaCorta(r.fecha))} · ${esc(r.clase)}</span>${pend ? `<span class="chip">${pend} pendiente${pend > 1 ? 's' : ''}</span>` : ''}</div>
        ${r.temas || r.acuerdos ? `<div class="extracto">${esc(primeraLinea(r.acuerdos || r.temas))}</div>` : ''}
      </a>`;
    }).join('') : '<p class="vacio">Todavía no hay reuniones.</p>'}
  `, { pestana: 'ajustes' });
  $('#b-nueva').addEventListener('click', async () => {
    const [r] = await D.guardar({ tipo: 'reunion', fecha: hoyISO(), clase: 'Departamento', asistentes: '', temas: '', acuerdos: '', tareas: [] });
    ir(`#/reunion/${r.id}`);
  });
  enlazarTareas();
}

export function vistaReunion(id) {
  const r = D.obtener(id);
  if (!r || r.tipo !== 'reunion') return marco('Reunión', '<p class="vacio">No encontrada.</p>', { volver: '#/reuniones', pestana: 'ajustes' });
  r.tareas = r.tareas || [];
  marco(`Reunión · ${fechaCorta(r.fecha)}`, `
    <form id="f-reunion" class="formulario" autocomplete="off">
      <div class="rejilla-2">
        <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(r.fecha)}" required></label>
        <label class="campo"><span>Tipo</span><select name="clase">${TIPOS_REUNION.map((t) => `<option ${t === r.clase ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      </div>
      <label class="campo"><span>Asistentes (opcional)</span><input type="text" name="asistentes" value="${esc(r.asistentes)}"></label>
      <label class="campo"><span>Temas tratados</span><textarea name="temas" rows="5">${esc(r.temas)}</textarea></label>
      <label class="campo"><span>Acuerdos</span><textarea name="acuerdos" rows="5">${esc(r.acuerdos)}</textarea></label>
      <p class="estado-guardado" id="guardado">Se guarda solo.</p>
    </form>
    <h2>Mis tareas de esta reunión</h2>
    <div class="tarjeta">
      <ul class="lista" id="tareas"></ul>
      <form id="f-tarea" class="nueva-tarea">
        <input type="text" name="texto" placeholder="Nueva tarea" required>
        <input type="date" name="limite" aria-label="Fecha límite">
        <button class="boton pequeno" type="submit">Añadir</button>
      </form>
    </div>
    <div class="botones" style="margin-top:24px"><button class="boton peligro" type="button" id="b-borrar">Borrar esta reunión</button></div>
  `, { volver: '#/reuniones', pestana: 'ajustes', editable: true });

  const f = $('#f-reunion');
  const aviso = $('#guardado');
  const guardar = diferido(async () => {
    const fd = new FormData(f);
    Object.assign(r, { fecha: fd.get('fecha') || r.fecha, clase: fd.get('clase'), asistentes: fd.get('asistentes'), temas: fd.get('temas'), acuerdos: fd.get('acuerdos') });
    aviso.textContent = 'Guardando…';
    await D.guardar(r);
    aviso.textContent = `Guardado a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.`;
  }, 600);
  f.addEventListener('input', guardar);
  f.addEventListener('change', guardar);

  function pintarTareasReunion() {
    const hoy = hoyISO();
    $('#tareas').innerHTML = r.tareas.map((t) => `
      <li class="item tarea">
        <input type="checkbox" data-id="${esc(t.id)}" ${t.hecha ? 'checked' : ''} aria-label="Hecha">
        <span class="crece ${t.hecha ? 'hecha' : ''}">${esc(t.texto)}</span>
        ${t.limite ? `<span class="chip ${!t.hecha && t.limite < hoy ? 'alerta' : 'neutro'}">${esc(fechaCorta(t.limite))}</span>` : ''}
        <button type="button" class="quitar" data-quitar="${esc(t.id)}" aria-label="Quitar tarea">×</button>
      </li>`).join('') || '<li class="vacio">Sin tareas.</li>';
    $$('#tareas [data-id]').forEach((c) => c.addEventListener('change', () => {
      r.tareas.find((t) => t.id === c.dataset.id).hecha = c.checked;
      pintarTareasReunion();
      guardar.ya();
    }));
    $$('#tareas [data-quitar]').forEach((b) => b.addEventListener('click', () => {
      r.tareas = r.tareas.filter((t) => t.id !== b.dataset.quitar);
      pintarTareasReunion();
      guardar.ya();
    }));
  }
  $('#f-tarea').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    r.tareas.push({ id: crypto.randomUUID(), texto: fd.get('texto').trim(), limite: fd.get('limite') || '', hecha: false });
    ev.target.reset();
    pintarTareasReunion();
    guardar.ya();
  });
  $('#b-borrar').addEventListener('click', async () => {
    if (!confirm('¿Borrar esta reunión y sus tareas?')) return;
    guardar.cancelar();
    await D.borrar(r.id);
    ir('#/reuniones');
  });
  window.addEventListener('hashchange', () => { if (D.obtener(r.id)) guardar.ya(); }, { once: true });
  pintarTareasReunion();
}

// Fechas de las sesiones, para quien lo necesite.
export { aFecha };
