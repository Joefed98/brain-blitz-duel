import { normaliseInputType } from "@/lib/inputType";

/** What recording a result's input type came to; never read by grading or scoring. */
export type InputTypeRecord =
  | { ok: true; inputType: string }
  /** Nothing usable was sent (older phones, or no press noticed): nothing to store. */
  | { ok: true; inputType: null }
  /** The update failed or matched no row; `error` says why, and it was logged. */
  | { ok: false; inputType: string; error: string };

/**
 * Stores a result's input type (lib/inputType.ts) beside it: one update on the row just stored, after it is
 * stored. Never fails the submission (the result is already stored and graded), but a failure is no longer
 * silent (build-health audit, 7 Nov 2026): a database error, a thrown client or an update that matched no row
 * is logged with `console.error` under `[input-type]` and returned, so ratings that split touch from mouse can
 * trust the column and a check can see a broken write. A database without the column (migration
 * 20261031170000_result_input_type.sql, written but not applied) now logs that error on each result.
 */
export async function recordInputType(
  client: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  table: "round_results" | "async_results",
  match: Record<string, string | number>,
  value: unknown,
): Promise<InputTypeRecord> {
  const inputType = normaliseInputType(value);
  if (!inputType) return { ok: true, inputType: null };
  const where = Object.entries(match)
    .map(([key, v]) => `${key}=${v}`)
    .join(", ");
  const failed = (error: string): InputTypeRecord => {
    console.error(
      `[input-type] ${table} (${where}): input_type "${inputType}" not stored: ${error}`,
    );
    return { ok: false, inputType, error };
  };
  try {
    let query = client.from(table).update({ input_type: inputType });
    for (const [key, v] of Object.entries(match)) query = query.eq(key, v);
    const { data, error } = (await query.select("id")) ?? {};
    if (error) return failed(String(error.message ?? error.code ?? "update failed"));
    if (!Array.isArray(data) || data.length === 0) return failed("no stored result matched");
    return { ok: true, inputType };
  } catch (err) {
    return failed(err instanceof Error ? err.message : String(err));
  }
}
