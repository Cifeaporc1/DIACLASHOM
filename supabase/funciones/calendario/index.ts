// DIACLASHOM · función «calendario» para Supabase Edge Functions.
// Puente de solo lectura: recibe la dirección secreta iCal de un calendario de Google,
// descarga los eventos y se los devuelve a la app. No guarda nada.
// Solo funciona con sesión iniciada en la app (verificación JWT activada) y solo con calendar.google.com.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const responder = (cuerpo: unknown, estado = 200) =>
    new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });
  try {
    const { url } = await req.json();
    const u = new URL(String(url || ''));
    if (u.protocol !== 'https:' || u.hostname !== 'calendar.google.com' || !u.pathname.startsWith('/calendar/ical/')) {
      return responder({ error: 'Solo se admiten direcciones iCal de calendar.google.com.' }, 400);
    }
    const r = await fetch(u.toString(), { headers: { 'User-Agent': 'DIACLASHOM' } });
    if (!r.ok) return responder({ error: `Google respondió ${r.status}. Revisa la dirección secreta.` }, 502);
    const ics = await r.text();
    if (!ics.includes('BEGIN:VCALENDAR')) return responder({ error: 'La dirección no devuelve un calendario.' }, 502);
    return responder({ ics });
  } catch (e) {
    return responder({ error: String((e as Error).message || e) }, 500);
  }
});
