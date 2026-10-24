// Turno de encargado e informe de la práctica. Sin dependencias, para poder probarlo en Node.
//
// Normas de Luis:
// - 1.º GASA va del primero al último de la lista; 2.º GASA, del último al primero.
// - El encargado del día lo marca Luis; la app solo sugiere a quién le toca.
// - Quien no viene preparado (sin la tablilla) o falta sin justificar en su turno pierde el turno
//   (no vuelve a ser encargado hasta que la lista dé la vuelta). Si no viene preparado, esa práctica es un 0.
// - Si falta con justificación, conserva el turno: le toca en la siguiente práctica.
// - El informe se manda por correo antes de 48 h desde la práctica.

export const ORDEN_DESCENDENTE = { G2: true };

// ¿Esta fila «gasta» un turno de la vuelta?
export const gastaTurno = (f) => !!f && (f.rol === 'encargado' || !!f.noPreparado || !!f.pierdeTurno);

// orden: claves en el orden del turno. previas: prácticas anteriores del grupo. hoy: filas de la práctica actual.
// Devuelve la clave a la que le toca, la vuelta en la que va y cuántas veces lleva cada uno.
export function turnoSiguiente(orden, previas, hoy = {}) {
  if (!orden.length) return null;
  const veces = Object.fromEntries(orden.map((c) => [c, 0]));
  for (const p of previas) for (const [c, f] of Object.entries(p.filas || {})) if (c in veces && gastaTurno(f)) veces[c]++;
  const fuera = (c) => { const f = hoy[c]; return !!f && (gastaTurno(f) || !!f.asiste); };
  const niveles = [...new Set(Object.values(veces))].sort((a, b) => a - b);
  for (const n of niveles) {
    const c = orden.find((x) => veces[x] === n && !fuera(x));
    if (c) return { clave: c, vuelta: Math.min(...Object.values(veces)) + 1, veces };
  }
  return null;
}

// Prácticas anteriores a «p» (por fecha y, el mismo día, por hora de creación).
export function anterioresA(p, practicas) {
  const k = (x) => `${x.fecha}|${x.creado || ''}`;
  return practicas.filter((x) => x.id !== p.id && x.grupo === p.grupo && k(x) < k(p));
}

// ---------- Informe ----------

export const ESTADOS_INFORME = [
  [undefined, 'Pendiente'],
  ['aTiempo', 'A tiempo'],
  ['tarde', 'Tarde'],
  ['noEntregado', 'No entregado'],
];

// Fin del plazo: 48 h desde que acaba la práctica (hora de fin de la sesión o, si no se sabe, el final del día).
export function plazoInforme(fecha, fin) {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, mi] = fin ? String(fin).split(':').map(Number) : [23, 59];
  return new Date(y, m - 1, d + 2, h, mi || 0);
}
