import fs from 'node:fs';
// Pruebas del uso de CIFEAFARM. Ejecutar: node pruebas/uso.test.mjs
const U = await import('../js/uso.js');
const N = await import('../js/notas.js');
const P = JSON.parse(fs.readFileSync(new URL('../datos/programacion-2026-2027.json', import.meta.url), 'utf8'));
const C = JSON.parse(fs.readFileSync(new URL('../datos/calendario-horarios-2026-2027.json', import.meta.url), 'utf8'));
let fallos = 0;
const ok = (nombre, real, esperado) => { const b = JSON.stringify(real) === JSON.stringify(esperado); if (!b) fallos++; console.log(`${b ? 'OK  ' : 'MAL '} ${nombre} ${b ? '' : `→ ${JSON.stringify(real)} (esperado ${JSON.stringify(esperado)})`}`); };

// Propuesta
ok('todos los días, sin correcciones', U.propuesta({ dias: 10, registros: 20, tareas: 5, corregidos: 0 }, 10), 10);
ok('la mitad de los días', U.propuesta({ dias: 5, registros: 10, tareas: 0, corregidos: 0 }, 10), 5);
ok('más días que la referencia: máximo 10', U.propuesta({ dias: 12, registros: 10, tareas: 0, corregidos: 0 }, 10), 10);
ok('1 de cada 4 registros corregido', U.propuesta({ dias: 10, registros: 8, tareas: 0, corregidos: 2 }, 10), 7.5);
ok('muchas correcciones: calidad mínima 0,5', U.propuesta({ dias: 10, registros: 4, tareas: 0, corregidos: 4 }, 10), 5);
ok('solo tareas del protocolo', U.propuesta({ dias: 3, registros: 0, tareas: 6, corregidos: 0 }, 6), 5);
ok('nada en CIFEAFARM: 0', U.propuesta({ dias: 0, registros: 0, tareas: 0, corregidos: 0 }, 6), 0);
ok('sin días de referencia: sin propuesta', U.propuesta({ dias: 2, registros: 3, tareas: 0, corregidos: 0 }, 0), null);
// Emparejamiento por orden
ok('emparejar por orden natural', U.emparejarPorOrden(['2GAS-10', '2GAS-02', '2GAS-01'], ['ALUSEGGASA1', 'ALUSEGGASA2', 'ALUSEGGASA3']), { '2GAS-01': 'ALUSEGGASA1', '2GAS-02': 'ALUSEGGASA2', '2GAS-10': 'ALUSEGGASA3' });
ok('respeta lo ya emparejado', U.emparejarPorOrden(['B01', 'B02'], ['ALUSEGGASA1', 'ALUSEGGASA2'], { B01: 'ALUSEGGASA2' }), { B01: 'ALUSEGGASA2', B02: 'ALUSEGGASA1' });
// Periodo de la evaluación desde el calendario escolar
ok('1.ª ev. de 1.º', U.periodoEvaluacion(C.calendarioEscolar.eventos, 'G1', 1), { desde: '2026-09-14', hasta: '2026-12-22' });
ok('2.ª ev. de 1.º', U.periodoEvaluacion(C.calendarioEscolar.eventos, 'G1', 2), { desde: '2027-01-08', hasta: '2027-03-18' });

// En las notas: cuenta como una nota más del CE
const A = 'ALUSEGGASA1', B = 'ALUPRIGASA1';
const m79 = P.modulos.find((m) => m.codigo === '1279'), m74 = P.modulos.find((m) => m.codigo === '1274');
const ce = (m, c) => m.ce.find((x) => x.codigo === c);
const uso = (mod, c, clave, v) => ({ instrumento: 'USO', modulo: mod, ces: [c], fecha: '2026-12-20', titulo: 'Uso de CIFEAFARM', filas: { [clave]: { notas: { [c]: v } } } });
let ctx = { apartadosLibreta: P.libretaApartados, practicas: [{ fecha: 'a', ces: [{ modulo: '1279', codigo: '4.c' }], filas: { [A]: { valor: 6 } } }], calificaciones: [uso('1279', '4.c', A, 9)] };
ok('PP (1279 4.c): práctica 6 + uso 9 = 7,5', N.notaCE(m79, ce(m79, '4.c'), A, ctx).valor, 7.5);
ctx = { apartadosLibreta: P.libretaApartados, calificaciones: [uso('1274', '2.h', B, 8)] };
ok('TP (1274 2.h): solo uso 8 = 8 (sin libreta)', N.notaCE(m74, ce(m74, '2.h'), B, ctx).valor, 8);
ctx.calificaciones.push({ instrumento: 'TP', modulo: '1274', ces: ['2.h'], fecha: 'b', filas: { [B]: { notas: { '2.h': 6 } } } });
ok('TP: trabajo 6 + uso 8 = 7', N.notaCE(m74, ce(m74, '2.h'), B, ctx).valor, 7);
ok('el uso no cuenta en otro CE', N.notaCE(m74, ce(m74, '1.b'), B, ctx).valor, null);

console.log(fallos ? `\n${fallos} pruebas fallidas` : '\nTodas las pruebas correctas');
process.exit(fallos ? 1 : 0);
