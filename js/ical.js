// Lector de calendarios iCal (formato de la «dirección secreta» de Google Calendar).
// Interpreta eventos normales, de día completo y repetidos (RRULE: diaria, semanal, mensual y anual,
// con INTERVAL, COUNT, UNTIL, BYDAY y BYMONTHDAY), con fechas excluidas (EXDATE) y ocurrencias
// modificadas (RECURRENCE-ID). Sin dependencias, para poder probarlo en Node.

const DIAS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function desescapar(v) {
  return v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

// Diferencia entre la hora de una zona y UTC en un instante, en milisegundos.
function desfase(instante, zona) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: zona, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(instante)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - instante;
}

function horaDeZona(y, mo, d, h, mi, s, zona) {
  const aprox = Date.UTC(y, mo, d, h, mi, s);
  let t = aprox - desfase(aprox, zona);
  t = aprox - desfase(t, zona); // segunda pasada por si cae en cambio de hora
  return new Date(t);
}

export function leerFecha(valor, params = {}) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(valor.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s = '00', z] = m;
  if (h === undefined) return { fecha: new Date(+y, +mo - 1, +d), todoElDia: true };
  if (z) return { fecha: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)), todoElDia: false };
  if (params.TZID) {
    try { return { fecha: horaDeZona(+y, +mo - 1, +d, +h, +mi, +s, params.TZID), todoElDia: false }; } catch { /* zona desconocida: hora local */ }
  }
  return { fecha: new Date(+y, +mo - 1, +d, +h, +mi, +s), todoElDia: false };
}

function leerLinea(linea) {
  const i = linea.indexOf(':');
  if (i < 0) return null;
  const [nombre, ...resto] = linea.slice(0, i).split(';');
  const params = {};
  for (const p of resto) { const [k, v] = p.split('='); if (k) params[k.toUpperCase()] = (v || '').replace(/^"|"$/g, ''); }
  return { nombre: nombre.toUpperCase(), params, valor: linea.slice(i + 1) };
}

export function leerICS(texto) {
  const lineas = texto.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const eventos = [];
  let ev = null;
  for (const l of lineas) {
    if (l === 'BEGIN:VEVENT') { ev = { exdates: [] }; continue; }
    if (l === 'END:VEVENT') { if (ev?.inicio) eventos.push(ev); ev = null; continue; }
    if (!ev) continue;
    const p = leerLinea(l);
    if (!p) continue;
    switch (p.nombre) {
      case 'UID': ev.uid = p.valor; break;
      case 'SUMMARY': ev.titulo = desescapar(p.valor); break;
      case 'LOCATION': ev.lugar = desescapar(p.valor); break;
      case 'DESCRIPTION': ev.descripcion = desescapar(p.valor); break;
      case 'STATUS': ev.estado = p.valor.toUpperCase(); break;
      case 'RRULE': ev.rrule = Object.fromEntries(p.valor.split(';').map((x) => x.split('='))); break;
      case 'DTSTART': { const f = leerFecha(p.valor, p.params); if (f) { ev.inicio = f.fecha; ev.todoElDia = f.todoElDia; } break; }
      case 'DTEND': { const f = leerFecha(p.valor, p.params); if (f) ev.fin = f.fecha; break; }
      case 'DURATION': ev.duracion = p.valor; break;
      case 'RECURRENCE-ID': { const f = leerFecha(p.valor, p.params); if (f) ev.recurrencia = f.fecha.getTime(); break; }
      case 'EXDATE': for (const v of p.valor.split(',')) { const f = leerFecha(v, p.params); if (f) ev.exdates.push(f.fecha.getTime()); } break;
      default: break;
    }
  }
  for (const e of eventos) {
    if (!e.fin) {
      const dur = /P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?/.exec(e.duracion || '');
      const ms = dur ? ((+dur[1] || 0) * 86400 + (+dur[2] || 0) * 3600 + (+dur[3] || 0) * 60) * 1000 : 0;
      e.fin = new Date(e.inicio.getTime() + (ms || (e.todoElDia ? 86400000 : 0)));
    }
  }
  return eventos;
}

function conHora(base, dia) {
  // Misma hora local que el inicio original, en otro día.
  return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), base.getHours(), base.getMinutes(), base.getSeconds());
}

function enesimoDiaSemana(y, m, n, dow) {
  if (n > 0) {
    const primero = new Date(y, m, 1);
    const d = 1 + ((dow - primero.getDay() + 7) % 7) + (n - 1) * 7;
    return d <= new Date(y, m + 1, 0).getDate() ? new Date(y, m, d) : null;
  }
  const ultimo = new Date(y, m + 1, 0);
  const d = ultimo.getDate() - ((ultimo.getDay() - dow + 7) % 7) + (n + 1) * 7;
  return d >= 1 ? new Date(y, m, d) : null;
}

// Fechas de inicio de un evento repetido, en orden, hasta «hasta».
function ocurrencias(ev, hasta) {
  const r = ev.rrule;
  const intervalo = Math.max(1, Number(r.INTERVAL || 1));
  const cuenta = r.COUNT ? Number(r.COUNT) : Infinity;
  const until = r.UNTIL ? leerFecha(r.UNTIL)?.fecha : null;
  const limite = Math.min(hasta.getTime(), until ? until.getTime() + (until.getHours() === 0 && !/T/.test(r.UNTIL) ? 86399999 : 0) : Infinity);
  const ini = ev.inicio;
  const res = [];
  const empuja = (f) => {
    if (f < ini || res.length >= cuenta) return res.length < cuenta;
    if (f.getTime() > limite) return false;
    res.push(f);
    return res.length < cuenta;
  };
  const byday = (r.BYDAY || '').split(',').filter(Boolean);
  const bymd = (r.BYMONTHDAY || '').split(',').filter(Boolean).map(Number);
  const MAX = 3000;
  if (r.FREQ === 'DAILY') {
    for (let i = 0; i < MAX; i++) {
      const f = conHora(ini, new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + i * intervalo));
      if (f.getTime() > limite || !empuja(f)) break;
    }
  } else if (r.FREQ === 'WEEKLY') {
    const dias = byday.length ? byday.map((x) => DIAS[x.slice(-2)]).sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)) : [ini.getDay()];
    const lunes = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() - ((ini.getDay() + 6) % 7));
    fuera: for (let s = 0; s < MAX; s++) {
      for (const dow of dias) {
        const dia = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + s * 7 * intervalo + ((dow + 6) % 7));
        const f = conHora(ini, dia);
        if (f.getTime() > limite) break fuera;
        if (!empuja(f)) break fuera;
      }
    }
  } else if (r.FREQ === 'MONTHLY') {
    for (let i = 0; i < MAX; i++) {
      const y = ini.getFullYear();
      const m = ini.getMonth() + i * intervalo;
      const candidatos = [];
      if (byday.length) {
        for (const b of byday) { const n = parseInt(b, 10) || 1; const d = enesimoDiaSemana(y, m, n, DIAS[b.slice(-2)]); if (d) candidatos.push(d); }
      } else {
        for (const md of bymd.length ? bymd : [ini.getDate()]) { const d = new Date(y, m, md); if (d.getMonth() === ((m % 12) + 12) % 12) candidatos.push(d); }
      }
      candidatos.sort((a, b) => a - b);
      if (new Date(y, m, 1).getTime() > limite) break;
      let seguir = true;
      for (const d of candidatos) { const f = conHora(ini, d); if (f.getTime() > limite) { seguir = false; break; } if (!empuja(f)) { seguir = false; break; } }
      if (!seguir) break;
    }
  } else if (r.FREQ === 'YEARLY') {
    for (let i = 0; i < 200; i++) {
      const d = new Date(ini.getFullYear() + i * intervalo, ini.getMonth(), ini.getDate());
      const f = conHora(ini, d);
      if (f.getTime() > limite || !empuja(f)) break;
    }
  } else {
    empuja(ini);
  }
  return res;
}

// Eventos que tocan el intervalo [desde, hasta), ya expandidos y ordenados.
export function eventosEntre(eventos, desde, hasta) {
  const cambios = new Map();
  for (const e of eventos) if (e.recurrencia !== undefined && e.uid) cambios.set(`${e.uid}|${e.recurrencia}`, e);
  const salida = [];
  const solapa = (i, f) => f > desde && i < hasta;
  for (const e of eventos) {
    if (e.recurrencia !== undefined || e.estado === 'CANCELLED') continue;
    const dur = e.fin - e.inicio;
    const inicios = e.rrule ? ocurrencias(e, hasta) : [e.inicio];
    for (const i of inicios) {
      if (e.exdates.includes(i.getTime())) continue;
      const cambio = cambios.get(`${e.uid}|${i.getTime()}`);
      if (cambio) continue; // se añade abajo con sus datos propios
      const f = new Date(i.getTime() + dur);
      if (solapa(i, f)) salida.push({ ...e, inicio: i, fin: f });
    }
  }
  for (const c of cambios.values()) if (c.estado !== 'CANCELLED' && solapa(c.inicio, c.fin)) salida.push(c);
  return salida
    .map(({ uid, titulo = '(sin título)', lugar = '', descripcion = '', inicio, fin, todoElDia }) => ({ uid, titulo, lugar, descripcion, inicio, fin, todoElDia }))
    .sort((a, b) => a.inicio - b.inicio || (b.todoElDia - a.todoElDia));
}
