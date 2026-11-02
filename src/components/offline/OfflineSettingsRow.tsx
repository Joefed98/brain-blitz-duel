import { useEffect, useState } from "react";

import { useOfflineVersion } from "@/lib/offline/events";
import { topUpPacks } from "@/lib/offline/packs";
import { offlineDownloadsOn, setOfflineDownloads } from "@/lib/offline/settings";

/** "12.4 MB" (one decimal under 100 MB). */
export function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  if (mb < 0.1) return `${Math.max(0, Math.round(bytes / 1024))} KB`;
  return `${mb < 100 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** What this site stores on the phone (the app files, sounds and music, packs and queued runs), as the browser counts it. */
export async function offlineStorageUsed(): Promise<number | null> {
  try {
    const estimate = await navigator.storage?.estimate?.();
    return typeof estimate?.usage === "number" ? estimate.usage : null;
  } catch {
    return null;
  }
}

/**
 * Settings' Offline practice row (31 Oct 2026): the storage used on this phone and the switch for downloading
 * practice packs (on by default). Off: no more packs are downloaded; packs already saved still play, and queued
 * runs are still sent for grading.
 */
export function OfflineSettingsRow() {
  const [on, setOn] = useState(true);
  const [used, setUsed] = useState<number | null>(null);
  const version = useOfflineVersion();
  useEffect(() => setOn(offlineDownloadsOn()), []);
  useEffect(() => {
    let live = true;
    void offlineStorageUsed().then((bytes) => {
      if (live) setUsed(bytes);
    });
    return () => {
      live = false;
    };
  }, [version, on]);
  const toggle = () => {
    const next = !on;
    setOfflineDownloads(next);
    setOn(next);
    if (next) void topUpPacks();
  };
  return (
    <button type="button" role="switch" aria-checked={on} aria-label="Offline practice" data-offline-settings onClick={toggle} className="ap-row press">
      <span className="ap-row-text min-w-0 flex-1 text-left">
        <span className="ap-row-title block">Offline practice</span>
        <span data-offline-storage className="ap-row-sub block">
          {used === null ? "Saves games to play with no signal" : `${formatBytes(used)} used on this phone`}
        </span>
      </span>
      <span aria-hidden="true" className="rs-switch" data-on={on ? "" : undefined}>
        <span />
      </span>
    </button>
  );
}
