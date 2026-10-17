// Exportación a Excel. Se genera en el aparato con SheetJS (vendor/xlsx-0.18.5.full.min.js); no sale nada a la red.
// Cada hoja es una tabla de «una fila por registro», con filtros, para ordenar y filtrar en Excel.
import * as D from './datos.js';
import * as N from './notas.js';
import { modulo, modulos, alumnosDe, alumno, grupo, listas, etiqueta, etiquetas, hoyISO, nombreCompleto } from './util.js';
import { TIPOS_SESION, MARCAS } from './diario.js';

let cargando = null;
let conNombres = false;
const al = (clave) => (clave && conNombres ? nombreCompleto(alumno(clave)) || clave : clave);
export function cargarSheetJS() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (!cargando) {
    cargando = new Promise((resolver, rechazar) => {
      const s = document.createElement('script');
      s.src = 'vendor/xlsx-0.18.5.full.min.js';
      s.onload = () => resolver(window.XLSX);
      s.onerror = () => { cargando = null; rechazar(new Error('No se ha podido cargar el generador de Excel.')); };
      document.head.appendChild(s);
    });
  }
  return cargando;
}

const r2 = (v) => (v === null || v === undefined || v === '' ? '' : Math.round(Number(v) * 100) / 100);
const fecha = (iso) => iso || '';
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const serialExcel = (iso) => { const [y, m, d] = iso.split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };
const nombreTipo = (t) => (TIPOS_SESION.find((x) => x[0] === t) || ['', t || ''])[1];
const nombreMarca = (k) => (MARCAS.find((x) => x[0] === k) || ['', k])[1];
const VALORACIONES = ['', 'Mal', 'Regular', 'Bien', 'Muy bien', 'Excelente'];
const porFecha = (a, b) => String(a.fecha || '').localeCompare(String(b.fecha || ''));
const ceDe = (codigoModulo, codigoCE) => modulo(codigoModulo)?.ce.find((c) => c.codigo === codigoCE);

export function construirHojas(opciones = {}) {
  conNombres = !!opciones.conNombres;
  const ctx = N.contexto(D.porTipo, listas());
  const items = listas().encargadoItems || [];
  const apartados = listas().libretaApartados || [];
  const sesiones = D.porTipo('sesion').sort(porFecha);
  const hojas = [];

  hojas.push(['Sesiones', sesiones.map((s) => {
    const m = Object.entries(s.marcas || {});
    const de = (k) => m.filter(([, v]) => v === k).map(([c]) => c).join(', ');
    return {
      Fecha: fecha(s.fecha), Inicio: s.inicio || '', Fin: s.fin || '', Grupo: grupo(s.grupo)?.nombre || '', 'Módulos': etiquetas(s.modulos),
      Tipo: nombreTipo(s.clase), Lugar: s.lugar || '', UT: s.ut || '', 'CE trabajados': (s.ces || []).map((c) => `${c.modulo} ${c.codigo}`).join(', '),
      'Qué se ha hecho': s.diario || '', 'Cómo ha ido': VALORACIONES[s.valoracion] || '', Comentario: s.comoFue || '', 'Para el año que viene': s.cambios || '',
      Destacan: de('destaca'), 'Comportamiento': de('mal'), 'No estaban': de('ausente'),
    };
  })]);

  const marcas = [];
  for (const s of sesiones) for (const [clave, k] of Object.entries(s.marcas || {})) {
    marcas.push({ Fecha: fecha(s.fecha), 'Módulos': etiquetas(s.modulos), Tipo: nombreTipo(s.clase), UT: s.ut || '', Alumno: al(clave), Marca: nombreMarca(k) });
  }
  hojas.push(['Marcas en clase', marcas]);

  // Todas las notas puestas, una fila por alumno, CE y día.
  const notas = [];
  const encargado = [];
  for (const p of D.porTipo('practica').sort(porFecha)) {
    for (const [clave, f] of Object.entries(p.filas || {})) {
      const nEnc = f.rol === 'encargado' ? N.notaEncargado(f.items) : null;
      if (f.rol === 'encargado') {
        const fila = { Fecha: fecha(p.fecha), 'Módulos': etiquetas(p.modulos), CE: (p.ces || []).map((c) => `${c.modulo} ${c.codigo}`).join(', '), Alumno: al(clave) };
        items.forEach((it, i) => { fila[String(it).split(/[ .]/)[0]] = r2(f.items?.[i]); });
        fila.Media = r2(nEnc);
        encargado.push(fila);
      }
      for (const c of p.ces || []) {
        const ce = ceDe(c.modulo, c.codigo);
        let nota = '';
        let peso = 1;
        let origen = 'Práctica';
        if (f.asiste === 'falta') { nota = 0; origen = 'Falta sin justificar'; }
        else if (f.asiste === 'justificada') { origen = 'Falta justificada (no cuenta)'; peso = 0; }
        else if (f.rol === 'encargado') { nota = r2(nEnc); peso = 2; origen = 'Encargado'; }
        else nota = r2(f.valor);
        if (nota === '' && !f.asiste) continue;
        notas.push({ Fecha: fecha(p.fecha), 'Módulo': etiqueta(c.modulo), 'Evaluación': ce?.ev || '', RA: ce?.ra || '', CE: c.codigo, Instrumento: 'PP', Alumno: al(clave), Origen: origen, Nota: nota, Peso: peso, Comentario: f.comentario || '' });
      }
    }
  }
  for (const c of D.porTipo('calificacion').sort(porFecha)) {
    for (const [clave, f] of Object.entries(c.filas || {})) {
      for (const [codigo, v] of Object.entries(f.notas || {})) {
        const ce = ceDe(c.modulo, codigo);
        notas.push({ Fecha: fecha(c.fecha), 'Módulo': etiqueta(c.modulo), 'Evaluación': ce?.ev || '', RA: ce?.ra || '', CE: codigo, Instrumento: c.instrumento === 'EXP' ? 'PP (examen práctico)' : c.instrumento, Alumno: al(clave), Origen: c.titulo || N.INSTRUMENTOS[c.instrumento], Nota: r2(v), Peso: 1, Comentario: f.comentario || '' });
      }
    }
  }
  hojas.push(['Notas puestas', notas]);
  hojas.push(['Encargado', encargado]);

  const libretas = [];
  for (const l of D.porTipo('libreta').sort((a, b) => a.grupo.localeCompare(b.grupo) || a.ev - b.ev)) {
    for (const a of alumnosDe(l.grupo)) {
      const f = l.filas?.[a.clave];
      if (!f) continue;
      const fila = { Grupo: grupo(l.grupo)?.nombre || '', 'Evaluación': l.ev, Fecha: fecha(l.fecha), Alumno: al(a.clave), Entregada: f.entregada === true ? 'Sí' : f.entregada === false ? 'No' : '' };
      apartados.forEach((ap, i) => { fila[String(ap.nombre).split(' /')[0]] = r2(f.apartados?.[i]); });
      fila.Nota = f.entregada === false ? 0 : r2(N.notaLibreta(f, apartados));
      fila.Comentario = f.comentario || '';
      libretas.push(fila);
    }
  }
  hojas.push(['Libreta', libretas]);

  // Notas calculadas por evaluación.
  const evaluaciones = [];
  const finales = [];
  const faltas = [];
  const maxRA = Math.max(...modulos().map((m) => m.ra.length));
  const columnasRA = () => Object.fromEntries(Array.from({ length: maxRA }, (_, i) => [`RA${i + 1}`, '']));
  for (const m of modulos()) {
    for (const a of alumnosDe(m.grupo)) {
      for (let ev = 1; ev <= m.evaluaciones; ev++) {
        const e = N.notaEvaluacion(m, ev, a.clave, ctx);
        const fila = { 'Módulo': etiqueta(m.codigo), 'Evaluación': ev, Alumno: al(a.clave), ...columnasRA() };
        for (const r of e.ras) fila[r.codigo] = r2(r.valor);
        Object.assign(fila, {
          'Ajuste actitud': r2(e.ajuste) || '', 'Nota real': r2(e.real), 'Boletín': e.boletinTexto === '—' ? '' : e.boletinTexto,
          Estado: e.perdidaEC ? 'Pierde evaluación continua' : e.completa ? (e.faltanCE ? `Faltan ${e.faltanCE} CE` : 'Completa') : 'Provisional',
          'Faltas sin justificar (ev.)': r2(N.faltasDe(m, ev, a.clave, ctx).injustificadas), 'Faltas acumuladas': r2(e.faltas.total),
        });
        evaluaciones.push(fila);
        const fa = N.faltasDe(m, ev, a.clave, ctx);
        if (fa.injustificadas || fa.justificadas) faltas.push({ 'Módulo': etiqueta(m.codigo), 'Evaluación': ev, Alumno: al(a.clave), 'Sin justificar (h)': fa.injustificadas, 'Justificadas (h)': fa.justificadas, 'Acumulado (h)': r2(e.faltas.total), 'Límite (h)': N.limiteFaltas(m), Supera: e.faltas.supera ? 'Sí' : '' });
      }
      const f = N.notaFinal(m, a.clave, ctx);
      const fila = { 'Módulo': etiqueta(m.codigo), Alumno: al(a.clave), ...columnasRA() };
      for (const r of f.ras) fila[r.codigo] = r2(r.def);
      Object.assign(fila, {
        'RA recuperados': f.ras.filter((r) => r.recuperacion !== null).map((r) => `${r.codigo} (${r2(r.original)} → ${r2(r.recuperacion)})`).join(', '),
        'Ajuste actitud final': r2(f.ajusteFinal) || '', 'FC real': r2(f.fcReal), 'FC boletín': f.fcBoletin ?? '',
        Empresa: f.fe === 'exento' ? 'Exento' : f.fe === 'nocursa' ? 'No cursa' : r2(f.fe), Caso: f.casoTexto, Propuesta: f.propuesta ?? '', Consignada: f.consignada ?? '',
        'Candidato MH': f.candidatoMH ? 'Sí' : '', 'Media RA sin redondear': r2(f.mediaRA),
        Observaciones: N.finalDe(m, ctx)?.filas?.[a.clave]?.observaciones || '',
      });
      finales.push(fila);
    }
  }
  hojas.push(['Evaluaciones', evaluaciones]);
  hojas.push(['Nota final', finales]);
  hojas.push(['Faltas', faltas]);

  hojas.push(['Anotaciones', D.porTipo('anotacion').sort(porFecha).map((x) => ({
    Fecha: fecha(x.fecha), Grupo: grupo(x.grupo)?.nombre || '', Alumno: x.clave ? al(x.clave) : 'Toda la clase', 'Módulo': x.modulo ? etiqueta(x.modulo) : '', Tipo: x.categoria || '', 'Anotación': x.texto || '',
  }))]);
  hojas.push(['Charlas', D.porTipo('charla').sort(porFecha).map((x) => ({ Fecha: fecha(x.fecha), Alumno: al(x.clave), Motivo: x.motivo || '', Contenido: x.contenido || '', Acuerdos: x.acuerdos || '' }))]);
  const reuniones = D.porTipo('reunion').sort(porFecha);
  hojas.push(['Reuniones', reuniones.map((x) => ({ Fecha: fecha(x.fecha), Tipo: x.clase || '', Asistentes: x.asistentes || '', Temas: x.temas || '', Acuerdos: x.acuerdos || '' }))]);
  hojas.push(['Tareas', reuniones.flatMap((r) => (r.tareas || []).map((t) => ({ 'Fecha reunión': fecha(r.fecha), 'Reunión': r.clase || '', Tarea: t.texto, 'Fecha límite': fecha(t.limite), Hecha: t.hecha ? 'Sí' : 'No' })))]);

  const prog = [];
  for (const m of modulos()) for (const ce of m.ce) {
    const ra = m.ra.find((r) => r.codigo === ce.ra);
    prog.push({ 'Módulo': etiqueta(m.codigo), RA: ce.ra, 'Peso RA en el módulo': ra?.peso ?? '', CE: ce.codigo, 'Criterio de evaluación': ce.texto, 'Peso CE en el RA': ce.peso, Instrumento: ce.instrumento, Actividad: ce.actividad || '', UT: ce.ut || '', 'Evaluación': ce.ev });
  }
  hojas.push(['Programación', prog]);
  return hojas;
}

export async function descargarExcel(opciones = {}) {
  const XLSX = await cargarSheetJS();
  const libro = XLSX.utils.book_new();
  for (const [nombre, filas] of construirHojas(opciones)) {
    const hoja = filas.length ? XLSX.utils.json_to_sheet(filas) : XLSX.utils.aoa_to_sheet([['Sin datos todavía']]);
    // Las fechas (AAAA-MM-DD) pasan a fecha de Excel, para ordenar y filtrar por fecha.
    for (const [ref, celda] of Object.entries(hoja)) {
      if (ref[0] !== '!' && celda.t === 's' && ES_FECHA.test(celda.v)) { celda.t = 'n'; celda.v = serialExcel(celda.v); celda.z = 'dd/mm/yyyy'; }
    }
    if (filas.length) {
      const cab = Object.keys(filas[0]);
      hoja['!autofilter'] = { ref: hoja['!ref'] };
      hoja['!cols'] = cab.map((k) => {
        const largo = Math.max(k.length, ...filas.slice(0, 200).map((f) => String(f[k] ?? '').length));
        return { wch: Math.min(60, Math.max(8, largo + 2)) };
      });
    }
    XLSX.utils.book_append_sheet(libro, hoja, nombre.slice(0, 31));
  }
  XLSX.writeFile(libro, `diaclashom-${hoyISO()}${opciones.conNombres ? '-con-nombres' : ''}.xlsx`, { compression: true });
}
