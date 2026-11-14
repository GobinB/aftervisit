import "client-only";

const DB_NAME = "aftervisit";
const STORE = "circle-keys";

export type LocalCircleKey = {
  circleId: string;
  keyVersion: number;
  key: CryptoKey;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("This browser cannot store the key."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "circleId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("This browser cannot store the key."));
  });
}

export async function saveCircleKey(circleId: string, key: CryptoKey, keyVersion: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("This browser could not store the key."));
    tx.objectStore(STORE).put({ circleId, keyVersion, key } satisfies LocalCircleKey);
  });
  db.close();
}

export async function loadCircleKey(circleId: string): Promise<LocalCircleKey | null> {
  const db = await openDb();
  const row = await new Promise<LocalCircleKey | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).get(circleId);
    request.onsuccess = () => resolve(request.result as LocalCircleKey | undefined);
    request.onerror = () => reject(request.error ?? new Error("This browser could not read the key."));
  });
  db.close();
  if (!row?.key) return null;
  return row;
}

/** Every circle key kept on this device. */
export async function listCircleKeys(): Promise<LocalCircleKey[]> {
  const db = await openDb();
  const rows = await new Promise<LocalCircleKey[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).getAll();
    request.onsuccess = () => resolve((request.result as LocalCircleKey[]) ?? []);
    request.onerror = () => reject(request.error ?? new Error("This browser could not read the keys."));
  });
  db.close();
  return rows.filter((row) => row?.key && typeof row.circleId === "string");
}

/** Removes one circle's key from this device. */
export async function removeCircleKey(circleId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("This browser could not remove the key."));
    tx.objectStore(STORE).delete(circleId);
  });
  db.close();
}
