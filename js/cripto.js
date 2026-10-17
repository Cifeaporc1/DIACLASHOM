// Cifrado de DIACLASHOM. Todo ocurre en el dispositivo con la Web Crypto API del navegador.
//
// De la clave de Luis salen dos cosas distintas:
//  - la contraseña de acceso a Supabase (PBKDF2 con una sal fija ligada al correo),
//  - la llave de cifrado AES-GCM de 256 bits (PBKDF2 con una sal aleatoria guardada en el perfil).
// Supabase nunca recibe la clave ni la llave: solo la contraseña de acceso derivada,
// de la que no se puede sacar la llave de cifrado.

const enc = new TextEncoder();
const dec = new TextDecoder();

export const ITER_CIFRADO = 600000;
export const ITER_ACCESO = 200000;
const TEXTO_VERIFICADOR = 'DIACLASHOM-OK';

export function aBase64(bytes) {
  let s = '';
  const b = new Uint8Array(bytes);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

export function deBase64(texto) {
  const s = atob(texto);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

export function salAleatoria() {
  return aBase64(crypto.getRandomValues(new Uint8Array(16)));
}

async function materialDeClave(clave) {
  return crypto.subtle.importKey('raw', enc.encode(clave.normalize('NFC')), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
}

// Contraseña para iniciar sesión en Supabase.
export async function contrasenaAcceso(clave, correo) {
  const material = await materialDeClave(clave);
  const sal = enc.encode('diaclashom-acceso|' + correo.trim().toLowerCase());
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: ITER_ACCESO }, material, 256);
  return aBase64(bits);
}

// Llave de cifrado. No se puede exportar: solo vive en la memoria de esta pestaña.
export async function llaveCifrado(clave, salBase64, iteraciones = ITER_CIFRADO) {
  const material = await materialDeClave(clave);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: deBase64(salBase64), iterations: iteraciones },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Cifra un objeto. El id del registro va como dato adicional autenticado:
// un bloque no se puede mover a otro registro sin que falle el descifrado.
export async function cifrar(llave, objeto, id) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = enc.encode(JSON.stringify(objeto));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(id) }, llave, datos);
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), 12);
  return aBase64(out);
}

export async function descifrar(llave, texto, id) {
  const b = deBase64(texto);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12), additionalData: enc.encode(id) }, llave, b.subarray(12));
  return JSON.parse(dec.decode(pt));
}

export async function crearVerificador(llave) {
  return cifrar(llave, TEXTO_VERIFICADOR, 'verificador');
}

export async function comprobarVerificador(llave, verificador) {
  try {
    return (await descifrar(llave, verificador, 'verificador')) === TEXTO_VERIFICADOR;
  } catch {
    return false;
  }
}
