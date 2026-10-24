// Pantalla «Hacer grupos»: desde una práctica, una sesión o la lista de alumnos.
// Se guarda el último reparto de cada práctica/sesión para que el siguiente no repita parejas.
import * as D from './datos.js';
import { hacerGrupos, repetidas, parejas, tamanos } from './reparto.js';
import { esc, alumnosDe, grupo, hoyISO, fechaCorta, nombre, nombreCortoHTML } from './util.js';

let marco = null;
export function configurar(opciones) { marco = opciones.marco; }
const raiz = () => document.getElementById('app');
const $ = (sel) => raiz().querySelector(sel);
const $$ = (sel) => [...raiz().querySelectorAll(sel)];

// Estado de la pantalla mientras está abierta
let ultimaRuta = '';
let excluidos = new Set();
let modo = 'tam';
let numero = 4;
let elegido = null;

function ausentesDe(practica, sesion) {
  const fuera = new Set();
  for (const [c, f] of Object.entries(practica?.filas || {})) if (f.asiste) fuera.add(c);
  for (const [c, m] of Object.entries(sesion?.marcas || {})) if (m === 'ausente') fuera.add(c);
  return fuera;
}

const repartosDe = (g) => D.porTipo('agrupamiento').filter((x) => x.grupo === g)
  .sort((a, b) => `${b.fecha}|${b.creado}`.localeCompare(`${a.fecha}|${a.creado}`));

export function vistaGrupos(q) {
  const practica = q.p ? D.obtener(q.p) : null;
  const sesion = q.s ? D.obtener(q.s) : (practica?.sesion ? D.obtener(practica.sesion) : null);
  const g = q.g || practica?.grupo || sesion?.grupo || 'G1';
  const fecha = practica?.fecha || sesion?.fecha || hoyISO();
  const origen = practica ? { practica: practica.id } : sesion ? { sesion: sesion.id } : { suelto: fecha };
  const ruta = location.hash;
  if (ruta !== ultimaRuta) {
    ultimaRuta = ruta;
    excluidos = ausentesDe(practica, sesion);
    elegido = null;
  }
  const actual = repartosDe(g).find((x) => (practica && x.practica === practica.id) || (!practica && sesion && x.sesion === sesion.id) || (!practica && !sesion && x.suelto === fecha));
  if (actual && ruta === ultimaRuta && !q._) { modo = actual.modo || modo; numero = actual.n || numero; }
  const anterior = repartosDe(g).find((x) => x !== actual && `${x.fecha}|${x.creado}` < `${fecha}|${actual?.creado || '~'}`);
  const alumnos = alumnosDe(g);
  const disponibles = alumnos.filter((a) => !excluidos.has(a.clave)).map((a) => a.clave);
  const volver = practica ? `#/practica/${practica.id}` : sesion ? `#/sesion/${sesion.id}` : '#/alumnos';
  const rep = actual && anterior ? repetidas(actual.grupos, parejas(anterior.grupos)) : 0;

  marco(`Grupos · ${grupo(g)?.nombre || g}`, `
    <div class="tarjeta">
      <div class="sub">${esc(practica ? 'Práctica' : sesion ? 'Sesión' : 'Grupos')} del ${esc(fechaCorta(fecha))}</div>
      <div class="segmentos">
        <a href="#" data-modo="tam" class="${modo === 'tam' ? 'activo' : ''}">Personas por grupo</a>
        <a href="#" data-modo="num" class="${modo === 'num' ? 'activo' : ''}">Número de grupos</a>
      </div>
      <div class="contador">
        <button type="button" class="boton secundario" data-mas="-1" aria-label="Menos">−</button>
        <input type="number" id="g-n" min="1" max="${alumnos.length}" inputmode="numeric" value="${numero}" aria-label="${modo === 'tam' ? 'Personas por grupo' : 'Número de grupos'}">
        <button type="button" class="boton secundario" data-mas="1" aria-label="Más">+</button>
      </div>
      <p class="ayuda" id="g-previa" style="margin:0"></p>
      <details class="quien">
        <summary>${disponibles.length} alumnos${excluidos.size ? ` · fuera: ${excluidos.size}` : ''} · cambiar</summary>
        <div class="rejilla-marcar">${alumnos.map((a) => `<label><input type="checkbox" data-quien="${esc(a.clave)}" ${excluidos.has(a.clave) ? '' : 'checked'}> ${nombreCortoHTML(a.clave)}</label>`).join('')}</div>
        <p class="ayuda" style="margin:6px 0 0">Los que tienen falta en la práctica o «no estaba» en la sesión salen desmarcados.</p>
      </details>
      <button type="button" class="boton" id="b-hacer">${actual ? 'Hacer otros grupos' : 'Hacer grupos'}</button>
    </div>
    ${actual ? `
      <p class="ayuda">${anterior ? (rep ? `Repite ${rep} pareja${rep > 1 ? 's' : ''} de los grupos del ${esc(fechaCorta(anterior.fecha))} (no había otra forma).` : `Ninguna pareja repetida de los grupos del ${esc(fechaCorta(anterior.fecha))}.`) : 'Primer reparto de esta clase.'} Para cambiar a alguien de grupo: tócalo y luego toca «Pasar aquí» en el otro grupo.</p>
      <div class="lista-grupos">${actual.grupos.map((gr, i) => `
        <div class="tarjeta grupo-alumnos">
          <div class="grupo-cab"><strong>Grupo ${i + 1}</strong><span class="sub">${gr.length}</span>${elegido && !gr.includes(elegido) ? `<button type="button" class="enlace" data-aqui="${i}">Pasar aquí</button>` : ''}</div>
          <ul>${gr.map((c) => `<li><button type="button" class="miembro ${elegido === c ? 'elegido' : ''}" data-miembro="${esc(c)}">${nombreCortoHTML(c)}</button></li>`).join('')}</ul>
        </div>`).join('')}</div>
      <div class="botones dos">
        <button type="button" class="boton secundario" id="b-copiar">Copiar los grupos</button>
        <button type="button" class="boton peligro" id="b-quitar">Borrar estos grupos</button>
      </div>
      <p class="ayuda" id="g-copiado"></p>` : ''}
  `, { volver, pestana: practica || sesion ? 'diario' : 'alumnos' });

  const previa = () => {
    const n = Math.max(1, Number($('#g-n').value) || 1);
    const total = disponibles.length;
    if (!total) { $('#g-previa').textContent = 'No hay alumnos marcados.'; return; }
    const numG = tamanos(total, modo, n).length;
    const base = Math.floor(total / numG);
    const resto = total % numG;
    $('#g-previa').textContent = `${total} alumnos → ${numG} grupo${numG > 1 ? 's' : ''}: ${resto ? `${resto} de ${base + 1} y ${numG - resto} de ${base}` : `de ${base}`}.`;
  };
  previa();

  $$('[data-modo]').forEach((b) => b.addEventListener('click', (ev) => { ev.preventDefault(); modo = b.dataset.modo; vistaGrupos({ ...q, _: 1 }); }));
  $$('[data-mas]').forEach((b) => b.addEventListener('click', () => {
    const inp = $('#g-n');
    inp.value = Math.max(1, Math.min(alumnos.length, (Number(inp.value) || 1) + Number(b.dataset.mas)));
    numero = Number(inp.value);
    previa();
  }));
  $('#g-n').addEventListener('input', () => { numero = Math.max(1, Number($('#g-n').value) || 1); previa(); });
  $$('[data-quien]').forEach((c) => c.addEventListener('change', () => {
    if (c.checked) excluidos.delete(c.dataset.quien); else excluidos.add(c.dataset.quien);
    const abierto = $('details.quien').open;
    vistaGrupos({ ...q, _: 1 });
    if (abierto) $('details.quien').open = true;
  }));
  $('#b-hacer').addEventListener('click', async () => {
    if (!disponibles.length) return;
    const r = hacerGrupos(disponibles, modo, numero, anterior ? anterior.grupos : []);
    const reg = actual || { tipo: 'agrupamiento', grupo: g, fecha, ...origen };
    Object.assign(reg, { modo, n: numero, grupos: r.grupos });
    elegido = null;
    await D.guardar(reg);
    vistaGrupos({ ...q, _: 1 });
  });
  $$('[data-miembro]').forEach((b) => b.addEventListener('click', () => {
    elegido = elegido === b.dataset.miembro ? null : b.dataset.miembro;
    vistaGrupos({ ...q, _: 1 });
  }));
  $$('[data-aqui]').forEach((b) => b.addEventListener('click', async () => {
    const destino = Number(b.dataset.aqui);
    actual.grupos = actual.grupos.map((gr) => gr.filter((c) => c !== elegido));
    actual.grupos[destino].push(elegido);
    actual.grupos = actual.grupos.filter((gr) => gr.length);
    elegido = null;
    await D.guardar(actual);
    vistaGrupos({ ...q, _: 1 });
  }));
  $('#b-copiar')?.addEventListener('click', async () => {
    const texto = actual.grupos.map((gr, i) => `Grupo ${i + 1}: ${gr.map((c) => nombre(c)).join('; ')}`).join('\n');
    try { await navigator.clipboard.writeText(texto); $('#g-copiado').textContent = 'Copiados. Puedes pegarlos donde quieras.'; } catch { $('#g-copiado').textContent = 'No se han podido copiar en este aparato.'; }
  });
  $('#b-quitar')?.addEventListener('click', async () => {
    if (!confirm('¿Borrar estos grupos?')) return;
    await D.borrar(actual.id);
    vistaGrupos({ ...q, _: 1 });
  });
}

// Enlace para otras pantallas: «Hacer grupos» o «Ver grupos» si ya hay.
export function botonGrupos({ practica, sesion }) {
  const hay = D.porTipo('agrupamiento').some((x) => (practica && x.practica === practica.id) || (!practica && sesion && x.sesion === sesion.id));
  const href = practica ? `#/grupos?p=${encodeURIComponent(practica.id)}` : `#/grupos?s=${encodeURIComponent(sesion.id)}`;
  return `<a class="boton secundario" href="${href}">${hay ? 'Ver los grupos' : 'Hacer grupos'}</a>`;
}
