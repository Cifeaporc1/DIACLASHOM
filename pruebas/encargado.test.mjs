import * as E from '../js/encargado.js';
let fallos = 0;
const ok = (n, a, b) => { const r = JSON.stringify(a) === JSON.stringify(b); if (!r) fallos++; console.log(`${r ? '✔' : '✘'} ${n}${r ? '' : `\n   obtenido ${JSON.stringify(a)}\n   esperado ${JSON.stringify(b)}`}`); };
const orden = ['A1', 'A2', 'A3', 'A4'];
const P = (filas) => ({ filas });
ok('empieza por el primero', E.turnoSiguiente(orden, [], {}).clave, 'A1');
ok('tras A1, A2', E.turnoSiguiente(orden, [P({ A1: { rol: 'encargado' } })]).clave, 'A2');
ok('A2 no preparado y A3 lo hizo: toca A4', E.turnoSiguiente(orden, [P({ A1: { rol: 'encargado' } }), P({ A2: { noPreparado: true }, A3: { rol: 'encargado' } })]).clave, 'A4');
ok('hoy A2 no viene preparado: sugiere A3', E.turnoSiguiente(orden, [P({ A1: { rol: 'encargado' } })], { A2: { noPreparado: true } }).clave, 'A3');
ok('A2 falta justificada hoy: hoy A3, la próxima vuelve A2', [
  E.turnoSiguiente(orden, [P({ A1: { rol: 'encargado' } })], { A2: { asiste: 'justificada' } }).clave,
  E.turnoSiguiente(orden, [P({ A1: { rol: 'encargado' } }), P({ A2: { asiste: 'justificada' }, A3: { rol: 'encargado' } })]).clave,
], ['A3', 'A2']);
ok('falta sin justificar en su turno: pierde turno', E.turnoSiguiente(orden, [P({ A1: { rol: 'encargado' } }), P({ A2: { asiste: 'falta', pierdeTurno: true }, A3: { rol: 'encargado' } })]).clave, 'A4');
const vuelta1 = [P({ A1: { rol: 'encargado' } }), P({ A2: { noPreparado: true }, A3: { rol: 'encargado' } }), P({ A4: { rol: 'encargado' } })];
const t = E.turnoSiguiente(orden, vuelta1);
ok('da la vuelta: vuelve A1, vuelta 2', [t.clave, t.vuelta], ['A1', 2]);
ok('2.º al revés', E.turnoSiguiente([...orden].reverse(), []).clave, 'A4');
ok('falta sin turno hoy (no era su turno) solo lo salta hoy', E.turnoSiguiente(orden, [], { A1: { asiste: 'falta' } }).clave, 'A2');
ok('plazo 48 h desde el fin', E.plazoInforme('2026-10-22', '11:15').toString(), new Date(2026, 9, 24, 11, 15).toString());
ok('anteriores', E.anterioresA({ id: 'c', grupo: 'G1', fecha: '2026-10-22', creado: '2026-10-22T10' }, [
  { id: 'a', grupo: 'G1', fecha: '2026-10-20', creado: 'x' }, { id: 'b', grupo: 'G2', fecha: '2026-10-20' }, { id: 'd', grupo: 'G1', fecha: '2026-10-23' }, { id: 'c', grupo: 'G1', fecha: '2026-10-22' },
]).map((x) => x.id), ['a']);
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodas las pruebas correctas');
