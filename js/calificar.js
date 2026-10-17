// Fase 3: calificar. Prácticas diarias, trabajos, pruebas, observación directa, examen práctico, libreta y notas.
import * as D from './datos.js';
import * as N from './notas.js';
import * as Cierre from './cierre.js';
import {
  esc, num, hoyISO, fechaCorta, modulo, grupo, modulos, alumnosDe, alumno, utsDe, listas, ir, diferido, evTexto, etiqueta, nombre, nombreHTML, nombreCortoHTML,
} from './util.js';

let marco = null;
export function configurar(opciones) {
  marco = opciones.marco;
}

const raiz = () => document.getElementById('app');
const $ = (sel) => raiz().querySelector(sel);
const $$ = (sel) => [...raiz().querySelectorAll(sel)];

const fmt = (v, d = 2) => (v === null || v === undefined ? '—' : num(Math.round(v * 10 ** d) / 10 ** d));
const ctx = () => N.contexto(D.porTipo, listas());
const ahoraTexto = () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

function nombreCorto(texto) {
  return String(texto).split('.')[0].split(' (')[0];
}

// ---------- Selector de CE (por UT) ----------

function selectorCE({ caja, mods, filtro, elegidos, alCambiar, utInicial = '' }) {
  let ut = utInicial;
  function pintar() {
    const uts = utsDe(mods);
    const opciones = `<option value="">Elige UT…</option>${uts.map((u) => `<option ${u === ut ? 'selected' : ''}>${esc(u)}</option>`).join('')}`;
    let html = `<select class="sel-ut" aria-label="Unidad de trabajo">${opciones}</select>`;
    for (const codigo of mods) {
      const m = modulo(codigo);
      const lista = m.ce.filter((c) => filtro(c) && ((ut && c.ut === ut) || elegidos.some((x) => x.modulo === codigo && x.codigo === c.codigo)));
      if (!lista.length) continue;
      html += `<div class="ces-modulo">${mods.length > 1 ? `<div class="sub">${esc(etiqueta(codigo))}</div>` : ''}${lista.map((c) => {
        const on = elegidos.some((x) => x.modulo === codigo && x.codigo === c.codigo);
        return `<button type="button" class="ce-chip ${on ? 'activo' : ''}" data-m="${esc(codigo)}" data-c="${esc(c.codigo)}" title="${esc(c.texto)}"><strong>${esc(c.codigo)}</strong> <span>${esc(c.instrumento)} · ${esc(evTexto(c.ev))}</span></button>`;
      }).join('')}</div>`;
    }
    caja.innerHTML = html;
    caja.querySelector('.sel-ut').addEventListener('change', (ev) => { ut = ev.target.value; pintar(); });
    caja.querySelectorAll('.ce-chip').forEach((b) => b.addEventListener('click', () => {
      const i = elegidos.findIndex((x) => x.modulo === b.dataset.m && x.codigo === b.dataset.c);
      if (i >= 0) elegidos.splice(i, 1);
      else elegidos.push({ modulo: b.dataset.m, codigo: b.dataset.c });
      pintar();
      alCambiar();
    }));
  }
  pintar();
}

// ---------- Práctica diaria ----------

export async function abrirPractica(sesion) {
  let p = D.porTipo('practica').find((x) => x.sesion === sesion.id);
  if (!p) {
    const filas = {};
    for (const [clave, marca] of Object.entries(sesion.marcas || {})) if (marca === 'ausente') filas[clave] = { asiste: 'falta' };
    const ces = (sesion.ces || []).filter((x) => modulo(x.modulo)?.ce.find((c) => c.codigo === x.codigo)?.instrumento === 'PP');
    [p] = await D.guardar({ tipo: 'practica', sesion: sesion.id, fecha: sesion.fecha, grupo: sesion.grupo, modulos: [...sesion.modulos], ut: sesion.ut || '', ces, filas });
  }
  ir(`#/practica/${p.id}`);
}

const ASISTE = [
  [undefined, 'Sí', ''],
  ['falta', 'Falta', 'falta'],
  ['justificada', 'Justif.', 'justificada'],
];

export function vistaPractica(id) {
  const p = D.obtener(id);
  if (!p || p.tipo !== 'practica') return marco('Práctica', '<p class="vacio">No encontrada.</p>', { volver: '#/notas', pestana: 'notas' });
  p.filas = p.filas || {};
  p.ces = p.ces || [];
  const items = listas().encargadoItems || [];
  const sesion = p.sesion ? D.obtener(p.sesion) : null;
  const volver = sesion ? `#/sesion/${sesion.id}` : '#/notas';
  let actual = null;
  let medio = false;

  marco(`Práctica · ${fechaCorta(p.fecha)}`, `
    <div class="tarjeta">
      <div class="campo"><span>CE de ejecución práctica (PP) de esta práctica</span><div id="ces" class="ces-elegir"></div></div>
      <p class="ayuda" style="margin:0">${p.modulos.length > 1 ? 'Práctica común: las notas cuentan en los CE de los dos módulos.' : 'Las notas cuentan en los CE marcados.'}</p>
    </div>
    <p class="ayuda">Toca un alumno y después su nota. La estrella marca al encargado: ese día se valora con sus 5 ítems y cuenta doble. «Falta» cuenta 0; «Justif.» no cuenta.</p>
    <div class="tarjeta"><ul class="lista practica" id="filas"></ul></div>
    <div class="teclado" id="teclado" aria-label="Teclado de notas">
      <div class="teclado-cab"><span id="t-actual">Elige un alumno</span><span class="estado-guardado" id="guardado"></span></div>
      <div class="teclas">
        ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join('')}
        <button type="button" data-medio class="${medio ? 'activo' : ''}">,5</button>
        <button type="button" data-borrar>Borrar</button>
      </div>
    </div>
    <div class="botones" style="margin-top:16px"><button class="boton peligro" type="button" id="b-borrar">Borrar las notas de esta práctica</button></div>
  `, { volver, pestana: 'notas', editable: true });

  const aviso = $('#guardado');
  const guardar = diferido(async () => {
    aviso.textContent = 'Guardando…';
    await D.guardar(p);
    aviso.textContent = `Guardado ${ahoraTexto()}`;
  }, 500);

  selectorCE({
    caja: $('#ces'), mods: p.modulos, filtro: (c) => c.instrumento === 'PP', elegidos: p.ces, utInicial: p.ut, alCambiar: guardar,
  });

  const alumnos = alumnosDe(p.grupo);
  const fila = (clave) => (p.filas[clave] = p.filas[clave] || {});

  function textoNota(f) {
    if (f.asiste === 'falta') return '0';
    if (f.asiste === 'justificada') return '—';
    if (f.rol === 'encargado') { const n = N.notaEncargado(f.items); return n === null ? 'Enc.' : fmt(n, 1); }
    return f.valor === undefined || f.valor === null || f.valor === '' ? '' : fmt(Number(f.valor), 2);
  }

  function pintarFilas() {
    $('#filas').innerHTML = alumnos.map((a) => {
      const f = p.filas[a.clave] || {};
      const asiste = ASISTE.find((x) => x[0] === f.asiste) || ASISTE[0];
      const enc = f.rol === 'encargado';
      return `<li class="fila-alumno ${actual === a.clave ? 'seleccionada' : ''} ${f.asiste ? 'ausente' : ''}" data-clave="${esc(a.clave)}">
        <div class="item">
          <button type="button" class="crece clave sel" data-sel="${esc(a.clave)}" title="${esc(nombre(a.clave))}">${nombreCortoHTML(a.clave)}</button>
          <button type="button" class="asiste ${asiste[2]}" data-asiste="${esc(a.clave)}">${asiste[1]}</button>
          <button type="button" class="caja-nota ${actual === a.clave ? 'activa' : ''}" data-sel="${esc(a.clave)}" aria-label="Nota">${esc(textoNota(f))}</button>
          <button type="button" class="estrella ${enc ? 'activo' : ''}" data-enc="${esc(a.clave)}" aria-pressed="${enc}" title="Encargado">${enc ? '★' : '☆'}</button>
          <button type="button" class="coment ${f.comentario ? 'activo' : ''}" data-com="${esc(a.clave)}" title="Comentario">💬</button>
        </div>
        ${enc ? `<div class="items-encargado">${items.map((it, i) => `<label title="${esc(it)}"><span>${esc(String(it).split(/[ .]/)[0])}</span><input type="text" inputmode="decimal" data-item="${i}" data-clave="${esc(a.clave)}" value="${esc(f.items?.[i] ?? '')}"></label>`).join('')}</div>` : ''}
        ${f.verComentario || f.comentario ? `<input type="text" class="comentario" data-comentario="${esc(a.clave)}" placeholder="Comentario" value="${esc(f.comentario || '')}">` : ''}
      </li>`;
    }).join('');
    $('#t-actual').textContent = actual ? `${nombre(actual)}: ${textoNota(p.filas[actual] || {}) || 'sin nota'}` : 'Elige un alumno';
    enlazar();
  }

  function siguiente(desde) {
    const i = alumnos.findIndex((a) => a.clave === desde);
    for (let k = i + 1; k < alumnos.length; k++) {
      const f = p.filas[alumnos[k].clave] || {};
      if (!f.asiste && f.rol !== 'encargado') return alumnos[k].clave;
    }
    return null;
  }

  function enlazar() {
    $$('[data-sel]').forEach((b) => b.addEventListener('click', () => { actual = b.dataset.sel; pintarFilas(); }));
    $$('[data-asiste]').forEach((b) => b.addEventListener('click', () => {
      const f = fila(b.dataset.asiste);
      const i = ASISTE.findIndex((x) => x[0] === f.asiste);
      const sig = ASISTE[(i + 1) % ASISTE.length][0];
      if (sig) f.asiste = sig; else delete f.asiste;
      pintarFilas();
      guardar();
    }));
    $$('[data-enc]').forEach((b) => b.addEventListener('click', () => {
      const f = fila(b.dataset.enc);
      if (f.rol === 'encargado') { delete f.rol; } else { f.rol = 'encargado'; f.items = f.items || [null, null, null, null, null]; delete f.asiste; }
      actual = b.dataset.enc;
      pintarFilas();
      guardar();
    }));
    $$('[data-com]').forEach((b) => b.addEventListener('click', () => {
      const f = fila(b.dataset.com);
      f.verComentario = true;
      pintarFilas();
      raiz().querySelector(`[data-comentario="${CSS.escape(b.dataset.com)}"]`)?.focus();
    }));
    $$('[data-comentario]').forEach((inp) => inp.addEventListener('input', () => { fila(inp.dataset.comentario).comentario = inp.value; guardar(); }));
    $$('[data-item]').forEach((inp) => inp.addEventListener('input', () => {
      const f = fila(inp.dataset.clave);
      const v = N.aNumero(inp.value);
      f.items[Number(inp.dataset.item)] = v !== null && v >= 0 && v <= 10 ? v : null;
      inp.classList.toggle('invalido', inp.value !== '' && f.items[Number(inp.dataset.item)] === null);
      const caja = raiz().querySelector(`li[data-clave="${CSS.escape(inp.dataset.clave)}"] .caja-nota`);
      if (caja) caja.textContent = textoNota(f);
      guardar();
    }));
  }

  $$('#teclado [data-n]').forEach((b) => b.addEventListener('click', () => {
    if (!actual) return;
    const f = fila(actual);
    if (f.rol === 'encargado') return; // el encargado se valora con sus ítems
    let v = Number(b.dataset.n);
    if (medio && v < 10) v += 0.5;
    f.valor = v;
    delete f.asiste;
    actual = siguiente(actual) || actual;
    pintarFilas();
    guardar();
  }));
  $('#teclado [data-medio]').addEventListener('click', (ev) => { medio = !medio; ev.currentTarget.classList.toggle('activo', medio); });
  $('#teclado [data-borrar]').addEventListener('click', () => {
    if (!actual) return;
    delete fila(actual).valor;
    pintarFilas();
    guardar();
  });
  $('#b-borrar').addEventListener('click', async () => {
    if (!confirm('¿Borrar todas las notas de esta práctica?')) return;
    guardar.cancelar();
    await D.borrar(p.id);
    ir(volver);
  });
  window.addEventListener('hashchange', () => { if (D.obtener(p.id)) guardar.ya(); }, { once: true });
  pintarFilas();
}

// ---------- Trabajos, pruebas, observación directa y examen práctico ----------

const INSTR_CALIFICACION = ['TP', 'PE', 'OD', 'EXP'];
const instrCE = (i) => (i === 'EXP' ? 'PP' : i);

export async function nuevaCalificacion(q) {
  const sesion = q.sesion ? D.obtener(q.sesion) : null;
  const mod = q.modulo || sesion?.modulos?.[0] || modulos()[0].codigo;
  const instrumento = INSTR_CALIFICACION.includes(q.instrumento) ? q.instrumento : 'TP';
  const ces = (sesion?.ces || []).filter((x) => x.modulo === mod && modulo(mod).ce.find((c) => c.codigo === x.codigo)?.instrumento === instrCE(instrumento)).map((x) => x.codigo);
  const [c] = await D.guardar({
    tipo: 'calificacion', titulo: sesion?.clase === 'salida' && sesion.lugar ? `Salida: ${sesion.lugar}` : '', fecha: sesion?.fecha || hoyISO(),
    sesion: sesion?.id || '', modulo: mod, instrumento, ut: sesion?.ut || '', ces, filas: {},
  });
  ir(`#/calificacion/${c.id}`);
}

export function vistaCalificacion(id) {
  const c = D.obtener(id);
  if (!c || c.tipo !== 'calificacion') return marco('Calificación', '<p class="vacio">No encontrada.</p>', { volver: '#/notas', pestana: 'notas' });
  c.filas = c.filas || {};
  c.ces = c.ces || [];
  const volver = c.sesion && D.obtener(c.sesion) ? `#/sesion/${c.sesion}` : '#/notas';

  marco(c.titulo || N.INSTRUMENTOS[c.instrumento], `
    <form id="f-cal" class="formulario" autocomplete="off">
      <label class="campo"><span>Título</span><input type="text" name="titulo" value="${esc(c.titulo)}" placeholder="Ej.: Informe de vacunación, Examen UT2…"></label>
      <div class="rejilla-2">
        <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(c.fecha)}"></label>
        <label class="campo"><span>Módulo</span><select name="modulo">${modulos().map((m) => `<option value="${esc(m.codigo)}" ${m.codigo === c.modulo ? 'selected' : ''}>${esc(etiqueta(m.codigo))} · ${esc(grupo(m.grupo)?.nombre || '')}</option>`).join('')}</select></label>
      </div>
      <fieldset class="campo"><legend>Instrumento</legend>
        <div class="opciones">${INSTR_CALIFICACION.map((i) => `<label class="opcion"><input type="radio" name="instrumento" value="${i}" ${c.instrumento === i ? 'checked' : ''}><span>${esc(N.INSTRUMENTOS[i])}</span></label>`).join('')}</div>
      </fieldset>
      ${c.instrumento === 'EXP' ? '<p class="mensaje info">El examen práctico final sustituye a la nota de prácticas de los CE PP marcados, solo para los alumnos que tengan nota aquí.</p>' : ''}
      <div class="campo"><span>CE que se califican</span><div id="ces" class="ces-elegir"></div></div>
      <p class="estado-guardado" id="guardado">Se guarda solo.</p>
    </form>
    <div id="rejilla"></div>
    <div class="botones" style="margin-top:20px"><button class="boton peligro" type="button" id="b-borrar">Borrar esta calificación</button></div>
  `, { volver, pestana: 'notas', editable: true });

  const f = $('#f-cal');
  const aviso = $('#guardado');
  const guardar = diferido(async () => {
    aviso.textContent = 'Guardando…';
    await D.guardar(c);
    aviso.textContent = `Guardado ${ahoraTexto()}`;
  }, 600);

  const elegidos = c.ces.map((codigo) => ({ modulo: c.modulo, codigo }));
  function pintarSelector() {
    selectorCE({
      caja: $('#ces'), mods: [c.modulo], filtro: (x) => x.instrumento === instrCE(c.instrumento), elegidos, utInicial: c.ut,
      alCambiar: () => { c.ces = elegidos.map((x) => x.codigo); pintarRejilla(); guardar(); },
    });
  }

  function pintarRejilla() {
    const m = modulo(c.modulo);
    const alumnos = alumnosDe(m.grupo);
    if (!c.ces.length) { $('#rejilla').innerHTML = '<p class="vacio">Marca al menos un CE para poner notas.</p>'; return; }
    $('#rejilla').innerHTML = `
      <div class="tabla-notas"><table>
        <thead><tr><th>Alumno</th>${c.ces.map((x) => `<th title="${esc(m.ce.find((y) => y.codigo === x)?.texto || '')}">${esc(x)}</th>`).join('')}<th>Comentario</th></tr></thead>
        <tbody>${alumnos.map((a) => {
          const fl = c.filas[a.clave] || {};
          return `<tr><th scope="row">${nombreHTML(a.clave)}</th>${c.ces.map((x) => `<td><input type="text" inputmode="decimal" class="nota" data-clave="${esc(a.clave)}" data-ce="${esc(x)}" value="${esc(fl.notas?.[x] ?? '')}" aria-label="${esc(a.clave)} ${esc(x)}"></td>`).join('')}
            <td><input type="text" class="com" data-clave="${esc(a.clave)}" value="${esc(fl.comentario || '')}" aria-label="Comentario ${esc(a.clave)}"></td></tr>`;
        }).join('')}</tbody>
      </table></div>`;
    $$('#rejilla input.nota').forEach((inp) => inp.addEventListener('input', () => {
      const fl = (c.filas[inp.dataset.clave] = c.filas[inp.dataset.clave] || { notas: {} });
      fl.notas = fl.notas || {};
      const v = N.aNumero(inp.value);
      const valido = inp.value === '' || (v !== null && v >= 0 && v <= 10);
      inp.classList.toggle('invalido', !valido);
      if (inp.value === '') delete fl.notas[inp.dataset.ce];
      else if (valido) fl.notas[inp.dataset.ce] = v;
      guardar();
    }));
    $$('#rejilla input.com').forEach((inp) => inp.addEventListener('input', () => {
      const fl = (c.filas[inp.dataset.clave] = c.filas[inp.dataset.clave] || { notas: {} });
      fl.comentario = inp.value;
      guardar();
    }));
    // Intro baja a la fila siguiente, como en una hoja de cálculo.
    $$('#rejilla input.nota').forEach((inp) => inp.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      const todos = $$(`#rejilla input.nota[data-ce="${CSS.escape(inp.dataset.ce)}"]`);
      todos[todos.indexOf(inp) + 1]?.focus();
    }));
  }

  f.addEventListener('input', (ev) => { if (ev.target.name === 'titulo') { c.titulo = ev.target.value; guardar(); } });
  f.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.name === 'fecha') c.fecha = t.value;
    if (t.name === 'modulo' || t.name === 'instrumento') {
      if (c.ces.length && Object.keys(c.filas).length && !confirm('Al cambiar el módulo o el instrumento se quitan los CE marcados. ¿Seguir?')) { vistaCalificacion(id); return; }
      c[t.name] = t.value;
      c.ces = [];
      elegidos.length = 0;
      guardar.ya();
      vistaCalificacion(id);
      return;
    }
    guardar();
  });
  $('#b-borrar').addEventListener('click', async () => {
    if (!confirm('¿Borrar esta calificación y todas sus notas?')) return;
    guardar.cancelar();
    await D.borrar(c.id);
    ir(volver);
  });
  window.addEventListener('hashchange', () => { if (D.obtener(c.id)) guardar.ya(); }, { once: true });
  pintarSelector();
  pintarRejilla();
}

// ---------- Libreta ----------

export async function abrirLibreta(codigoGrupo, ev) {
  let l = D.porTipo('libreta').find((x) => x.grupo === codigoGrupo && Number(x.ev) === Number(ev));
  if (!l) [l] = await D.guardar({ tipo: 'libreta', grupo: codigoGrupo, ev: Number(ev), fecha: hoyISO(), filas: {} });
  ir(`#/libreta/${l.id}`);
}

export function vistaLibreta(id) {
  const l = D.obtener(id);
  if (!l || l.tipo !== 'libreta') return marco('Libreta', '<p class="vacio">No encontrada.</p>', { volver: '#/notas', pestana: 'notas' });
  l.filas = l.filas || {};
  const apartados = listas().libretaApartados;
  const g = grupo(l.grupo);
  const mods = modulos().filter((m) => m.grupo === l.grupo);
  const imprescindible = mods.some((m) => m.libretaImprescindible);
  const ENTREGA = [[undefined, '—'], [true, 'Sí'], [false, 'No']];

  marco(`Libreta · ${g?.nombre || ''} · ${evTexto(l.ev)}`, `
    <div class="tarjeta">
      <label class="campo" style="margin:0"><span>Fecha de recogida</span><input type="date" id="l-fecha" value="${esc(l.fecha)}"></label>
      <p class="ayuda" style="margin:10px 0 0">Cuenta como un trabajo más en cada CE TP de la ${evTexto(l.ev)} de ${mods.map((m) => esc(etiqueta(m.codigo))).join(' y ')}.
      ${imprescindible ? ' En 1279 es imprescindible: sin libreta, los CE PP de la evaluación valen 0.' : ''}
      Apartados: ${apartados.map((a) => `${esc(nombreCorto(a.nombre))} ${Math.round(a.peso * 100)} %`).join(' · ')}.</p>
    </div>
    <div class="tabla-notas"><table>
      <thead><tr><th>Alumno</th><th>Entregada</th>${apartados.map((a) => `<th>${esc(nombreCorto(a.nombre).split(' /')[0])}</th>`).join('')}<th>Nota</th><th>Comentario</th></tr></thead>
      <tbody id="l-filas"></tbody>
    </table></div>
    <p class="estado-guardado" id="guardado">Se guarda solo.</p>
  `, { volver: '#/notas', pestana: 'notas', editable: true });

  const aviso = $('#guardado');
  const guardar = diferido(async () => { aviso.textContent = 'Guardando…'; await D.guardar(l); aviso.textContent = `Guardado ${ahoraTexto()}`; }, 600);

  function pintar() {
    $('#l-filas').innerHTML = alumnosDe(l.grupo).map((a) => {
      const fl = l.filas[a.clave] || {};
      const e = ENTREGA.find((x) => x[0] === fl.entregada) || ENTREGA[0];
      const nota = N.notaLibreta(fl, apartados);
      return `<tr>
        <th scope="row">${nombreHTML(a.clave)}</th>
        <td><button type="button" class="asiste ${fl.entregada === false ? 'falta' : ''}" data-ent="${esc(a.clave)}">${e[1]}</button></td>
        ${apartados.map((_, i) => `<td><input type="text" inputmode="decimal" class="nota" data-clave="${esc(a.clave)}" data-ap="${i}" value="${esc(fl.apartados?.[i] ?? '')}" ${fl.entregada === false ? 'disabled' : ''}></td>`).join('')}
        <td class="calc">${fl.entregada === false ? 'No entregada' : fmt(nota)}</td>
        <td><input type="text" class="com" data-clave="${esc(a.clave)}" value="${esc(fl.comentario || '')}"></td>
      </tr>`;
    }).join('');
    $$('[data-ent]').forEach((b) => b.addEventListener('click', () => {
      const fl = (l.filas[b.dataset.ent] = l.filas[b.dataset.ent] || {});
      const i = ENTREGA.findIndex((x) => x[0] === fl.entregada);
      const sig = ENTREGA[(i + 1) % ENTREGA.length][0];
      if (sig === undefined) delete fl.entregada; else fl.entregada = sig;
      pintar();
      guardar();
    }));
    $$('#l-filas input.nota').forEach((inp) => inp.addEventListener('input', () => {
      const fl = (l.filas[inp.dataset.clave] = l.filas[inp.dataset.clave] || {});
      fl.apartados = fl.apartados || [null, null, null, null];
      const v = N.aNumero(inp.value);
      const valido = inp.value === '' || (v !== null && v >= 0 && v <= 10);
      inp.classList.toggle('invalido', !valido);
      fl.apartados[Number(inp.dataset.ap)] = valido && inp.value !== '' ? v : null;
      if (inp.value !== '' && fl.entregada === undefined) fl.entregada = true;
      const celda = inp.closest('tr').querySelector('.calc');
      celda.textContent = fmt(N.notaLibreta(fl, apartados));
      guardar();
    }));
    $$('#l-filas input.com').forEach((inp) => inp.addEventListener('input', () => {
      (l.filas[inp.dataset.clave] = l.filas[inp.dataset.clave] || {}).comentario = inp.value;
      guardar();
    }));
  }
  $('#l-fecha').addEventListener('change', (ev) => { l.fecha = ev.target.value; guardar(); });
  window.addEventListener('hashchange', () => { if (D.obtener(l.id)) guardar.ya(); }, { once: true });
  pintar();
}

// ---------- Notas por módulo ----------

let modNotas = null;
let evNotas = 1;

function marcasDeModulo(codigoModulo, clave) {
  const r = { destaca: 0, mal: 0, ausente: 0 };
  for (const s of D.porTipo('sesion')) if (s.modulos?.includes(codigoModulo) && s.marcas?.[clave]) r[s.marcas[clave]]++;
  return r;
}

export function vistaNotas() {
  const mods = modulos();
  if (!modNotas || !modulo(modNotas)) modNotas = mods[0]?.codigo;
  const m = modulo(modNotas);
  if (evNotas > m.evaluaciones) evNotas = 1;
  const c = ctx();
  const filas = alumnosDe(m.grupo).map((a) => ({ a, e: N.notaEvaluacion(m, evNotas, a.clave, c) }));
  const evaluables = [
    ...D.porTipo('calificacion').filter((x) => x.modulo === m.codigo && (x.ces || []).some((code) => m.ce.find((y) => y.codigo === code)?.ev === evNotas))
      .map((x) => ({ fecha: x.fecha, titulo: x.titulo || N.INSTRUMENTOS[x.instrumento], sub: `${N.INSTRUMENTOS[x.instrumento]} · ${(x.ces || []).join(', ')}`, href: `#/calificacion/${x.id}` })),
    ...D.porTipo('practica').filter((x) => (x.ces || []).some((y) => y.modulo === m.codigo && m.ce.find((z) => z.codigo === y.codigo)?.ev === evNotas))
      .map((x) => ({ fecha: x.fecha, titulo: 'Práctica', sub: (x.ces || []).filter((y) => y.modulo === m.codigo).map((y) => y.codigo).join(', '), href: `#/practica/${x.id}` })),
  ].sort((x, y) => y.fecha.localeCompare(x.fecha));

  marco('Notas', `
    <div class="segmento">${mods.map((x) => `<button type="button" data-mod="${esc(x.codigo)}" class="${x.codigo === m.codigo ? 'activo' : ''}">${esc(etiqueta(x.codigo))}</button>`).join('')}</div>
    <div class="segmento">${Array.from({ length: m.evaluaciones }, (_, i) => i + 1).map((n) => `<button type="button" data-ev="${n}" class="${n === evNotas ? 'activo' : ''}">${evTexto(n)}</button>`).join('')}</div>
    <p class="ayuda">${esc(etiqueta(m.codigo))} · ${esc(m.nombre)} · ${esc(grupo(m.grupo)?.nombre || '')} · RA de esta evaluación: ${m.ra.filter((r) => r.ev === evNotas).map((r) => esc(r.codigo)).join(', ')}</p>
    <div class="botones dos">
      <button class="boton" type="button" id="b-cal">Calificar trabajo, prueba u OD</button>
      <button class="boton secundario" type="button" id="b-lib">Libreta de la ${evTexto(evNotas)}</button>
      <button class="boton secundario" type="button" id="b-faltas">Faltas de la ${evTexto(evNotas)}</button>
      <a class="boton secundario" href="#/final/${esc(m.codigo)}">Nota final y recuperaciones</a>
    </div>
    <h2>Alumnos</h2>
    <div class="tabla-notas resumen"><table>
      <thead><tr><th>Alumno</th><th>Real</th><th>Boletín</th>${m.ra.filter((r) => r.ev === evNotas).map((r) => `<th>${esc(r.codigo)}</th>`).join('')}<th>Ajuste</th></tr></thead>
      <tbody>${filas.map(({ a, e }) => `<tr data-ir="#/nota-alumno/${esc(m.codigo)}/${esc(a.clave)}?ev=${evNotas}">
        <th scope="row"><a href="#/nota-alumno/${esc(m.codigo)}/${esc(a.clave)}?ev=${evNotas}">${nombreHTML(a.clave)}</a></th>
        <td><strong>${fmt(e.real)}</strong></td>
        <td class="${e.perdidaEC || (e.boletin !== null && e.boletin < 5) ? 'bajo' : ''}">${e.boletinTexto}${e.boletin !== null && !e.completa && !e.perdidaEC ? '<small>*</small>' : ''}</td>
        ${e.ras.map((r) => `<td class="${r.valor !== null && r.valor < 5 ? 'bajo' : ''}">${fmt(r.valor, 1)}</td>`).join('')}
        <td>${e.ajuste ? (e.ajuste > 0 ? '+' : '') + fmt(e.ajuste, 1) : ''}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="ayuda">* Provisional: faltan CE por calificar. NE: ha superado el límite de faltas (${num(N.limiteFaltas(m))} h). Toca un alumno para ver el detalle y poner el ajuste de actitud.</p>
    <h2>Calificaciones de esta evaluación</h2>
    <div class="tarjeta">${evaluables.length ? `<ul class="lista">${evaluables.map((x) => `<li><a href="${esc(x.href)}"><span class="crece">${esc(fechaCorta(x.fecha))} · ${esc(x.titulo)}<span class="sub">${esc(x.sub)}</span></span></a></li>`).join('')}</ul>` : '<p class="vacio">Todavía ninguna. Las prácticas se califican desde cada sesión.</p>'}</div>
  `, { pestana: 'notas' });
  $$('[data-mod]').forEach((b) => b.addEventListener('click', () => { modNotas = b.dataset.mod; vistaNotas(); }));
  $$('[data-ev]').forEach((b) => b.addEventListener('click', () => { evNotas = Number(b.dataset.ev); vistaNotas(); }));
  $('#b-cal').addEventListener('click', () => nuevaCalificacion({ modulo: m.codigo }));
  $('#b-lib').addEventListener('click', () => abrirLibreta(m.grupo, evNotas));
  $('#b-faltas').addEventListener('click', () => Cierre.abrirFaltas(m.codigo, evNotas));
  $$('tr[data-ir]').forEach((tr) => tr.addEventListener('click', (ev) => { if (ev.target.tagName !== 'A') ir(tr.dataset.ir); }));
}

// ---------- Detalle de un alumno en un módulo ----------

function cabeceraNotas(e) {
  return `<div><span class="sub">Nota real</span><strong class="grande">${fmt(e.real)}</strong></div>
      <div><span class="sub">Boletín</span><strong class="grande ${e.perdidaEC || (e.boletin !== null && e.boletin < 5) ? 'bajo' : ''}">${e.boletinTexto}</strong></div>
      <div><span class="sub">Estado</span><strong>${e.completa ? (e.faltanCE ? `Faltan ${e.faltanCE} CE` : 'Completa') : 'Provisional'}</strong></div>`;
}

export function vistaNotaAlumno(codigoModulo, clave, q) {
  const m = modulo(codigoModulo);
  const a = alumno(clave);
  if (!m || !a) return marco('Notas', '<p class="vacio">No encontrado.</p>', { volver: '#/notas', pestana: 'notas' });
  const ev = Number(q.ev || 1);
  const e = N.notaEvaluacion(m, ev, clave, ctx());
  const marcas = marcasDeModulo(m.codigo, clave);
  let aj = D.porTipo('ajuste').find((x) => x.modulo === m.codigo && Number(x.ev) === ev);

  marco(`${nombre(clave)} · ${etiqueta(m.codigo)}`, `
    <div class="segmento">${Array.from({ length: m.evaluaciones }, (_, i) => i + 1).map((n) => `<a class="${n === ev ? 'activo' : ''}" href="#/nota-alumno/${esc(m.codigo)}/${esc(clave)}?ev=${n}">${evTexto(n)}</a>`).join('')}</div>
    <div class="tarjeta notas-cabecera" id="cabecera-notas">${cabeceraNotas(e)}</div>
    ${e.perdidaEC ? `<p class="mensaje aviso">Ha superado el límite de faltas (${num(e.faltas.total)} h de ${num(e.faltas.limite)} h): pierde la evaluación continua y el boletín es NE.</p>` : ''}
    ${e.raBajo ? '<p class="mensaje aviso">Tiene algún RA por debajo de 5: el boletín no puede pasar de 4.</p>' : ''}

    <h2>Actitud y participación</h2>
    <div class="tarjeta">
      <p class="ayuda" style="margin:0 0 8px">En las sesiones de ${esc(etiqueta(m.codigo))}: <strong>+${marcas.destaca}</strong> destaca · <strong>−${marcas.mal}</strong> comportamiento · <strong>∅${marcas.ausente}</strong> no estaba. Faltas sin justificar: <strong>${num(N.faltasDe(m, ev, clave, ctx()).injustificadas)} h</strong> en esta evaluación (${num(e.faltas.injustificadas)} h en el curso).</p>
      <label class="campo" style="margin:0"><span>Ajuste de la ${evTexto(ev)} (de −1 a +1)</span>
        <input type="number" id="ajuste" min="-1" max="1" step="0.1" inputmode="decimal" value="${e.ajuste || ''}" placeholder="0">
      </label>
      <p class="estado-guardado" id="guardado"></p>
    </div>

    <h2>Resultados de aprendizaje</h2>
    ${e.ras.map((r) => `<details class="ra">
      <summary><div class="fila"><strong class="crece">${esc(r.codigo)} · ${fmt(r.valor)}</strong><span class="chip">${Math.round(r.peso * 100)} %</span>${r.faltan ? `<span class="chip neutro">faltan ${r.faltan}</span>` : ''}</div></summary>
      ${r.ces.map((c) => `<div class="ce">
        <div class="cab"><span class="cod">${esc(c.codigo)}</span><span class="chip neutro">${esc(c.instrumento)}</span><span class="chip neutro">${Math.round(c.peso * 100)} %</span><strong style="margin-left:auto">${fmt(c.valor)}</strong></div>
        ${c.estado ? `<div class="sub">${esc(c.estado)}</div>` : ''}
        ${c.aportes.length ? `<div class="aportes">${c.aportes.map((x) => `<span>${x.fecha ? esc(fechaCorta(x.fecha)) + ' · ' : ''}${esc(x.motivo)}: ${fmt(x.valor)}${x.peso === 2 ? ' ×2' : ''}</span>`).join('')}</div>` : ''}
      </div>`).join('')}
    </details>`).join('')}
  `, { volver: '#/notas', pestana: 'notas', editable: true });

  const aviso = $('#guardado');
  const guardar = diferido(async (valor) => {
    if (!aj) [aj] = await D.guardar({ tipo: 'ajuste', modulo: m.codigo, ev, filas: {} });
    if (valor === null) delete aj.filas[clave]; else aj.filas[clave] = valor;
    await D.guardar(aj);
    aviso.textContent = `Guardado ${ahoraTexto()}.`;
    $('#cabecera-notas').innerHTML = cabeceraNotas(N.notaEvaluacion(m, ev, clave, ctx()));
  }, 700);
  $('#ajuste').addEventListener('input', (ev) => {
    const v = N.aNumero(ev.target.value);
    const valido = ev.target.value === '' || (v !== null && v >= -1 && v <= 1);
    ev.target.classList.toggle('invalido', !valido);
    if (valido) guardar(ev.target.value === '' ? null : v);
  });
}

// ---------- Resumen para la ficha del alumno ----------

export function resumenAlumno(clave) {
  const a = alumno(clave);
  if (!a) return '';
  const c = ctx();
  return modulos().filter((m) => m.grupo === a.grupo).map((m) => `
    <div class="tarjeta">
      <div class="titulo">${esc(etiqueta(m.codigo))} · ${esc(m.nombre)}</div>
      <div class="evaluaciones">${Array.from({ length: m.evaluaciones }, (_, i) => i + 1).map((ev) => {
        const e = N.notaEvaluacion(m, ev, clave, c);
        return `<a href="#/nota-alumno/${esc(m.codigo)}/${esc(clave)}?ev=${ev}"><span class="sub">${evTexto(ev)}</span><strong>${fmt(e.real)}</strong><span class="sub">Boletín ${e.boletinTexto}${e.boletin !== null && !e.completa && !e.perdidaEC ? '*' : ''}</span></a>`;
      }).join('')}</div>
    </div>`).join('');
}
