/*
 * IsoPlayground — temporary Sandbox session storage.
 *
 * Menangani transport payload antar-tab melalui IndexedDB dengan fallback
 * local sesi browser yang disediakan sandbox.js. Modul ini tidak mengubah
 * state permainan atau mengatur tampilan editor.
 */
import { IPConfig } from '../core/config.js';

function openSandboxDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia'));
      return;
    }
    const request = indexedDB.open(IPConfig.SANDBOX_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(IPConfig.SANDBOX_STORE)) {
        request.result.createObjectStore(IPConfig.SANDBOX_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Gagal membuka IndexedDB'));
    request.onblocked = () => reject(new Error('IndexedDB terblokir'));
  });
}

export async function storeSandboxPayload(key, payloadText) {
  const db = await openSandboxDatabase();
  try {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(IPConfig.SANDBOX_STORE, 'readwrite');
      const store = transaction.objectStore(IPConfig.SANDBOX_STORE);
      const cursorRequest = store.openCursor();
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        if (cursor) {
          if (!cursor.value || Date.now() - cursor.value.t > IPConfig.SANDBOX_MAX_AGE_MS) cursor.delete();
          cursor.continue();
        }
      };
      store.put({ t: Date.now(), payload: payloadText }, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Gagal menulis IndexedDB'));
      transaction.onabort = () => reject(transaction.error || new Error('Penulisan IndexedDB dibatalkan'));
    });
  } finally {
    db.close();
  }
}

export async function takeSandboxPayload(key) {
  const db = await openSandboxDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(IPConfig.SANDBOX_STORE, 'readwrite');
      const store = transaction.objectStore(IPConfig.SANDBOX_STORE);
      let result = null;
      const getRequest = store.get(key);
      getRequest.onsuccess = () => {
        result = getRequest.result ? getRequest.result.payload : null;
        store.delete(key);
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error || new Error('Gagal membaca IndexedDB'));
      transaction.onabort = () => reject(transaction.error || new Error('Pembacaan IndexedDB dibatalkan'));
    });
  } finally {
    db.close();
  }
}
