// Uso de CIFEAFARM: trae el informe de uso de cada alumno (app de las granjas) y crea una
// calificación con la propuesta de nota del CE elegido, que Luis ajusta a mano.
// La cuenta de CIFEAFARM (correo y contraseña de administrador) se guarda cifrada como un registro más («cifeafarm»).
import * as D from './datos.js';
import { CIFEAFARM_URL, CIFEAFARM_CLAVE_PUBLICA, CIFEAFARM_CE } from './config.js';
import * as U from './uso.js';
import { esc, hoyISO, modulo, grupo, alumnosDe, etiqueta, nombreHTML, ir, evTexto } from './util.js';

let marco = null;
export function configurar(opciones) { marco = opciones.marco; }

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const conf = () => D.uno('cifeafarm');
const estado = {}; // por curso: { desde, hasta, filas, diasRef, error }

async function leerInforme(c, desde, hasta) {
  if (!window.supabase) throw new Error('No se ha cargado la librería de Supabase.');
  const sb = window.supabase.createClient(CIFEAFARM_URL, CIFEAFARM_CLAVE_PUBLICA, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'diaclashom-cifeafarm' },
  });
  const ini = await sb.auth.signInWithPassword({ email: c.correo, password: c.contrasena });
  if (ini.error) throw new Error(/invalid/i.test(ini.error.message) ? 'El correo o la contraseña de CIFEAFARM no son correctos.' : ini.error.message);
  try {
    const { data, error } = await sb.rpc('informe_uso', { desde, hasta });
    if (error) {
      if (/informe_uso|function|schema cache/i.test(error.message || '')) throw new Error('Falta ejecutar en el Supabase de CIFEAFARM el archivo sql/14_informe_uso.sql.');
      if (/administrador/i.test(error.message || '')) throw new Error('Esa cuenta de CIFEAFARM no es la de administrador.');
      throw new Error(error.message);
    }
    return data || [];
  } finally { sb.auth.signOut().catch(() => {}); }
}

// Calendario escolar: el importado en la app o, si no hay, el incluido en datos/
let incluido = null;
async function eventosEscolares() {
  const propio = D.uno('calEscolar');
  if (propio?.eventos) return propio.eventos;
  if (!incluido) { try { const r = await fetch('datos/calendario-horarios-2026-2027.json'); incluido = r.ok ? await r.json() : {}; } catch (_) { incluido = {}; } }
  return incluido?.calendarioEscolar?.eventos || [];
}
let eventosCache = [];
function periodoPorDefecto(x) {
  const m = modulo(x.modulo); const ce = m.ce.find((c) => c.codigo === x.ce);
  const eventos = eventosCache;
  const p = U.periodoEvaluacion(eventos, x.grupo, ce?.ev) || U.periodoEvaluacion(eventos, x.grupo, (ce?.ev || 1) - 1);
  const hoy = hoyISO();
  if (!p) return { desde: `${hoy.slice(0, 4)}-09-01`, hasta: hoy };
  return { desde: p.desde, hasta: p.hasta < hoy ? p.hasta : hoy };
}

export async function vistaCifeafarm(mensaje) {
  if (!eventosCache.length) eventosCache = await eventosEscolares();
  const c = conf();
  const tarjetaCE = (x) => {
    const m = modulo(x.modulo); const ce = m?.ce.find((y) => y.codigo === x.ce);
    if (!m || !ce) return '';
    const st = (estado[x.curso] = estado[x.curso] || periodoPorDefecto(x));
    const alumnos = alumnosDe(x.grupo);
    const mapa = (c?.mapa || {})[x.grupo] || {};
    const porAlias = Object.fromEntries((st.filas || []).map((f) => [f.alias, f]));
    const filaDe = (clave) => { const a = Object.keys(mapa).find((k) => mapa[k] === clave); return a ? porAlias[a] : null; };
    const sinPareja = (st.filas || []).filter((f) => !mapa[f.alias] || !alumnos.some((a) => a.clave === mapa[f.alias]));
    const previa = D.porTipo('calificacion').find((k) => k.instrumento === 'USO' && k.modulo === x.modulo && (k.ces || []).includes(x.ce) && k.desde === st.desde && k.hasta === st.hasta);
    return `<section class="tarjeta" data-curso="${x.curso}">
      <div class="titulo">${esc(grupo(x.grupo)?.nombre || x.grupo)} · ${esc(etiqueta(x.modulo))} · CE ${esc(x.ce)} · ${evTexto(ce.ev)}</div>
      <p class="sub" style="margin:4px 0 10px">${esc(ce.texto)} (${esc(ce.instrumento)})</p>
      <div class="rejilla-2">
        <label class="campo"><span>Desde</span><input type="date" data-f="desde" value="${esc(st.desde)}"></label>
        <label class="campo"><span>Hasta</span><input type="date" data-f="hasta" value="${esc(st.hasta)}"></label>
      </div>
      <div class="botones"><button class="boton" type="button" data-traer ${c ? '' : 'disabled'}>Traer datos de CIFEAFARM</button></div>
      ${st.error ? `<div class="mensaje error">${esc(st.error)}</div>` : ''}
      ${st.filas ? `
        <label class="campo"><span>Días de referencia</span><input type="number" min="1" inputmode="numeric" data-f="diasRef" value="${esc(st.diasRef)}">
          <span class="ayuda">Días en que algún alumno de ${esc(grupo(x.grupo)?.nombre || '')} trabajó en la granja con la app (${st.diasGrupo}). Cámbialo si quieres comparar con otro número, por ejemplo los días de prácticas en la granja.</span></label>
        <p class="ayuda">Propuesta = 10 × (días del alumno / días de referencia, como mucho 1) × (1 − registros corregidos por otros / registros, como poco 0,5). Sin nada en la app: 0. Las entradas no cuentan.</p>
        <div class="tabla-notas"><table><thead><tr><th>Alumno</th><th>Alias en CIFEAFARM</th><th>Días</th><th>Registros</th><th>Tareas</th><th>Corregidos</th><th>Entradas</th><th>Propuesta</th></tr></thead><tbody>
          ${alumnos.map((a) => { const f = filaDe(a.clave); const pr = f ? U.propuesta(f, st.diasRef) : null;
            return `<tr><th scope="row">${nombreHTML(a.clave)}</th>
              <td><select data-pareja="${esc(a.clave)}" aria-label="Alias de ${esc(a.clave)}"><option value="">—</option>${(st.filas || []).map((g) => `<option value="${esc(g.alias)}" ${mapa[g.alias] === a.clave ? 'selected' : ''}>${esc(g.alias)}</option>`).join('')}</select></td>
              <td>${f ? f.dias : ''}</td><td>${f ? f.registros : ''}</td><td>${f ? f.tareas : ''}</td><td>${f ? f.corregidos : ''}</td><td>${f ? f.entradas : ''}</td><td><strong>${pr === null ? '—' : String(pr).replace('.', ',')}</strong></td></tr>`; }).join('')}
        </tbody></table></div>
        ${sinPareja.length ? `<p class="mensaje aviso">Alias de CIFEAFARM sin alumno: ${sinPareja.map((f) => esc(f.alias)).join(', ')}. Elígelos en la columna «Alias en CIFEAFARM».</p>` : ''}
        <div class="botones"><button class="boton" type="button" data-crear>${previa ? 'Actualizar la calificación de estas fechas' : 'Crear la calificación con estas propuestas'}</button>
          ${previa ? `<a class="boton secundario" href="#/calificacion/${esc(previa.id)}">Abrir la que ya hay</a>` : ''}</div>
        <p class="ayuda">Se crea una calificación «Uso de CIFEAFARM» del CE ${esc(x.ce)} con la propuesta de cada alumno y el resumen en el comentario. Ahí la ajustas a mano: cuenta como una nota más del CE.</p>` : ''}
    </section>`;
  };
  marco('Uso de CIFEAFARM', `
    ${mensaje ? `<div class="mensaje ${mensaje.tipo}">${esc(mensaje.texto)}</div>` : ''}
    <div class="tarjeta"><p class="ayuda" style="margin:0">Trae de CIFEAFARM cuánto ha trabajado cada alumno en la app de las granjas y propone una nota para el CE de registros. Tú la revisas y la cambias. Solo se leen datos de uso, con tu cuenta de administrador de CIFEAFARM, que se guarda cifrada en DIACLASHOM.</p></div>
    <h2>Cuenta de CIFEAFARM</h2>
    <form id="f-cifea" class="formulario tarjeta" autocomplete="off">
      ${c ? `<p style="margin:0 0 8px">Conectado como <strong>${esc(c.correo)}</strong>.</p>` : ''}
      <label class="campo"><span>Correo de administrador de CIFEAFARM</span><input type="email" name="correo" value="${esc(c?.correo || '')}" required autocomplete="off"></label>
      <label class="campo"><span>Contraseña</span><input type="password" name="contrasena" ${c ? 'placeholder="(la guardada)"' : 'required'} autocomplete="new-password"></label>
      <div class="botones"><button class="boton ${c ? 'secundario' : ''}" type="submit">${c ? 'Cambiar cuenta' : 'Guardar y probar'}</button>${c ? '<button class="boton peligro" type="button" id="b-desconectar">Desconectar</button>' : ''}</div>
    </form>
    <h2>Propuesta de nota</h2>
    ${CIFEAFARM_CE.map(tarjetaCE).join('')}
  `, { volver: '#/ajustes', pestana: 'ajustes', editable: true });

  $('#f-cifea').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target); const correo = String(fd.get('correo') || '').trim(); const contrasena = String(fd.get('contrasena') || '') || c?.contrasena || '';
    if (!correo || !contrasena) return vistaCifeafarm({ tipo: 'error', texto: 'Escribe el correo y la contraseña.' });
    const b = ev.target.querySelector('button[type=submit]'); b.disabled = true; b.textContent = 'Probando…';
    try {
      const filas = await leerInforme({ correo, contrasena }, hoyISO(), hoyISO());
      const r = c || { tipo: 'cifeafarm', mapa: {} }; r.correo = correo; r.contrasena = contrasena;
      await D.guardar(r);
      vistaCifeafarm({ tipo: 'info', texto: `Conectado con CIFEAFARM: ${filas.length} alumnos.` });
    } catch (e) { vistaCifeafarm({ tipo: 'error', texto: e.message }); }
  });
  $('#b-desconectar')?.addEventListener('click', async () => {
    if (!confirm('¿Desconectar CIFEAFARM? Se borra la cuenta guardada aquí. Las calificaciones ya creadas no se tocan.')) return;
    await D.borrar(c.id); vistaCifeafarm({ tipo: 'info', texto: 'Desconectado.' });
  });
  for (const caja of $$('section[data-curso]')) {
    const x = CIFEAFARM_CE.find((y) => String(y.curso) === caja.dataset.curso); const st = estado[x.curso];
    caja.querySelectorAll('[data-f]').forEach((i) => i.addEventListener('change', () => {
      if (i.dataset.f === 'diasRef') { st.diasRef = Math.max(1, Number(i.value) || st.diasGrupo || 1); vistaCifeafarm(); return; }
      st[i.dataset.f] = i.value; st.filas = null; st.error = null; vistaCifeafarm();
    }));
    caja.querySelector('[data-traer]')?.addEventListener('click', async (ev) => {
      const b = ev.currentTarget; b.disabled = true; b.textContent = 'Leyendo CIFEAFARM…';
      try {
        if (!st.desde || !st.hasta || st.desde > st.hasta) throw new Error('Revisa las fechas.');
        const todas = await leerInforme(conf(), st.desde, st.hasta);
        st.filas = todas.filter((f) => Number(f.curso) === x.curso);
        st.diasGrupo = Math.max(0, ...st.filas.map((f) => f.dias_grupo || 0));
        st.diasRef = st.diasGrupo || 1; st.error = null;
        // Primer emparejamiento: por orden (luego se puede cambiar a mano)
        const r = conf(); r.mapa = r.mapa || {};
        r.mapa[x.grupo] = U.emparejarPorOrden(st.filas.map((f) => f.alias), alumnosDe(x.grupo).map((a) => a.clave), r.mapa[x.grupo] || {});
        await D.guardar(r);
      } catch (e) { st.error = e.message; }
      vistaCifeafarm();
    });
    caja.querySelectorAll('[data-pareja]').forEach((s) => s.addEventListener('change', async () => {
      const r = conf(); const m = (r.mapa[x.grupo] = r.mapa[x.grupo] || {});
      for (const [a, cl] of Object.entries(m)) if (cl === s.dataset.pareja) delete m[a];
      if (s.value) m[s.value] = s.dataset.pareja;
      await D.guardar(r); vistaCifeafarm();
    }));
    caja.querySelector('[data-crear]')?.addEventListener('click', async () => {
      const mapa = (conf().mapa || {})[x.grupo] || {}; const porAlias = Object.fromEntries(st.filas.map((f) => [f.alias, f]));
      const filas = {};
      for (const a of alumnosDe(x.grupo)) {
        const alias = Object.keys(mapa).find((k) => mapa[k] === a.clave); const f = alias ? porAlias[alias] : null;
        if (!f) continue;
        const pr = U.propuesta(f, st.diasRef);
        filas[a.clave] = { notas: pr === null ? {} : { [x.ce]: pr }, comentario: `CIFEAFARM (${alias}): ${U.resumen(f, st.diasRef)}`, uso: f };
      }
      let k = D.porTipo('calificacion').find((y) => y.instrumento === 'USO' && y.modulo === x.modulo && (y.ces || []).includes(x.ce) && y.desde === st.desde && y.hasta === st.hasta);
      if (k && !confirm('Ya hay una calificación del uso de CIFEAFARM de estas fechas. Si la actualizas, se sustituyen sus notas (también las que hayas ajustado a mano). ¿Seguir?')) return;
      const m = modulo(x.modulo); const ev = m.ce.find((y) => y.codigo === x.ce)?.ev;
      k = k || { tipo: 'calificacion', instrumento: 'USO', modulo: x.modulo, ces: [x.ce], sesion: '', ut: m.ce.find((y) => y.codigo === x.ce)?.ut || '' };
      Object.assign(k, { titulo: `Uso de CIFEAFARM · ${evTexto(ev)}`, fecha: st.hasta, desde: st.desde, hasta: st.hasta, diasRef: st.diasRef, filas });
      const [g] = await D.guardar(k);
      ir(`#/calificacion/${g.id}`);
    });
  }
}
