/**
 * Input checks for server functions (13 Nov 2026). Each helper takes the raw value a phone sent and either returns it
 * in the shape the handler expects or throws an `InvalidInput` naming the field, so a handler only ever sees inputs of
 * the right type and size. Pure; no dependencies, so it costs the phone's bundle almost nothing.
 *
 *   .inputValidator((input: { roomId: string; emoji: string }) => ({
 *     roomId: uuid(input?.roomId, "roomId"),
 *     emoji: text(input?.emoji, 64, "emoji"),
 *   }))
 */

/** The error every helper throws: the field's name only, never the value it was sent. */
export class InvalidInput extends Error {
  constructor(public readonly field: string) {
    super(`Invalid input: ${field}`);
    this.name = "InvalidInput";
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A uuid (any version), lower-cased. */
export function uuid(value: unknown, field: string): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new InvalidInput(field);
  return value.toLowerCase();
}

/** A string of at most `max` characters (code units), and at least `min` (default 0). */
export function text(value: unknown, max: number, field: string, { min = 0 }: { min?: number } = {}): string {
  if (typeof value !== "string" || value.length > max || value.length < min) throw new InvalidInput(field);
  return value;
}

/** A whole number from `min` to `max`. Numeric strings are not accepted. */
export function whole(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new InvalidInput(field);
  return value;
}

/** One of a fixed set of strings. */
export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new InvalidInput(field);
  return value as T;
}

/** A list of at most `max` items, each checked by `item` (which names its own field as `field[i]`). */
export function listOf<T>(value: unknown, max: number, item: (v: unknown, field: string) => T, field: string): T[] {
  if (!Array.isArray(value) || value.length > max) throw new InvalidInput(field);
  return value.map((v, i) => item(v, `${field}[${i}]`));
}

/** A value that may be left out: undefined stays undefined, anything else goes through `check`. */
export function optional<T>(value: unknown, check: (v: unknown) => T): T | undefined {
  return value === undefined ? undefined : check(value);
}

/** The input as an object (never null or an array), for reading its fields. */
export function record(value: unknown, field = "input"): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new InvalidInput(field);
  return value as Record<string, unknown>;
}
