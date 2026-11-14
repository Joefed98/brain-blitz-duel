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

/** true or false. */
export function bool(value: unknown, field: string): boolean {
  if (typeof value !== "boolean") throw new InvalidInput(field);
  return value;
}

/** A finite number (any size or fraction; a handler that wants a range judges it, so its own answer stays). */
export function num(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new InvalidInput(field);
  return value;
}

/** A value that may be null: null stays null, anything else goes through `check`. */
export function nullable<T>(value: unknown, check: (v: unknown) => T): T | null {
  return value === null ? null : check(value);
}

/**
 * An object of at most `maxKeys` keys, each a string of at most `keyMax` characters, every value checked by `item`
 * (which names its field as `field.key`). The keys stay as sent, so a handler that judges which keys it knows (and
 * answers an unknown one softly) still sees them; the result is built with own properties only (a `__proto__` key
 * stays a plain key).
 */
export function recordOf<T>(
  value: unknown,
  maxKeys: number,
  keyMax: number,
  item: (v: unknown, field: string) => T,
  field = "input",
): Record<string, T> {
  const body = record(value, field);
  const keys = Object.keys(body);
  if (keys.length > maxKeys || keys.some((k) => k.length > keyMax)) throw new InvalidInput(field);
  return Object.fromEntries(keys.map((k) => [k, item(body[k], `${field}.${k}`)]));
}

/**
 * Any JSON value whose JSON text is at most `maxChars` characters (and, if it is a list, at most `maxItems` long),
 * passed on as it is: for a field whose shape the handler judges itself (and answers softly), so only its size is
 * checked here.
 */
export function sized(value: unknown, maxChars: number, field: string, { maxItems }: { maxItems?: number } = {}): unknown {
  if (maxItems !== undefined && Array.isArray(value) && value.length > maxItems) throw new InvalidInput(field);
  let json: string | undefined;
  try {
    json = JSON.stringify(value);
  } catch {
    throw new InvalidInput(field);
  }
  if (json !== undefined && json.length > maxChars) throw new InvalidInput(field);
  return value;
}
