/**
 * The phone's offline store (offline practice, 31 Oct 2026): one IndexedDB database with the practice packs
 * (one record a game) and the runs played away from the server (one record a run, kept until the server has
 * confirmed or rejected it). Device data only; nothing here is ever a score the app trusts.
 */
export const OFFLINE_DB = "joulz-offline";
const DB_VERSION = 1;
export type OfflineStore = "packs" | "runs";

let opening: Promise<IDBDatabase> | null = null;

export function offlineDbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  if (!offlineDbAvailable()) return Promise.reject(new Error("no IndexedDB"));
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(OFFLINE_DB, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("packs")) db.createObjectStore("packs", { keyPath: "type" });
      if (!db.objectStoreNames.contains("runs")) db.createObjectStore("runs", { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      // Another tab's newer version: let it upgrade, and open again next time.
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      opening = null;
      reject(request.error ?? new Error("IndexedDB open failed"));
    };
  });
  return opening;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

async function store(name: OfflineStore, mode: IDBTransactionMode): Promise<{ store: IDBObjectStore; complete: Promise<void> }> {
  const db = await openDb();
  const tx = db.transaction(name, mode);
  const complete = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
  return { store: tx.objectStore(name), complete };
}

export async function getAll<T>(name: OfflineStore): Promise<T[]> {
  const { store: s } = await store(name, "readonly");
  return (await done(s.getAll())) as T[];
}

export async function getOne<T>(name: OfflineStore, key: string): Promise<T | null> {
  const { store: s } = await store(name, "readonly");
  return ((await done(s.get(key))) as T | undefined) ?? null;
}

export async function putOne<T>(name: OfflineStore, value: T): Promise<void> {
  const { store: s, complete } = await store(name, "readwrite");
  s.put(value);
  await complete;
}

export async function deleteOne(name: OfflineStore, key: string): Promise<void> {
  const { store: s, complete } = await store(name, "readwrite");
  s.delete(key);
  await complete;
}

/** Reads one record and writes back what `change` returns (null deletes it), in one transaction. */
export async function update<T>(name: OfflineStore, key: string, change: (current: T | null) => T | null): Promise<T | null> {
  const { store: s, complete } = await store(name, "readwrite");
  const current = ((await done(s.get(key))) as T | undefined) ?? null;
  const next = change(current);
  if (next === null) s.delete(key);
  else s.put(next);
  await complete;
  return next;
}
