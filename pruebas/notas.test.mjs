import fs from 'node:fs';
// Pruebas del motor de notas. Ejecutar: node pruebas/notas.test.mjs
const N = await import('../js/notas.js');
const P = JSON.parse(fs.readFileSync(new URL('../datos/programacion-2026-2027.json', import.meta.url),'utf8'));
const m79 = P.modulos.find(m=>m.codigo==='1279'), m74 = P.modulos.find(m=>m.codigo==='1274');
const apartadosLibreta = P.libretaApartados;
let fallos = 0;
const ok = (nombre, real, esperado) => { const b = (real===esperado) || (typeof real==='number' && typeof esperado==='number' && Math.abs(real-esperado)<1e-9); if(!b) fallos++; console.log(b?'OK  ':'FALLO', nombre, '→', real, b?'':`(esperado ${esperado})`); };
const A='ALUSEGGASA1';
const ce = (m,c)=>m.ce.find(x=>x.codigo===c);
const prac = (fecha, ces, fila) => ({fecha, ces, filas:{[A]:fila}});
const C2d=[{modulo:'1279',codigo:'2.d'}];

// 1. PP con encargado doble, falta y justificada
let ctx={apartadosLibreta, practicas:[prac('a',C2d,{valor:7}),prac('b',C2d,{valor:8}),prac('c',C2d,{rol:'encargado',items:[9,9,9,9,9]}),prac('d',C2d,{asiste:'falta'}),prac('e',C2d,{asiste:'justificada',valor:2})]};
ok('PP 7, 8, encargado 9, falta, justificada', N.notaCE(m79,ce(m79,'2.d'),A,ctx).valor, 6.6);
// encargado con ítems incompletos no cuenta
ctx.practicas.push(prac('f',C2d,{rol:'encargado',items:[10,10,null,10,10]}));
ok('encargado incompleto se ignora', N.notaCE(m79,ce(m79,'2.d'),A,ctx).valor, 6.6);
// 2. examen práctico sustituye
ctx.calificaciones=[{instrumento:'EXP',modulo:'1279',ces:['2.d'],filas:{[A]:{notas:{'2.d':5.5}}}}];
ok('examen práctico sustituye', N.notaCE(m79,ce(m79,'2.d'),A,ctx).valor, 5.5);
// 3. Sin libreta → CE PP sin evaluar (NE)
ctx.libretas=[{grupo:'G2',ev:1,filas:{[A]:{entregada:false}}}];
let r=N.notaCE(m79,ce(m79,'2.d'),A,ctx); ok('1279 sin libreta: PP sin evaluar', r.valor, null); ok('estado', r.estado, 'NE: sin libreta');
// 1274 no exige libreta
const C74=[{modulo:'1274',codigo:'1.b'}];
ctx={apartadosLibreta, practicas:[prac('a',C74,{valor:7})], libretas:[{grupo:'G1',ev:1,filas:{[A]:{entregada:false}}}]};
ok('1274 sin libreta: también PP sin evaluar', N.notaCE(m74,ce(m74,'1.b'),A,ctx).valor, null);
// 4. TP con libreta
const trab=(cod,v,m='1279')=>({instrumento:'TP',modulo:m,ces:[cod],filas:{[A]:{notas:{[cod]:v}}}});
ctx={apartadosLibreta, calificaciones:[trab('1.b',8)], libretas:[{grupo:'G2',ev:1,filas:{[A]:{entregada:true,apartados:[7,6,7,8,9]}}}]};
ok('TP 8 + libreta 7,4', Math.round(N.notaCE(m79,ce(m79,'1.b'),A,ctx).valor*100)/100, 7.7);
ok('TP sin trabajo: la libreta sola no da nota', N.notaCE(m79,ce(m79,'1.c'),A,ctx).valor, null);
ctx.libretas[0].filas[A]={entregada:false};
ok('TP 8 + libreta no entregada (0)', N.notaCE(m79,ce(m79,'1.b'),A,ctx).valor, 4);
ctx.libretas[0].filas[A]={entregada:true,apartados:[7,6,7,null,9]};
ok('libreta incompleta no cuenta', N.notaCE(m79,ce(m79,'1.b'),A,ctx).valor, 8);
ctx.calificaciones.push(trab('1.b',6));
ok('dos trabajos del mismo CE: media', N.notaCE(m79,ce(m79,'1.b'),A,ctx).valor, 7);

// 5. Evaluación completa de 1279, 1.ª ev: todos los CE a 6
function todo(m, ev, valor){
  const cal=[], pr=[];
  for(const c of m.ce.filter(x=>x.ev===ev)){
    if(c.instrumento==='PP') pr.push(prac('x',[{modulo:m.codigo,codigo:c.codigo}],{valor:valor(c)}));
    else cal.push({instrumento:c.instrumento,modulo:m.codigo,ces:[c.codigo],filas:{[A]:{notas:{[c.codigo]:valor(c)}}}});
  }
  return {apartadosLibreta, practicas:pr, calificaciones:cal, libretas:[], ajustes:[]};
}
ctx=todo(m79,1,()=>6);
let e=N.notaEvaluacion(m79,1,A,ctx);
ok('1279 ev1 todo 6: real', e.real, 6); ok('boletín', e.boletin, 6); ok('completa', e.completa, true); ok('RA de la 1.ª', e.ras.map(r=>r.codigo).join(','), 'RA1,RA2,RA3');
ctx.ajustes=[{modulo:'1279',ev:1,filas:{[A]:0.5}}];
e=N.notaEvaluacion(m79,1,A,ctx); ok('ajuste +0,5: real 6,5', e.real, 6.5); ok('boletín 7 (x,5 sube)', e.boletin, 7);
ctx.ajustes=[{modulo:'1279',ev:1,filas:{[A]:3}}];
ok('ajuste limitado a +1', N.notaEvaluacion(m79,1,A,ctx).real, 7);
// RA2 bajo: CE de RA2 a 3, resto 8 → RA1 8, RA2 3, RA3 8 → (1.6+0.9+1.6)/0.7 = 5.857 → boletín máx 4
ctx=todo(m79,1,(c)=>c.ra==='RA2'?3:8);
e=N.notaEvaluacion(m79,1,A,ctx); ok('RA2 < 5: real', e.real, 5.86); ok('RA < 5: boletín máximo 4', e.boletin, 4);
// Faltan CE: quitar 1.a
ctx=todo(m79,1,()=>6); ctx.calificaciones=ctx.calificaciones.filter(c=>!c.ces.includes('1.a'));
e=N.notaEvaluacion(m79,1,A,ctx); ok('falta un CE: faltanCE', e.faltanCE, 1); ok('RA1 provisional con el resto', e.ras[0].valor, 6);
// RA sin ninguna nota → evaluación incompleta
ctx=todo(m79,1,(c)=>c.ra==='RA3'?null:6); ctx.practicas=ctx.practicas.filter(p=>p.filas[A].valor!==null); ctx.calificaciones=ctx.calificaciones.filter(c=>c.filas[A].notas[c.ces[0]]!==null);
e=N.notaEvaluacion(m79,1,A,ctx); ok('sin RA3: incompleta', e.completa, false); ok('real provisional con RA1 y RA2', e.real, 6);
// Ponderación real: RA1 todo 10, RA2 todo 5, RA3 todo 7 → (2+1.5+1.4)/0.7 = 7
ctx=todo(m79,1,(c)=>({RA1:10,RA2:5,RA3:7})[c.ra]);
ok('ponderación de RA (20/30/20 %)', N.notaEvaluacion(m79,1,A,ctx).real, 7);
// Ponderación de CE dentro del RA: RA1 1.a(15%)=10, resto 0 → 1.5
ctx=todo(m79,1,(c)=>c.codigo==='1.a'?10:0);
ok('ponderación de CE (1.a 15 %)', N.notaRA(m79,m79.ra[0],A,ctx).valor, 1.5);
// Redondeo
ok('redondear 4,5', N.redondear(4.5), 5); ok('redondear 6,49', N.redondear(6.49), 6); ok('redondear 0,9', N.redondear(0.9), 1);
ok('libreta 20 % cada apartado', Math.round(N.notaLibreta({entregada:true,apartados:['6','7,5',8,9,10]},apartadosLibreta)*1000)/1000, 8.1);
// 1.º: práctica común con CE de 1274 y 1276
const m76=P.modulos.find(m=>m.codigo==='1276');
const pc=prac('x',[{modulo:'1274',codigo:'1.b'},{modulo:'1276',codigo:'1.c'}],{rol:'encargado',items:[8,8,8,8,8]});
ctx={apartadosLibreta, practicas:[pc, prac('y',[{modulo:'1274',codigo:'1.b'}],{valor:5})]};
ok('práctica común cuenta en 1274', N.notaCE(m74,ce(m74,'1.b'),A,ctx).valor, 7);
ok('práctica común cuenta en 1276', N.notaCE(m76,ce(m76,'1.c'),A,ctx).valor, 8);

// ---------- Fase 4: faltas y nota final ----------
const todoMod=(m,valor)=>{ const c={apartadosLibreta, practicas:[], calificaciones:[], libretas:[], ajustes:[], faltas:[], finales:[]};
  for(let ev=1; ev<=m.evaluaciones; ev++){ const t=todo(m,ev,valor); c.practicas.push(...t.practicas); c.calificaciones.push(...t.calificaciones); } return c; };
ok('límite de faltas 1279', N.limiteFaltas(m79), 40.95);
ok('límite de faltas 1274', N.limiteFaltas(m74), 67.2);
ctx=todoMod(m79,()=>6);
ctx.faltas=[{modulo:'1279',ev:1,filas:{[A]:{injustificadas:20,justificadas:10}}},{modulo:'1279',ev:2,filas:{[A]:{injustificadas:5,justificadas:5.95}}}];
ok('40,95 h: no supera', N.faltasHasta(m79,2,A,ctx).supera, false);
ctx.faltas[1].filas[A].justificadas=6;
ok('41 h: supera (cuentan también las justificadas)', N.faltasHasta(m79,2,A,ctx).supera, true);
ok('ev1 sin pérdida', N.notaEvaluacion(m79,1,A,ctx).boletinTexto, '6');
ok('ev2 con pérdida: NE', N.notaEvaluacion(m79,2,A,ctx).boletinTexto, 'NE');
ok('sin justificar acumuladas', N.faltasHasta(m79,2,A,ctx).injustificadas, 25);
// Sin libreta en la 1.ª ev: boletín NE y los RA con prácticas quedan pendientes en la final
ctx=todoMod(m79,()=>6);
ctx.libretas=[{grupo:'G2',ev:1,filas:{[A]:{entregada:false}}}];
ok('sin libreta: ev1 NE', N.notaEvaluacion(m79,1,A,ctx).boletinTexto, 'NE');
ok('sin libreta: ev2 normal', N.notaEvaluacion(m79,2,A,ctx).boletinTexto, '6');
const fl=N.notaFinal(m79,A,ctx);
ok('sin libreta: la final queda sin calcular', fl.fcReal, null);
ctx.libretas[0].filas[A]={entregada:true,apartados:[6,6,6,6,6]};
ok('la entrega después: vuelve la nota', N.notaEvaluacion(m79,1,A,ctx).boletinTexto, '6');
// Nota final
ctx=todoMod(m79,()=>6);
let f=N.notaFinal(m79,A,ctx);
ok('FC real todo 6', f.fcReal, 6); ok('FC boletín', f.fcBoletin, 6); ok('sin FE: caso', f.caso, 'faltaFE');
ctx.finales=[{modulo:'1279',filas:{[A]:{fe:8}}}];
f=N.notaFinal(m79,A,ctx); ok('FE 8: 0,8·6 + 0,2·8 = 6,4 → 6', f.propuesta, 6); ok('caso general', f.caso, 'general');
ctx.finales[0].filas[A].fe=4; ok('FE 4: caso A', N.notaFinal(m79,A,ctx).caso, 'A');
ctx.finales[0].filas[A].fe=3; f=N.notaFinal(m79,A,ctx); ok('FE 3: caso B', f.caso, 'B'); ok('B: 0,8·6+0,2·3 = 5,4 → 5', f.propuesta, 5);
ctx.finales[0].filas[A].fe='exento'; f=N.notaFinal(m79,A,ctx); ok('exento: caso E', f.caso, 'E'); ok('exento: nota = FC', f.propuesta, 6);
ctx.finales[0].filas[A].fe='nocursa'; ok('no cursa: NE', N.notaFinal(m79,A,ctx).propuesta, 'NE');
// FC con RA < 5 y recuperación
ctx=todoMod(m79,(c)=>c.ra==='RA4'?3:8); ctx.finales=[{modulo:'1279',filas:{[A]:{fe:10}}}];
f=N.notaFinal(m79,A,ctx); ok('RA4 = 3: FC boletín máx 4', f.fcBoletin, 4); ok('caso D', f.caso, 'D');
ok('D: 0,8·7 + 0,2·10 = 7,6 → máx 5', f.propuesta, 5);
ctx.finales[0].filas[A].rec={RA4:6};
f=N.notaFinal(m79,A,ctx); ok('recupera RA4 con 6: FC real', f.fcReal, 7.6); ok('FC boletín', f.fcBoletin, 8); ok('recuperados', f.recuperados, 1);
ok('propuesta 0,8·7,6 + 2 = 8,08 → 8', f.propuesta, 8);
// FC ≤ 3: caso C
ctx=todoMod(m79,()=>2); ctx.finales=[{modulo:'1279',filas:{[A]:{fe:10}}}];
f=N.notaFinal(m79,A,ctx); ok('FC 2: caso C', f.caso, 'C'); ok('C: máx 4', f.propuesta, 4);
// Ajuste de actitud final: manual; los de las evaluaciones no cuentan solos
ctx=todoMod(m79,()=>6); ctx.ajustes=[{modulo:'1279',ev:1,filas:{[A]:1}}];
ok('ajuste de evaluación no entra en la final', N.notaFinal(m79,A,ctx).fcReal, 6);
ctx.finales=[{modulo:'1279',filas:{[A]:{ajuste:0.3}}}];
ok('ajuste final manual +0,3', N.notaFinal(m79,A,ctx).fcReal, 6.3);
ctx.finales[0].filas[A].ajuste=-5;
ok('ajuste final limitado a −1', N.notaFinal(m79,A,ctx).fcReal, 5);
// Mención honorífica
ctx=todoMod(m79,()=>10); ctx.finales=[{modulo:'1279',filas:{[A]:{fe:10}}}];
ok('todo 10: candidato MH', N.notaFinal(m79,A,ctx).candidatoMH, true);
ctx.finales[0].filas[A].rec={RA1:10};
ok('con un RA recuperado: no es candidato', N.notaFinal(m79,A,ctx).candidatoMH, false);
// Incompleta
ctx=todoMod(m79,(c)=>c.ra==='RA5'?null:6); ctx.practicas=ctx.practicas.filter(p=>Object.values(p.filas)[0].valor!==null); ctx.calificaciones=ctx.calificaciones.filter(c=>Object.values(c.filas)[0].notas[c.ces[0]]!==null);
f=N.notaFinal(m79,A,ctx); ok('sin RA5: FC sin calcular', f.fcReal, null); ok('incompleta', f.completa, false);

console.log(fallos? `\n${fallos} FALLOS` : '\nTodas las pruebas correctas');
