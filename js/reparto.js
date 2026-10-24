// Reparto de alumnos en grupos. Sin dependencias, para poder probarlo en Node.
// - Por tamaño: grupos de «n»; si no sale exacto, unos tienen uno más o uno menos (lo más cerca de «n»).
// - Por número: «n» grupos lo más iguales posible.
// - Intenta no repetir parejas del último reparto de la clase (norma: los grupos de un día no se repiten al siguiente).

export function tamanos(total, modo, n) {
  n = Math.max(1, Math.floor(Number(n) || 1));
  if (!total) return [];
  // Por tamaño: el número de grupos que deja los tamaños más cerca del pedido (28 de 5 en 5 → 6 grupos: 5,5,5,5,4,4).
  const numGrupos = modo === 'num' ? Math.min(n, total) : Math.max(1, Math.round(total / n));
  const base = Math.floor(total / numGrupos);
  const resto = total % numGrupos;
  return Array.from({ length: numGrupos }, (_, i) => base + (i < resto ? 1 : 0));
}

function barajar(lista, azar) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Parejas que ya estuvieron juntas en los repartos anteriores.
export function parejas(grupos) {
  const s = new Set();
  for (const g of grupos || []) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) s.add([g[i], g[j]].sort().join('|'));
  return s;
}

export function repetidas(grupos, previas) {
  let n = 0;
  for (const p of parejas(grupos)) if (previas.has(p)) n++;
  return n;
}

const azarSeguro = () => {
  if (globalThis.crypto?.getRandomValues) { const u = new Uint32Array(1); globalThis.crypto.getRandomValues(u); return u[0] / 2 ** 32; }
  return Math.random();
};

// Conflictos de un alumno con el resto de un grupo (parejas que ya estuvieron juntas).
function choques(c, grupo, previas) {
  let n = 0;
  for (const x of grupo) if (x !== c && previas.has([c, x].sort().join('|'))) n++;
  return n;
}

export function hacerGrupos(claves, modo, n, anteriores = [], { intentos = 30, azar = azarSeguro } = {}) {
  const t = tamanos(claves.length, modo, n);
  const previas = parejas(anteriores);
  let mejor = null;
  let mejorRep = Infinity;
  for (let k = 0; k < intentos && mejorRep > 0; k++) {
    const b = barajar(claves, azar);
    const grupos = [];
    let i = 0;
    for (const tam of t) { grupos.push(b.slice(i, i + tam)); i += tam; }
    // Mejora: intercambia alumnos entre grupos mientras baje el número de parejas repetidas.
    let mejora = previas.size > 0;
    while (mejora) {
      mejora = false;
      for (let g1 = 0; g1 < grupos.length; g1++) {
        for (let a = 0; a < grupos[g1].length; a++) {
          const ca = grupos[g1][a];
          if (!choques(ca, grupos[g1], previas)) continue;
          for (let g2 = 0; g2 < grupos.length && !mejora; g2++) {
            if (g2 === g1) continue;
            for (let bI = 0; bI < grupos[g2].length; bI++) {
              const cb = grupos[g2][bI];
              const antes = choques(ca, grupos[g1], previas) + choques(cb, grupos[g2], previas);
              const n1 = grupos[g1].map((x) => (x === ca ? cb : x));
              const n2 = grupos[g2].map((x) => (x === cb ? ca : x));
              const despues = choques(cb, n1, previas) + choques(ca, n2, previas);
              if (despues < antes) { grupos[g1] = n1; grupos[g2] = n2; mejora = true; break; }
            }
          }
          if (mejora) break;
        }
        if (mejora) break;
      }
    }
    const rep = repetidas(grupos, previas);
    if (rep < mejorRep) { mejor = grupos; mejorRep = rep; }
  }
  return { grupos: mejor || [], repetidas: mejorRep === Infinity ? 0 : mejorRep };
}
