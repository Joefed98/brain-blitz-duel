/** The Offline practice switch (Settings): packs download only while it is on (the default). Device storage. */
export const OFFLINE_DOWNLOADS_KEY = "duelz-offline-downloads:v1";

export function offlineDownloadsOn(): boolean {
  try {
    return window.localStorage.getItem(OFFLINE_DOWNLOADS_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setOfflineDownloads(on: boolean): void {
  try {
    window.localStorage.setItem(OFFLINE_DOWNLOADS_KEY, on ? "on" : "off");
  } catch {
    /* storage blocked: downloads stay on */
  }
}

/** A connection the browser reports as metered or data-saving (Chrome's Network Information API; iOS reports none). */
export function meteredConnection(): boolean {
  try {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; metered?: boolean } }).connection;
    return Boolean(connection && (connection.saveData === true || connection.metered === true));
  } catch {
    return false;
  }
}
