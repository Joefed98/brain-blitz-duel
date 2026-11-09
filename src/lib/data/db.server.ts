/**
 * The typed data layer's client (architecture audit B2, Nov 2026): every table read and write in the app goes
 * through a module in `src/lib/data/`, each taking a client typed on the generated `Database`
 * (`src/integrations/supabase/types.ts`), never `any`.
 *
 * - Server code that writes uses the service-role client, `adminDb()`, which bypasses RLS.
 * - A server function's user client (`context.supabase` from `requireSupabaseAuth`) is the same `Db` type and keeps
 *   RLS; the phone's own reads (`client.ts`) go through `src/lib/data/*.client.ts` and keep RLS too.
 *
 * Only I/O lives here: grading, room rules and presentation stay where they were. A data function issues exactly
 * the query its caller used to (the same filters, order and limits), so the stand-ins the checks use
 * (`scripts/fixtures/memoryDb.ts`, the server-function harness) see the same calls.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

/** A Supabase client on the generated schema: the service-role client, a server function's user client or the phone's. */
export type Db = SupabaseClient<Database>;

export type { Database, Json, Tables, TablesInsert, TablesUpdate };

/** A PostgREST error as supabase-js reports it (`code` is Postgres's, e.g. 23505 for a unique violation). */
export interface DbError {
  code?: string;
  message: string;
  details?: string;
}

/** Postgres's unique-violation code. */
export const UNIQUE_VIOLATION = "23505";

/**
 * The service-role client (bypasses RLS), loaded on first use so a `*.functions.ts` file that imports this module
 * never pulls the server client into the phone's bundle.
 */
export async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * A value stored in a jsonb column. The app's own shapes (puzzles, extras, histories) are plain JSON but typed as
 * interfaces, which TypeScript can't prove are `Json`; this names the one place that is asserted. No copy is made:
 * what was written before is written now.
 */
export function asJson(value: unknown): Json {
  return value as Json;
}
