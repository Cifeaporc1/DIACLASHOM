// Almacén local en IndexedDB. Guarda los registros tal como van a la nube: cifrados.
//  - registros: { id, datos (cifrado), borrado, seq, sucio }
//  - meta: { k, v } con correo, sal, iteraciones, verificador y cursor de sincronización

const NOMBRE = 'diaclashom';
const VERSION = 1;
let dbPromesa = null;

function abrir() {
  if (!dbPromesa) {
    dbPromesa = new Promise((resolver, rechazar) => {
      const pet = indexedDB.open(NOMBRE, VERSION);
      pet.onupgradeneeded = () => {
        const db = pet.result;
        if (!db.objectStoreNames.contains('registros')) db.createObjectStore('registros', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
      };
      pet.onsuccess = () => resolver(pet.result);
      pet.onerror = () => rechazar(pet.error);
    });
  }
  return dbPromesa;
}

function peticion(p) {
  return new Promise((resolver, rechazar) => {
    p.onsuccess = () => resolver(p.result);
    p.onerror = () => rechazar(p.error);
  });
}

async function tienda(nombre, modo = 'readonly') {
  const db = await abrir();
  return db.transaction(nombre, modo).objectStore(nombre);
}

export async function leerMeta(k) {
  const fila = await peticion((await tienda('meta')).get(k));
  return fila ? fila.v : undefined;
}

export async function guardarMeta(k, v) {
  await peticion((await tienda('meta', 'readwrite')).put({ k, v }));
}

export async function todosLosRegistros() {
  return peticion((await tienda('registros')).getAll());
}

export async function guardarRegistros(filas) {
  const db = await abrir();
  await new Promise((resolver, rechazar) => {
    const tx = db.transaction('registros', 'readwrite');
    const st = tx.objectStore('registros');
    for (const f of filas) st.put(f);
    tx.oncomplete = resolver;
    tx.onerror = () => rechazar(tx.error);
  });
}

export async function borrarTodo() {
  const db = await abrir();
  await new Promise((resolver, rechazar) => {
    const tx = db.transaction(['registros', 'meta'], 'readwrite');
    tx.objectStore('registros').clear();
    tx.objectStore('meta').clear();
    tx.oncomplete = resolver;
    tx.onerror = () => rechazar(tx.error);
  });
}
