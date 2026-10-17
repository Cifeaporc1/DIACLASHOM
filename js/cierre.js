// Fase 4: faltas por evaluación, recuperaciones, fase de empresa y nota final.
import * as D from './datos.js';
import * as N from './notas.js';
import { esc, num, modulo, grupo, alumnosDe, alumno, listas, ir, diferido, evTexto, etiqueta } from './util.js';

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

// ---------- Faltas ----------

export async function abrirFaltas(codigoModulo, ev) {
  let r = D.porTipo('faltas').find((x) => x.modulo === codigoModulo && Number(x.ev) === Number(ev));
  if (!r) [r] = await D.guardar({ tipo: 'faltas', modulo: codigoModulo, ev: Number(ev), filas: {} });
  ir(`#/faltas/${r.id}`);
}

export function vistaFaltas(id) {
  const r = D.obtener(id);
  if (!r || r.tipo !== 'faltas') return marco('Faltas', '<p class="vacio">No encontrado.</p>', { volver: '#/notas', pestana: 'notas' });
  r.filas = r.filas || {};
  const m = modulo(r.modulo);
  const limite = N.limiteFaltas(m);

  marco(`Faltas · ${etiqueta(m.codigo)} · ${evTexto(r.ev)}`, `
    <div class="tarjeta">
      <p class="ayuda" style="margin:0">Horas de falta de la ${evTexto(r.ev)}, tal como salen en la plataforma. Límite del módulo: <strong>${fmt(limite)} h</strong> (${Math.round(m.pctFaltas * 100)} % de ${fmt(m.horas)} h), contando justificadas y sin justificar. Al pasarlo se pierde la evaluación continua: NE en esta evaluación y en las siguientes.</p>
      <p class="ayuda" style="margin:8px 0 0">Las horas sin justificar aparecen en la ficha de notas de cada alumno, junto al ajuste de actitud.</p>
    </div>
    <div class="tabla-notas"><table>
      <thead><tr><th>Alumno</th><th>Sin justificar (h)</th><th>Justificadas (h)</th><th>Acumulado</th><th>%</th></tr></thead>
      <tbody id="f-filas"></tbody>
    </table></div>
    <p class="estado-guardado" id="guardado">Se guarda solo.</p>
  `, { volver: '#/notas', pestana: 'notas', editable: true });

  const aviso = $('#guardado');
  const guardar = diferido(async () => { aviso.textContent = 'Guardando…'; await D.guardar(r); aviso.textContent = `Guardado ${ahoraTexto()}`; }, 600);

  function acumulado(clave) {
    // Lo guardado en las otras evaluaciones + lo que hay en pantalla para esta.
    const c = ctx();
    c.faltas = c.faltas.filter((x) => x.id !== r.id).concat([r]);
    return N.faltasHasta(m, r.ev, clave, c);
  }
  function celdas(clave) {
    const a = acumulado(clave);
    return `<td class="${a.supera ? 'bajo' : ''}">${fmt(a.total)} h${a.supera ? ' · NE' : ''}</td><td class="${a.supera ? 'bajo' : ''}">${fmt(a.pct * 100, 1)} %</td>`;
  }
  $('#f-filas').innerHTML = alumnosDe(m.grupo).map((a) => {
    const f = r.filas[a.clave] || {};
    return `<tr data-fila="${esc(a.clave)}"><th scope="row">${esc(a.clave)}</th>
      <td><input type="text" inputmode="decimal" class="nota" data-clave="${esc(a.clave)}" data-campo="injustificadas" value="${esc(f.injustificadas ?? '')}"></td>
      <td><input type="text" inputmode="decimal" class="nota" data-clave="${esc(a.clave)}" data-campo="justificadas" value="${esc(f.justificadas ?? '')}"></td>
      ${celdas(a.clave)}</tr>`;
  }).join('');
  $$('#f-filas input').forEach((inp) => inp.addEventListener('input', () => {
    const f = (r.filas[inp.dataset.clave] = r.filas[inp.dataset.clave] || {});
    const v = N.aNumero(inp.value);
    const valido = inp.value === '' || (v !== null && v >= 0);
    inp.classList.toggle('invalido', !valido);
    if (inp.value === '') delete f[inp.dataset.campo];
    else if (valido) f[inp.dataset.campo] = v;
    const tr = inp.closest('tr');
    tr.querySelectorAll('td:nth-last-child(-n+2)').forEach((td) => td.remove());
    tr.insertAdjacentHTML('beforeend', celdas(inp.dataset.clave));
    guardar();
  }));
  window.addEventListener('hashchange', () => { if (D.obtener(r.id)) guardar.ya(); }, { once: true });
}

// ---------- Nota final: resumen del módulo ----------

const FE_OPCIONES = [['', '—'], ['exento', 'Exento'], ['nocursa', 'No cursa']];

export function vistaFinal(codigoModulo) {
  const m = modulo(codigoModulo);
  if (!m) return marco('Nota final', '<p class="vacio">No encontrado.</p>', { volver: '#/notas', pestana: 'notas' });
  const c = ctx();
  const filas = alumnosDe(m.grupo).map((a) => ({ a, f: N.notaFinal(m, a.clave, c) }));
  const candidatos = filas.filter((x) => x.f.candidatoMH).sort((x, y) => (y.f.mediaRA ?? 0) - (x.f.mediaRA ?? 0));
  const maxMH = Math.max(1, Math.floor(filas.length * 0.1));
  marco(`Nota final · ${etiqueta(m.codigo)}`, `
    <div class="tarjeta">
      <p class="ayuda" style="margin:0">FC = Σ(RA definitivo × peso) + media de los ajustes de actitud. Si algún RA definitivo está por debajo de 5, el boletín de la FC no pasa de 4.
      Nota final = ${Math.round(m.pesoFC * 100)} % FC real + ${Math.round(m.pesoFE * 100)} % empresa, redondeada, con los casos A-F del apartado 9.3.
      ${m.grupo === 'G1' ? ' En 1.º la FC de junio es informativa (NE + nota): la nota final se pone al terminar la empresa en 2.º.' : ''}</p>
    </div>
    <div class="tabla-notas resumen"><table>
      <thead><tr><th>Alumno</th><th>Final</th><th>FC real</th><th>FC</th><th>Empresa</th><th>Caso</th><th>Propuesta</th><th>MH</th></tr></thead>
      <tbody>${filas.map(({ a, f }) => `<tr data-ir="#/final-alumno/${esc(m.codigo)}/${esc(a.clave)}">
        <th scope="row"><a href="#/final-alumno/${esc(m.codigo)}/${esc(a.clave)}">${esc(a.clave)}</a></th>
        <td><strong>${f.consignada ?? (f.propuesta !== null ? `<span class="sub" style="display:inline">${f.propuesta}?</span>` : '')}</strong></td>
        <td>${fmt(f.fcReal)}</td>
        <td class="${f.fcBoletin !== null && f.fcBoletin < 5 ? 'bajo' : ''}">${f.fcBoletin ?? (f.completa ? '—' : '<small>faltan RA</small>')}</td>
        <td>${f.fe === 'exento' ? 'Exento' : f.fe === 'nocursa' ? 'No cursa' : fmt(f.fe, 1)}</td>
        <td><small>${esc(f.caso && f.caso !== 'faltaFE' ? f.caso.replace('general', 'Gral.').replace('revisar', 'Revisar') : '')}</small></td>
        <td>${f.propuesta ?? '—'}</td>
        <td>${f.candidatoMH ? '★' : ''}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="ayuda">Final: la nota que has consignado; con «?», la propuesta aún sin consignar. Toca un alumno para poner recuperaciones, empresa y nota.</p>
    ${candidatos.length ? `<div class="mensaje info">Candidatos a mención honorífica (nota 10 sin RA recuperados), ordenados por la media de RA sin redondear: ${candidatos.map((x) => `${esc(x.a.clave)} (${fmt(x.f.mediaRA, 3)})`).join(', ')}. Máximo ${maxMH} en este grupo (10 %).</div>` : ''}
  `, { volver: '#/notas', pestana: 'notas' });
  $$('tr[data-ir]').forEach((tr) => tr.addEventListener('click', (ev) => { if (ev.target.tagName !== 'A') ir(tr.dataset.ir); }));
}

// ---------- Nota final: un alumno ----------

export function vistaFinalAlumno(codigoModulo, clave) {
  const m = modulo(codigoModulo);
  const a = alumno(clave);
  if (!m || !a) return marco('Nota final', '<p class="vacio">No encontrado.</p>', { volver: '#/notas', pestana: 'notas' });
  let reg = D.porTipo('final').find((x) => x.modulo === m.codigo);
  const fila = () => {
    reg.filas[clave] = reg.filas[clave] || {};
    return reg.filas[clave];
  };
  const actual = reg?.filas?.[clave] || {};
  const feValor = actual.fe ?? '';
  const feModo = feValor === 'exento' || feValor === 'nocursa' ? feValor : '';

  marco(`Final · ${clave} · ${etiqueta(m.codigo)}`, `
    <div class="tarjeta notas-cabecera" id="cab-final"></div>
    <div id="avisos-final"></div>
    <h2>Resultados de aprendizaje</h2>
    <div class="tabla-notas"><table>
      <thead><tr><th>RA</th><th>Peso</th><th>Nota</th><th>Recuperación</th><th>Definitiva</th></tr></thead>
      <tbody>${m.ra.map((r) => `<tr><th scope="row">${esc(r.codigo)} <small>${evTexto(r.ev)}</small></th><td>${Math.round(r.peso * 100)} %</td>
        <td data-orig="${esc(r.codigo)}"></td>
        <td><input type="text" inputmode="decimal" class="nota" data-rec="${esc(r.codigo)}" value="${esc(actual.rec?.[r.codigo] ?? '')}"></td>
        <td data-def="${esc(r.codigo)}"></td></tr>`).join('')}</tbody>
    </table></div>
    <p class="ayuda">La recuperación sustituye a la nota del RA, sin tope (de 1 a 10).</p>
    <h2>Empresa y nota final</h2>
    <div class="tarjeta formulario">
      <div class="rejilla-2">
        <label class="campo"><span>Situación en la empresa</span><select id="fe-modo">${FE_OPCIONES.map(([k, t]) => `<option value="${k}" ${k === feModo ? 'selected' : ''}>${k === '' ? 'Con nota' : t}</option>`).join('')}</select></label>
        <label class="campo" id="c-fe" ${feModo ? 'hidden' : ''}><span>Nota de empresa (0-10)</span><input type="text" inputmode="decimal" id="fe" value="${esc(feModo ? '' : feValor)}"></label>
      </div>
      <div id="propuesta"></div>
      <div class="rejilla-2">
        <label class="campo"><span>Nota que se consigna</span><input type="text" id="consignada" value="${esc(actual.consignada ?? '')}" placeholder="1-10 o NE"></label>
        <div class="campo"><span>&nbsp;</span><button class="boton secundario" type="button" id="b-usar">Usar la propuesta</button></div>
      </div>
      <label class="campo"><span>Observaciones</span><textarea id="obs" rows="2">${esc(actual.observaciones || '')}</textarea></label>
      <p class="estado-guardado" id="guardado"></p>
    </div>
  `, { volver: `#/final/${m.codigo}`, pestana: 'notas', editable: true });

  const aviso = $('#guardado');
  const guardar = diferido(async () => {
    aviso.textContent = 'Guardando…';
    await D.guardar(reg);
    aviso.textContent = `Guardado ${ahoraTexto()}`;
  }, 600);
  async function asegurar() {
    if (!reg) [reg] = await D.guardar({ tipo: 'final', modulo: m.codigo, filas: {} });
    reg.filas = reg.filas || {};
  }

  function repintar() {
    const c = ctx();
    if (reg) c.finales = c.finales.filter((x) => x.id !== reg.id).concat([reg]);
    const f = N.notaFinal(m, clave, c);
    $('#cab-final').innerHTML = `
      <div><span class="sub">FC real</span><strong class="grande">${fmt(f.fcReal)}</strong></div>
      <div><span class="sub">FC boletín</span><strong class="grande ${f.fcBoletin !== null && f.fcBoletin < 5 ? 'bajo' : ''}">${f.fcBoletin ?? '—'}</strong></div>
      <div><span class="sub">Final</span><strong class="grande">${f.consignada ?? f.propuesta ?? '—'}</strong></div>`;
    const avisos = [];
    if (!f.completa) avisos.push('<p class="mensaje aviso">Faltan RA sin nota: la fase de centro todavía no se puede calcular.</p>');
    if (f.raBajo) avisos.push('<p class="mensaje aviso">Hay algún RA definitivo por debajo de 5: la FC no puede pasar de 4.</p>');
    if (f.ajusteMedio) avisos.push(`<p class="mensaje info">Ajuste de actitud medio del curso: ${f.ajusteMedio > 0 ? '+' : ''}${fmt(f.ajusteMedio)}.</p>`);
    if (f.candidatoMH) avisos.push('<p class="mensaje info">Candidato a mención honorífica.</p>');
    $('#avisos-final').innerHTML = avisos.join('');
    for (const r of f.ras) {
      $(`[data-orig="${CSS.escape(r.codigo)}"]`).textContent = fmt(r.original);
      const def = $(`[data-def="${CSS.escape(r.codigo)}"]`);
      def.textContent = fmt(r.def);
      def.classList.toggle('bajo', r.def !== null && r.def < 5);
    }
    $('#propuesta').innerHTML = f.caso
      ? `<p class="mensaje ${['B', 'D', 'revisar'].includes(f.caso) ? 'aviso' : 'info'}"><strong>${esc(f.casoTexto)}.</strong> Propuesta: <strong>${f.propuesta ?? '—'}</strong>${['B', 'D'].includes(f.caso) ? '. Este caso pide tu decisión.' : ''}</p>`
      : '';
    $('#b-usar').disabled = f.propuesta === null;
    $('#b-usar').dataset.propuesta = f.propuesta ?? '';
  }

  $$('[data-rec]').forEach((inp) => inp.addEventListener('input', async () => {
    const v = N.aNumero(inp.value);
    const valido = inp.value === '' || (v !== null && v >= 1 && v <= 10);
    inp.classList.toggle('invalido', !valido);
    if (!valido) return;
    await asegurar();
    const fl = fila();
    fl.rec = fl.rec || {};
    if (inp.value === '') delete fl.rec[inp.dataset.rec]; else fl.rec[inp.dataset.rec] = v;
    repintar();
    guardar();
  }));
  $('#fe-modo').addEventListener('change', async (ev) => {
    await asegurar();
    const modo = ev.target.value;
    $('#c-fe').hidden = !!modo;
    if (modo) fila().fe = modo;
    else { const v = N.aNumero($('#fe').value); if (v === null) delete fila().fe; else fila().fe = v; }
    repintar();
    guardar();
  });
  $('#fe').addEventListener('input', async (ev) => {
    const v = N.aNumero(ev.target.value);
    const valido = ev.target.value === '' || (v !== null && v >= 0 && v <= 10);
    ev.target.classList.toggle('invalido', !valido);
    if (!valido) return;
    await asegurar();
    if (ev.target.value === '') delete fila().fe; else fila().fe = v;
    repintar();
    guardar();
  });
  $('#consignada').addEventListener('input', async (ev) => {
    const t = ev.target.value.trim().toUpperCase();
    const v = N.aNumero(t);
    const valido = t === '' || t === 'NE' || (v !== null && Number.isInteger(v) && v >= 1 && v <= 10);
    ev.target.classList.toggle('invalido', !valido);
    if (!valido) return;
    await asegurar();
    if (t === '') delete fila().consignada; else fila().consignada = t === 'NE' ? 'NE' : v;
    repintar();
    guardar();
  });
  $('#b-usar').addEventListener('click', async (ev) => {
    const p = ev.currentTarget.dataset.propuesta;
    if (!p) return;
    await asegurar();
    fila().consignada = p === 'NE' ? 'NE' : Number(p);
    $('#consignada').value = p;
    repintar();
    guardar();
  });
  $('#obs').addEventListener('input', async (ev) => { await asegurar(); fila().observaciones = ev.target.value; guardar(); });
  window.addEventListener('hashchange', () => { if (reg) guardar.ya(); }, { once: true });
  repintar();
}
