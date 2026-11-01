import { normaliseInputType } from "@/lib/inputType";

/**
 * Stores a result's input type (lib/inputType.ts) beside it, best effort: one update on the row just
 * stored, after it is stored, so a database without the column (migration
 * 20261031170000_result_input_type.sql, written but not applied) answers with an error that is ignored
 * and the result is exactly as before. Never read by grading or scoring.
 */
export async function recordInputType(
  client: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  table: "round_results" | "async_results",
  match: Record<string, string | number>,
  value: unknown,
): Promise<void> {
  const inputType = normaliseInputType(value);
  if (!inputType) return;
  try {
    let query = client.from(table).update({ input_type: inputType });
    for (const [key, v] of Object.entries(match)) query = query.eq(key, v);
    await query;
  } catch {
    /* Best effort: recording how a round was played is never worth failing a submission for. */
  }
}
