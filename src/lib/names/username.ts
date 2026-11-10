/**
 * Username and guest-name shapes (10 Nov 2026, accounts), shared by the phone and the server. The server's full
 * check (word filter, reserved names, look-alikes, availability) is src/lib/names/names.server.ts.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;
/** Letters, numbers and underscores (ASCII), 3–16 of them. Unique ignoring capitals; stored and shown as typed. */
export const USERNAME_RE = /^[A-Za-z0-9_]{3,16}$/;

/** Guest room names: up to 16 code points, spaces allowed, not unique. */
export const GUEST_NAME_MAX = 16;

/** The key a username is unique on (ignoring capitals). */
export function usernameKey(username: string): string {
  return username.toLowerCase();
}

export type UsernameShapeProblem = "empty" | "length" | "characters";

/** What is wrong with a username's shape, or null when its shape is fine. */
export function usernameShapeProblem(raw: unknown): UsernameShapeProblem | null {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return "empty";
  if (!/^[A-Za-z0-9_]*$/.test(name)) return "characters";
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) return "length";
  return null;
}
