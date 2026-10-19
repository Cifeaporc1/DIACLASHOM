// Pruebas del lector de calendarios. Ejecutar: TZ=Europe/Madrid node pruebas/ical.test.mjs
const I = await import('../js/ical.js');
let fallos = 0;
const ok = (n, r, e) => { const b = JSON.stringify(r) === JSON.stringify(e); if (!b) fallos++; console.log(b ? 'OK  ' : 'FALLO', n, '→', JSON.stringify(r), b ? '' : `(esperado ${JSON.stringify(e)})`); };
const hm = (d) => `${String(d.getDate()).padStart(2, '0')}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
const ICS = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:a1
DTSTART;TZID=Europe/Madrid:20261020T170000
DTEND;TZID=Europe/Madrid:20261020T183000
SUMMARY:Claustro ordinario
LOCATION:Salón de actos\\, CIFEA
DESCRIPTION:Orden del día:\\n1. Calendario
END:VEVENT
BEGIN:VEVENT
UID:a2
DTSTART:20261021T090000Z
DTEND:20261021T100000Z
SUMMARY:Reunión en UTC
END:VEVENT
BEGIN:VEVENT
UID:a3
DTSTART;VALUE=DATE:20261023
DTEND;VALUE=DATE:20261024
SUMMARY:Visita a Sepor
END:VEVENT
BEGIN:VEVENT
UID:r1
DTSTART;TZID=Europe/Madrid:20261005T160000
DTEND;TZID=Europe/Madrid:20261005T170000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE
EXDATE;TZID=Europe/Madrid:20261021T160000
SUMMARY:Reunión de departamento
END:VEVENT
BEGIN:VEVENT
UID:r1
RECURRENCE-ID;TZID=Europe/Madrid:20261019T160000
DTSTART;TZID=Europe/Madrid:20261019T180000
DTEND;TZID=Europe/Madrid:20261019T190000
SUMMARY:Reunión de departamento (cambiada)
END:VEVENT
BEGIN:VEVENT
UID:r2
DTSTART;TZID=Europe/Madrid:20260901T080000
DTEND;TZID=Europe/Madrid:20260901T083000
RRULE:FREQ=MONTHLY;BYDAY=1TH;COUNT=3
SUMMARY:Primer jueves
END:VEVENT
BEGIN:VEVENT
UID:x1
DTSTART;TZID=Europe/Madrid:20261022T120000
DTEND;TZID=Europe/Madrid:20261022T130000
STATUS:CANCELLED
SUMMARY:Cancelada
END:VEVENT
BEGIN:VEVENT
UID:c1
DTSTART;TZID=Europe/Madrid:20261026T100000
DTEND;TZID=Europe/Madrid:20261026T110000
RRULE:FREQ=DAILY;COUNT=2
SUMMARY:Tras el cambio de hora
END:VEVENT
END:VCALENDAR`;
const ev = I.leerICS(ICS);
const semana = I.eventosEntre(ev, new Date(2026, 9, 19), new Date(2026, 9, 26));
ok('semana del 19 al 25 de octubre', semana.map((e) => `${hm(e.inicio)} ${e.titulo}${e.todoElDia ? ' (día)' : ''}`), [
  '19/10 18:00 Reunión de departamento (cambiada)',
  '20/10 17:00 Claustro ordinario',
  '21/10 11:00 Reunión en UTC',
  '23/10 0:00 Visita a Sepor (día)',
]);
ok('lugar y descripción desescapados', [semana[1].lugar, semana[1].descripcion], ['Salón de actos, CIFEA', 'Orden del día:\n1. Calendario']);
const oct = I.eventosEntre(ev, new Date(2026, 9, 5), new Date(2026, 9, 12));
ok('semanal lunes y miércoles', oct.filter((e) => e.titulo.startsWith('Reunión de dep')).map((e) => hm(e.inicio)), ['05/10 16:00', '07/10 16:00']);
const otoño = I.eventosEntre(ev, new Date(2026, 8, 1), new Date(2026, 11, 31));
ok('mensual 1.er jueves, 3 veces', otoño.filter((e) => e.titulo === 'Primer jueves').map((e) => hm(e.inicio)), ['03/9 8:00', '01/10 8:00', '05/11 8:00']);
ok('cambio de hora: sigue a las 10:00', I.eventosEntre(ev, new Date(2026, 9, 25), new Date(2026, 9, 28)).filter((e) => e.titulo.startsWith('Tras')).map((e) => hm(e.inicio)), ['26/10 10:00', '27/10 10:00']);
console.log(fallos ? `\n${fallos} FALLOS` : '\nTodas las pruebas correctas');
