// Motor de cálculo de notas de DIACLASHOM. Sin pantallas: solo datos de entrada y resultados.
//
// Reglas (acordadas con Luis el 17-10-2026, sobre las tablas del curso 2026-2027):
//  - CE PP: media ponderada de las notas diarias de prácticas. Día normal: nota de ejecución, peso 1.
//    Día de encargado: media de sus 5 ítems, peso 2. Falta sin justificar: 0, peso 1. Falta justificada: no cuenta.
//    Un examen práctico final sustituye a la nota de ese CE PP.
//    En módulos con libreta imprescindible (1279), sin libreta entregada el CE PP vale 0.
//  - CE TP: media de las notas de trabajo del CE más la libreta de esa evaluación como un trabajo más.
//    Como en las tablas, la libreta solo entra si el CE tiene al menos una nota de trabajo.
//  - CE PE y OD: media de las notas.
//  - RA: media ponderada de los CE con nota, por su peso en el RA.
//  - Evaluación: nota real = media ponderada de los RA de la evaluación + ajuste de actitud (−1 a +1),
//    con dos decimales. Boletín = real redondeada (x,5 sube), mínimo 1, máximo 4 si algún RA < 5.

export const INSTRUMENTOS = {
  PE: 'Prueba escrita',
  PP: 'Ejecución práctica',
  TP: 'Trabajo o producto',
  OD: 'Observación directa',
  EXP: 'Examen práctico final',
};

export const esNum = (x) => typeof x === 'number' && Number.isFinite(x);

export function aNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function redondear(x) {
  return Math.floor(x + 0.5 + 1e-9);
}
export function dosDecimales(x) {
  return Math.round(x * 100 + 1e-9) / 100;
}

function mediaPonderada(pares) {
  let s = 0;
  let w = 0;
  for (const [v, p] of pares) { s += v * p; w += p; }
  return w ? s / w : null;
}

export function notaEncargado(items) {
  if (!Array.isArray(items) || items.length < 5) return null;
  const v = items.slice(0, 5).map(aNumero);
  if (v.some((x) => x === null)) return null;
  return v.reduce((a, b) => a + b, 0) / 5;
}

export function notaLibreta(fila, apartados) {
  if (!fila || fila.entregada !== true) return null;
  const v = (fila.apartados || []).map(aNumero);
  if (v.length < apartados.length || v.slice(0, apartados.length).some((x) => x === null)) return null;
  return apartados.reduce((s, a, i) => s + v[i] * a.peso, 0);
}

// Valor de la libreta que entra en el cálculo: nota si está entregada y completa, 0 si no se entregó, null si no hay dato.
function valorLibreta(fila, apartados) {
  if (!fila || fila.entregada === undefined || fila.entregada === null || fila.entregada === '') return null;
  if (fila.entregada === false) return 0;
  return notaLibreta(fila, apartados);
}

const tieneCE = (lista, modulo, codigo) => (lista || []).some((x) => x.modulo === modulo && x.codigo === codigo);

// ctx: { practicas, calificaciones, libretas, ajustes, apartadosLibreta }
export function notaCE(mod, ce, clave, ctx) {
  const out = { codigo: ce.codigo, instrumento: ce.instrumento, peso: ce.peso, valor: null, estado: '', aportes: [] };
  const libreta = (ctx.libretas || []).find((l) => l.grupo === mod.grupo && Number(l.ev) === Number(ce.ev));
  const filaLibreta = libreta?.filas?.[clave];

  if (ce.instrumento === 'PP') {
    const pares = [];
    for (const p of ctx.practicas || []) {
      if (!tieneCE(p.ces, mod.codigo, ce.codigo)) continue;
      const f = p.filas?.[clave];
      if (!f) continue;
      if (f.asiste === 'falta') { pares.push([0, 1]); out.aportes.push({ fecha: p.fecha, valor: 0, peso: 1, motivo: 'Falta sin justificar' }); continue; }
      if (f.asiste === 'justificada') continue;
      if (f.rol === 'encargado') {
        const n = notaEncargado(f.items);
        if (n !== null) { pares.push([n, 2]); out.aportes.push({ fecha: p.fecha, valor: n, peso: 2, motivo: 'Encargado' }); }
        continue;
      }
      const v = aNumero(f.valor);
      if (v !== null) { pares.push([v, 1]); out.aportes.push({ fecha: p.fecha, valor: v, peso: 1, motivo: 'Práctica' }); }
    }
    out.valor = mediaPonderada(pares);
    const examenes = [];
    for (const c of ctx.calificaciones || []) {
      if (c.instrumento !== 'EXP' || c.modulo !== mod.codigo || !(c.ces || []).includes(ce.codigo)) continue;
      const v = aNumero(c.filas?.[clave]?.notas?.[ce.codigo]);
      if (v !== null) examenes.push(v);
    }
    if (examenes.length) {
      out.valor = examenes.reduce((a, b) => a + b, 0) / examenes.length;
      out.estado = 'Examen práctico';
      out.aportes.push({ valor: out.valor, peso: 0, motivo: 'Examen práctico final (sustituye)' });
    }
    if (mod.libretaImprescindible && filaLibreta && filaLibreta.entregada === false) {
      out.valor = 0;
      out.estado = 'Sin libreta';
    }
    return out;
  }

  // TP, PE y OD
  const notas = [];
  for (const c of ctx.calificaciones || []) {
    if (c.instrumento !== ce.instrumento || c.modulo !== mod.codigo || !(c.ces || []).includes(ce.codigo)) continue;
    const v = aNumero(c.filas?.[clave]?.notas?.[ce.codigo]);
    if (v !== null) { notas.push(v); out.aportes.push({ fecha: c.fecha, valor: v, peso: 1, motivo: c.titulo || INSTRUMENTOS[c.instrumento] }); }
  }
  if (ce.instrumento === 'TP' && notas.length) {
    const lib = valorLibreta(filaLibreta, ctx.apartadosLibreta || []);
    if (lib !== null) { notas.push(lib); out.aportes.push({ valor: lib, peso: 1, motivo: filaLibreta.entregada ? 'Libreta' : 'Libreta no entregada' }); }
  }
  out.valor = notas.length ? notas.reduce((a, b) => a + b, 0) / notas.length : null;
  return out;
}

export function notaRA(mod, ra, clave, ctx) {
  const ces = mod.ce.filter((c) => c.ra === ra.codigo).map((c) => notaCE(mod, c, clave, ctx));
  const con = ces.filter((c) => c.valor !== null);
  return {
    codigo: ra.codigo,
    peso: ra.peso,
    ev: ra.ev,
    valor: mediaPonderada(con.map((c) => [c.valor, c.peso])),
    ces,
    faltan: ces.length - con.length,
  };
}

export function ajusteDe(mod, ev, clave, ctx) {
  const a = (ctx.ajustes || []).find((x) => x.modulo === mod.codigo && Number(x.ev) === Number(ev));
  const v = aNumero(a?.filas?.[clave]);
  return v === null ? 0 : Math.max(-1, Math.min(1, v));
}

// ---------- Faltas ----------
// Se meten por evaluación (horas justificadas y sin justificar). La evaluación continua se pierde
// al pasar del 30 % de las horas del módulo, contando justificadas y no justificadas (apartado 13).

export function limiteFaltas(mod) {
  return Math.round(mod.horas * mod.pctFaltas * 100) / 100;
}

export function faltasDe(mod, ev, clave, ctx) {
  const r = (ctx.faltas || []).find((x) => x.modulo === mod.codigo && Number(x.ev) === Number(ev));
  const f = r?.filas?.[clave] || {};
  return { injustificadas: aNumero(f.injustificadas) || 0, justificadas: aNumero(f.justificadas) || 0 };
}

export function faltasHasta(mod, ev, clave, ctx) {
  let inj = 0;
  let just = 0;
  for (let e = 1; e <= ev; e++) {
    const f = faltasDe(mod, e, clave, ctx);
    inj += f.injustificadas;
    just += f.justificadas;
  }
  const total = inj + just;
  const limite = limiteFaltas(mod);
  return { injustificadas: inj, justificadas: just, total, limite, pct: mod.horas ? total / mod.horas : 0, supera: total > limite };
}

export function notaEvaluacion(mod, ev, clave, ctx) {
  const ras = mod.ra.filter((r) => Number(r.ev) === Number(ev)).map((r) => notaRA(mod, r, clave, ctx));
  const con = ras.filter((r) => r.valor !== null);
  const base = mediaPonderada(con.map((r) => [r.valor, r.peso]));
  const ajuste = ajusteDe(mod, ev, clave, ctx);
  const faltanCE = ras.reduce((s, r) => s + r.faltan, 0);
  const completa = ras.length > 0 && con.length === ras.length;
  const raBajo = con.some((r) => r.valor < 5);
  let real = null;
  let boletin = null;
  if (base !== null) {
    real = dosDecimales(Math.max(0, Math.min(10, base + ajuste)));
    let b = Math.max(1, redondear(real));
    if (raBajo) b = Math.min(4, b);
    boletin = b;
  }
  const faltas = faltasHasta(mod, ev, clave, ctx);
  const perdidaEC = faltas.supera;
  return {
    ev: Number(ev), ras, base, ajuste, real, boletin, completa, faltanCE, raBajo, faltas, perdidaEC,
    boletinTexto: perdidaEC ? 'NE' : (boletin === null ? '—' : String(boletin)),
  };
}

// ---------- Nota final del módulo ----------
// RA definitivo = recuperación si la hay (sustituye, sin tope) o la nota del RA.
// FC real = Σ(RA definitivo × peso) + ajuste de actitud final, que pone el profesor a mano (−1 a +1).
// FC boletín = FC real redondeada, mínimo 1; máximo 4 si algún RA definitivo < 5.
// Nota final = 0,8 × FC real + 0,2 × FE, redondeada, con los casos del apartado 9.3 (A-F) de las tablas.

export const CASOS = {
  general: 'General',
  A: 'A · FE = 4',
  B: 'B · FE < 4: consultar al tutor',
  C: 'C · FC ≤ 3: recupera centro',
  D: 'D · FC = 4: comprobar RA',
  E: 'E · Exento de FE',
  F: 'F · No cursa la FE',
  revisar: 'Revisar: exento con FC < 5',
  faltaFE: 'Falta la nota de empresa',
};

export function finalDe(mod, ctx) {
  return (ctx.finales || []).find((x) => x.modulo === mod.codigo);
}

export function notaFinal(mod, clave, ctx) {
  const reg = finalDe(mod, ctx);
  const fila = reg?.filas?.[clave] || {};
  const rec = fila.rec || {};
  const ras = mod.ra.map((r) => {
    const original = notaRA(mod, r, clave, ctx).valor;
    const recuperacion = aNumero(rec[r.codigo]);
    return { codigo: r.codigo, peso: r.peso, ev: r.ev, original, recuperacion, def: recuperacion !== null ? recuperacion : original };
  });
  const completa = ras.every((r) => r.def !== null);
  const recuperados = ras.filter((r) => r.recuperacion !== null).length;
  const raBajo = ras.some((r) => r.def !== null && r.def < 5);
  const ajusteEv = Array.from({ length: mod.evaluaciones }, (_, i) => ajusteDe(mod, i + 1, clave, ctx));
  const aj = aNumero(fila.ajuste);
  const ajusteFinal = aj === null ? 0 : Math.max(-1, Math.min(1, aj));

  let fcReal = null;
  let fcBoletin = null;
  if (completa) {
    fcReal = dosDecimales(Math.max(0, Math.min(10, ras.reduce((s, r) => s + r.def * r.peso, 0) + ajusteFinal)));
    fcBoletin = Math.max(1, redondear(fcReal));
    if (raBajo) fcBoletin = Math.min(4, fcBoletin);
  }

  const feTexto = fila.fe ?? '';
  const fe = feTexto === 'exento' || feTexto === 'nocursa' ? feTexto : aNumero(feTexto);
  let caso = null;
  let propuesta = null;
  if (fcBoletin !== null) {
    const mezcla = (tope) => {
      const v = redondear(mod.pesoFC * fcReal + mod.pesoFE * fe);
      return Math.max(1, tope ? Math.min(tope, v) : v);
    };
    if (fe === 'nocursa') { caso = 'F'; propuesta = 'NE'; }
    else if (fe === 'exento') { if (fcBoletin >= 5) { caso = 'E'; propuesta = fcBoletin; } else caso = 'revisar'; }
    else if (fe === null) caso = 'faltaFE';
    else if (fcBoletin <= 3) { caso = 'C'; propuesta = mezcla(4); }
    else if (fcBoletin === 4) { caso = 'D'; propuesta = mezcla(5); }
    else if (fe >= 5) { caso = 'general'; propuesta = mezcla(); }
    else if (fe === 4) { caso = 'A'; propuesta = mezcla(); }
    else { caso = 'B'; propuesta = mezcla(); }
  }
  const consignada = fila.consignada === undefined || fila.consignada === '' ? null : fila.consignada;
  const notaParaMH = consignada !== null ? aNumero(consignada) : (typeof propuesta === 'number' ? propuesta : null);
  const mediaRA = completa ? ras.reduce((s, r) => s + r.def, 0) / ras.length : null;
  return {
    ras, completa, recuperados, raBajo, ajusteFinal, ajusteEv, fcReal, fcBoletin, fe, caso, casoTexto: caso ? CASOS[caso] : '',
    propuesta, consignada, candidatoMH: notaParaMH === 10 && recuperados === 0, mediaRA,
  };
}

// Contexto a partir de los registros guardados.
export function contexto(porTipo, listas) {
  return {
    practicas: porTipo('practica'),
    calificaciones: porTipo('calificacion'),
    libretas: porTipo('libreta'),
    ajustes: porTipo('ajuste'),
    faltas: porTipo('faltas'),
    finales: porTipo('final'),
    apartadosLibreta: listas?.libretaApartados || [
      { peso: 0.25 }, { peso: 0.25 }, { peso: 0.25 }, { peso: 0.25 },
    ],
  };
}
