/**
 * The phone's side of Joulz Plus (wave 2, session E2): the status, a tester's test purchase, the PLUS chip, the Daily
 * archive and early access, through src/lib/plus/plus.functions.ts. Nothing here decides a rule; the server answers.
 */
import { useEffect, useState, useSyncExternalStore } from "react";

import type { ArchiveDay } from "./archive.server";
import type { PlusStatus } from "./plus.server";

export type { ArchiveDay, PlusStatus };

type Fns = typeof import("./plus.functions");
let fnsOverride: Partial<Fns> | null = null;
/** Checks only: stands in for the server functions. */
export function setPlusFns(next: Partial<Fns> | null): void {
  fnsOverride = next;
  status = undefined;
  asking = null;
  held = [];
  heldAsked = false;
  publish();
}
async function fns(): Promise<Fns> {
  if (fnsOverride) return fnsOverride as Fns;
  return import("./plus.functions");
}

/* The status, shared by the Shop's Plus part, Profile and the archive. undefined: not asked yet; null: no answer. */
let status: PlusStatus | null | undefined;
let asking: Promise<PlusStatus | null> | null = null;
const listeners = new Set<() => void>();
function publish(): void {
  for (const l of listeners) l();
}

export function refreshPlus(): Promise<PlusStatus | null> {
  asking = (async () => {
    try {
      const f = await fns();
      status = (await f.plusStatusFn()) as PlusStatus;
    } catch {
      status = null;
    }
    publish();
    return status;
  })();
  return asking;
}

/** The account's Plus status (null until the server answers, or for a guest). */
export function usePlusStatus(signedIn: boolean): PlusStatus | null {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
    () => undefined,
  );
  useEffect(() => {
    if (signedIn && status === undefined && !asking) void refreshPlus();
  }, [signedIn]);
  return signedIn ? (value ?? null) : null;
}

export async function testPurchasePlus(plan: "monthly" | "yearly"): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const f = await fns();
    const answer = (await f.plusTestPurchaseFn({ data: { plan } })) as { ok: true; status: PlusStatus } | { ok: false; message: string };
    if (!answer.ok) return { ok: false, message: answer.message };
    status = answer.status;
    publish();
    return { ok: true };
  } catch {
    return { ok: false, message: "That didn’t go through. Check your connection and try again." };
  }
}

export async function setPlusMark(on: boolean): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const f = await fns();
    const answer = (await f.plusSetMarkFn({ data: { on } })) as { ok: true } | { ok: false; message: string };
    if (!answer.ok) return answer;
    if (status?.member) status = { ...status, member: { ...status.member, showMark: on } };
    publish();
    return { ok: true };
  } catch {
    return { ok: false, message: "That didn’t save. Try again." };
  }
}

export async function dailyArchive(): Promise<{ ok: true; days: ArchiveDay[] } | { ok: false; message: string }> {
  try {
    const f = await fns();
    return (await f.dailyArchiveFn()) as { ok: true; days: ArchiveDay[] } | { ok: false; message: string };
  } catch {
    return { ok: false, message: "Couldn’t load the archive. Try again." };
  }
}

export async function startDailyArchive(kind: string, day: string): Promise<{ ok: true; roomId: string } | { ok: false; message: string }> {
  try {
    const f = await fns();
    return (await f.dailyArchiveStartFn({ data: { kind, day } })) as { ok: true; roomId: string } | { ok: false; message: string };
  } catch {
    return { ok: false, message: "Couldn’t start that Daily. Try again." };
  }
}

/* Early access: the games held back from this device in Practice today (asked once per app open). */
let held: string[] = [];
let heldAsked = false;
const heldListeners = new Set<(v: string[]) => void>();
export function useEarlyAccessHeld(): string[] {
  const [value, setValue] = useState<string[]>(held);
  useEffect(() => {
    heldListeners.add(setValue);
    if (!heldAsked) {
      heldAsked = true;
      void fns()
        .then((f) => f.earlyAccessFn())
        .then((answer) => {
          held = Array.isArray(answer?.held) ? answer.held.filter((g): g is string => typeof g === "string") : [];
          for (const l of heldListeners) l(held);
        })
        .catch(() => undefined);
    }
    return () => {
      heldListeners.delete(setValue);
    };
  }, []);
  return value;
}
