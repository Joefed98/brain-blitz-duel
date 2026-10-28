/**
 * The build id and the rules for comparing it, shared by the phone and the server.
 *
 * vite.config.ts defines `__DUELZ_BUILD_ID__` once per build, so the phone bundle
 * and the server bundle of one Publish carry the same id. The server hands its id
 * out through `appVersionFn` (appVersion.functions.ts); a phone whose own id
 * differs is running a stale copy and updates itself (appUpdate.ts). Outside a
 * Vite build (bun scripts) the id is "dev", which is never treated as stale.
 */

declare const __DUELZ_BUILD_ID__: string | undefined;

export const DEV_BUILD_ID = "dev";

export const APP_BUILD_ID: string =
  typeof __DUELZ_BUILD_ID__ === "string" && __DUELZ_BUILD_ID__ ? __DUELZ_BUILD_ID__ : DEV_BUILD_ID;

/** Search parameter that makes the reload a fresh document request; removed on arrival. */
export const VERSION_PARAM = "_v";

/** True when the server runs a different real build from this copy of the app. */
export function isStaleVersion(clientId: string, serverId: string | null | undefined): boolean {
  if (!serverId || serverId === DEV_BUILD_ID || clientId === DEV_BUILD_ID) return false;
  return serverId !== clientId;
}

/**
 * Where the reload goes: the same page (path, other search parameters and hash
 * kept, so a room link lands back in that room) with the server's build id added.
 */
export function reloadUrl(href: string, serverId: string): string {
  const url = new URL(href);
  url.searchParams.set(VERSION_PARAM, serverId);
  return url.toString();
}

/** The address with the reload marker removed, or null when there was none. */
export function withoutVersionParam(href: string): string | null {
  const url = new URL(href);
  if (!url.searchParams.has(VERSION_PARAM)) return null;
  url.searchParams.delete(VERSION_PARAM);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * The server's note on an answer: null when it came from the current build,
 * otherwise a log line naming the stale (or pre-version, unstamped) client.
 */
export function staleSubmissionNote(
  kind: string,
  clientVersion: unknown,
  context: string,
  serverId: string = APP_BUILD_ID,
): string | null {
  const client = typeof clientVersion === "string" && clientVersion ? clientVersion : null;
  if (client === null) {
    return serverId === DEV_BUILD_ID
      ? null
      : `stale_client ${kind}: no client version (pre-version copy), server ${serverId} (${context})`;
  }
  if (!isStaleVersion(client, serverId)) return null;
  return `stale_client ${kind}: client ${client}, server ${serverId} (${context})`;
}

/**
 * The build id as Profile → Settings → About shows it: the commit's first 8 characters and the build time in UK
 * time ("81ed1b5a · 28 Oct 02:30"), so anyone can tell which code is live. "no commit" when the build had no git.
 */
export function buildLabel(id: string): string {
  if (!id || id === DEV_BUILD_ID) return DEV_BUILD_ID;
  const cut = id.lastIndexOf("-");
  const commit = cut > 0 ? id.slice(0, cut) : id;
  const ms = cut > 0 ? parseInt(id.slice(cut + 1), 36) : NaN;
  const name = commit === "build" ? "no commit" : commit.slice(0, 8);
  if (!Number.isFinite(ms) || ms <= 0) return name;
  const when = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ms));
  return `${name} · ${when.replace(",", "")}`;
}
