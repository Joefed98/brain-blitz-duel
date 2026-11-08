/**
 * Security fix L1 (Nov 2026 audit): a database error is logged here in full and the caller gets a plain message,
 * never Postgres' text (column and constraint names, "invalid input syntax for type uuid"), which TanStack serialises
 * to the phone with a thrown error.
 */
export const DB_ERROR_MESSAGE = "Something went wrong there. Give it another go.";

export function dbError(error: { message?: unknown; code?: unknown } | null | undefined, where: string): Error {
  console.error(`[db] ${where}: ${String(error?.message ?? "unknown error")}${error?.code ? ` (${String(error.code)})` : ""}`);
  return new Error(DB_ERROR_MESSAGE);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a room, attempt or player id shaped as the database stores it (checked before any query uses it). */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
