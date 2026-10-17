// Nombres de alumnos: importación desde Excel en el propio aparato. Los nombres se guardan cifrados.
// Se ordenan por primer apellido, segundo apellido y nombre, y se asignan a las claves por orden:
// el primero en orden alfabético a la clave n.º 1 del grupo, el segundo a la n.º 2, etc.
import * as D from './datos.js';
import { esc, grupos, alumnosDe, nombreCompleto, compararNombres, ir } from './util.js';
import { cargarSheetJS } from './exportar.js';

let marco = null;
export function configurar(opciones) {
  marco = opciones.marco;
}
const raiz = () => document.getElementById('app');
const $ = (sel) => raiz().querySelector(sel);
const $$ = (sel) => [...raiz().querySelectorAll(sel)];

let leidas = null; // hojas leídas del último Excel, pendientes de asignar

const norm = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function grupoPorTitulo(titulo) {
  const t = norm(titulo);
  if (/(^|\D)1(\D|$)|primero|1\.?º|1º/.test(t)) return 'G1';
  if (/(^|\D)2(\D|$)|segundo|2\.?º|2º/.test(t)) return 'G2';
  return '';
}

export async function leerExcel(archivo) {
  const XLSX = await cargarSheetJS();
  const libro = XLSX.read(await archivo.arrayBuffer(), { type: 'array' });
  const hojas = [];
  for (const nombreHoja of libro.SheetNames) {
    const filas = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { header: 1, defval: '' });
    const iCab = filas.findIndex((f) => f.some((c) => /apellido\s*1|primer\s*apellido/.test(norm(c))));
    if (iCab < 0) continue;
    const cab = filas[iCab].map(norm);
    const col = (re) => cab.findIndex((c) => re.test(c));
    const c1 = col(/apellido\s*1|primer\s*apellido/);
    const c2 = col(/apellido\s*2|segundo\s*apellido/);
    const cn = col(/^nombre/);
    const alumnos = filas.slice(iCab + 1)
      .map((f) => ({ apellido1: String(f[c1] ?? '').trim(), apellido2: c2 >= 0 ? String(f[c2] ?? '').trim() : '', nombre: cn >= 0 ? String(f[cn] ?? '').trim() : '' }))
      .filter((a) => a.apellido1 || a.nombre);
    if (!alumnos.length) continue;
    const titulo = [nombreHoja, ...filas.slice(0, iCab).flat()].join(' ');
    hojas.push({ hoja: nombreHoja.trim(), grupo: grupoPorTitulo(nombreHoja) || grupoPorTitulo(titulo), alumnos: alumnos.sort(compararNombres) });
  }
  return hojas;
}

function datosApuntados() {
  const tipos = ['sesion', 'practica', 'calificacion', 'anotacion', 'charla', 'libreta', 'faltas', 'final', 'ajuste'];
  return tipos.reduce((n, t) => n + D.porTipo(t).length, 0);
}

// Asigna los nombres de una lista ya ordenada a las claves del grupo, por orden.
export async function asignar(codigoGrupo, lista) {
  const todos = D.porTipo('alumno').filter((a) => a.grupo === codigoGrupo).sort((a, b) => a.orden - b.orden);
  const prefijo = (todos[0]?.clave || (codigoGrupo === 'G1' ? 'ALUPRIGASA1' : 'ALUSEGGASA1')).replace(/\d+$/, '');
  const cambios = [];
  lista.forEach((n, i) => {
    let a = todos[i];
    if (!a) {
      a = { tipo: 'alumno', clave: `${prefijo}${i + 1}`, grupo: codigoGrupo, orden: i + 1, curso: todos[0]?.curso };
    }
    Object.assign(a, { apellido1: n.apellido1, apellido2: n.apellido2, nombre: n.nombre, activo: true });
    cambios.push(a);
  });
  // Si la lista es más corta, las claves sobrantes quedan sin nombre y de baja.
  for (const a of todos.slice(lista.length)) {
    Object.assign(a, { apellido1: '', apellido2: '', nombre: '', activo: false });
    cambios.push(a);
  }
  await D.guardar(cambios);
  return cambios.length;
}

export function vistaNombres(mensaje) {
  const resumen = grupos().map((g) => {
    const al = alumnosDe(g.codigo);
    const con = al.filter((a) => nombreCompleto(a)).length;
    return `<li class="item"><span class="crece">${esc(g.nombre)}</span><span class="chip ${con === al.length ? '' : 'neutro'}">${con} de ${al.length} con nombre</span></li>`;
  }).join('');
  const apuntados = datosApuntados();

  marco('Nombres de alumnos', `
    ${mensaje ? `<div class="mensaje ${mensaje.tipo}">${esc(mensaje.texto)}</div>` : ''}
    <div class="tarjeta"><ul class="lista">${resumen}</ul></div>
    <h2>Importar desde Excel</h2>
    <div class="tarjeta">
      <p class="ayuda" style="margin:0 0 10px">Elige el Excel con una hoja por curso y las columnas «Apellido 1», «Apellido 2» y «Nombre». Se lee en este aparato y no se envía a ningún sitio: los nombres se guardan cifrados. Se ordenan por primer apellido, segundo apellido y nombre, y se asignan a las claves en ese orden.</p>
      <label class="boton secundario" style="cursor:pointer">Elegir archivo Excel<input type="file" id="archivo" accept=".xlsx,.xls" hidden></label>
      <div id="vista-previa"></div>
    </div>
    ${apuntados ? `<p class="mensaje aviso">Ya tienes ${apuntados} registros apuntados. Siguen unidos a su clave: si cambias qué nombre corresponde a cada clave, esos datos pasarán a mostrarse con el nombre nuevo.</p>` : ''}
    <p class="ayuda">Para corregir un nombre suelto, entra en la ficha del alumno y usa «Editar nombre». El botón «Nombres / Claves» de arriba oculta los nombres al momento, por ejemplo para usar la app delante de la clase.</p>
  `, { volver: '#/ajustes', pestana: 'ajustes', editable: true });

  $('#archivo').addEventListener('change', async (ev) => {
    const archivo = ev.target.files?.[0];
    if (!archivo) return;
    $('#vista-previa').innerHTML = '<p class="vacio">Leyendo…</p>';
    try {
      leidas = await leerExcel(archivo);
    } catch (e) {
      $('#vista-previa').innerHTML = `<p class="mensaje error">No se ha podido leer el archivo: ${esc(e.message)}</p>`;
      return;
    }
    pintarVistaPrevia();
  });
}

function pintarVistaPrevia() {
  if (!leidas?.length) {
    $('#vista-previa').innerHTML = '<p class="mensaje error">No he encontrado ninguna hoja con las columnas «Apellido 1» y «Nombre».</p>';
    return;
  }
  $('#vista-previa').innerHTML = `
    ${leidas.map((h, i) => {
      const actuales = h.grupo ? alumnosDe(h.grupo).length : 0;
      return `<div class="hoja-importar">
        <div class="fila"><strong class="crece">Hoja «${esc(h.hoja)}» · ${h.alumnos.length} alumnos</strong></div>
        <label class="campo" style="margin:8px 0"><span>Asignar a</span><select data-hoja="${i}">
          <option value="">No importar</option>
          ${grupos().map((g) => `<option value="${esc(g.codigo)}" ${g.codigo === h.grupo ? 'selected' : ''}>${esc(g.nombre)}</option>`).join('')}
        </select></label>
        ${h.grupo && actuales && actuales !== h.alumnos.length ? `<p class="mensaje aviso">El grupo tiene ${actuales} claves y la hoja ${h.alumnos.length} alumnos: ${h.alumnos.length > actuales ? 'se crearán claves nuevas' : 'las claves sobrantes quedarán de baja'}.</p>` : ''}
        <ol class="previa">${h.alumnos.slice(0, 3).map((a) => `<li>${esc(nombreCompleto(a))}</li>`).join('')}${h.alumnos.length > 3 ? '<li>…</li>' : ''}</ol>
      </div>`;
    }).join('')}
    <button class="boton" type="button" id="b-asignar">Asignar nombres a las claves</button>`;
  $$('[data-hoja]').forEach((s) => s.addEventListener('change', () => { leidas[Number(s.dataset.hoja)].grupo = s.value; pintarVistaPrevia(); }));
  $('#b-asignar').addEventListener('click', async () => {
    const elegidas = leidas.filter((h) => h.grupo);
    const repetidos = elegidas.map((h) => h.grupo).filter((g, i, arr) => arr.indexOf(g) !== i);
    if (!elegidas.length) return;
    if (repetidos.length) { alert('Has asignado dos hojas al mismo grupo.'); return; }
    if (!confirm(`Se asignarán los nombres de ${elegidas.length} hoja(s), en orden alfabético, a las claves de cada grupo. ¿Seguir?`)) return;
    let n = 0;
    for (const h of elegidas) n += await asignar(h.grupo, h.alumnos);
    leidas = null;
    vistaNombres({ tipo: 'info', texto: `Hecho: ${n} alumnos actualizados. Se sincronizarán cifrados con tus otros aparatos.` });
  });
}

export { ir };
