// Uso de CIFEAFARM → propuesta de nota. Sin pantallas: solo cálculo (pruebas en pruebas/uso.test.mjs).
//
// Propuesta (Luis la revisa y la ajusta a mano; cuenta como una nota más del CE):
//  - Participación = días con actividad del alumno / días de referencia (por defecto, los días en que
//    algún alumno de su curso registró algo en la granja), como mucho 1.
//  - Calidad = 1 − registros suyos corregidos por otros / registros que hizo (como poco 0,5).
//  - Propuesta = 10 × participación × calidad, con un decimal. Sin registros ni tareas: 0.
//  Las entradas en la app no cuentan: solo se muestran como dato.

const r1 = (x) => Math.round(x * 10 + 1e-9) / 10;

export function propuesta(fila, diasRef) {
  if (!fila || !(diasRef > 0)) return null;
  const registros = fila.registros || 0; const tareas = fila.tareas || 0;
  if (registros + tareas === 0) return 0;
  const participacion = Math.min(1, (fila.dias || 0) / diasRef);
  const calidad = registros > 0 ? Math.max(0.5, 1 - (fila.corregidos || 0) / registros) : 1;
  return r1(10 * participacion * calidad);
}

export function resumen(fila, diasRef) {
  if (!fila) return 'Sin datos de CIFEAFARM';
  return `${fila.dias} de ${diasRef} días · ${fila.registros} registros · ${fila.tareas} tareas del protocolo · ${fila.corregidos} corregidos por otros · ${fila.entradas} entradas`;
}

// Emparejamiento inicial: alias de CIFEAFARM y claves de DIACLASHOM, los dos en orden natural
const natural = (a, b) => String(a).localeCompare(String(b), 'es', { numeric: true });
export function emparejarPorOrden(alias, claves, previo = {}) {
  const out = { ...previo };
  const libresA = alias.filter((a) => !out[a]).sort(natural);
  const usadas = new Set(Object.values(out));
  const libresC = claves.filter((c) => !usadas.has(c));
  libresA.forEach((a, i) => { if (libresC[i]) out[a] = libresC[i]; });
  return out;
}

// Fechas de una evaluación del grupo, sacadas del calendario escolar: { desde, hasta } o null
export function periodoEvaluacion(eventos, grupo, ev) {
  const e = (eventos || []).find((x) => x.clase === 'periodo' && (x.grupos || []).includes(grupo) && new RegExp(`^${ev}\\.ª evaluación$`).test(x.texto));
  return e ? { desde: e.fecha, hasta: e.hasta } : null;
}
