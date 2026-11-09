/**
 * The typed data layer's client (architecture audit B2, Nov 2026): every table read and write in the app goes
 * through a module in `src/lib/data/`, each taking a client typed on the generated `Database`
 * (`src/integrations/supabase/types.ts`), never `any`.
 *
 * - Server code that writes uses the service-role client, `adminDb()`, which bypasses RLS.
 * - A server function's user client (`context.supabase` from `requireSupabaseAuth`) is the same `Db` type and keeps
 *   RLS; the phone's own reads (the browser client, `client.ts`) go through `src/lib/data/roomReads.ts` and `chatReads.ts` and keep RLS too.
 *
 * Only I/O lives here: grading, room rules and presentation stay where they were. A data function issues exactly
 * the query its caller used to (the same filters, order and limits), so the stand-ins the checks use
 * (`scripts/fixtures/memoryDb.ts`, the server-function harness) see the same calls.
 */

import type { Database, Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

import type { Db } from "./db";

export type { Db };

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
  return (lazyAdmin ??= notThenable(supabaseAdmin));
}

let lazyAdmin: Db | undefined;

/**
 * `supabaseAdmin` is a lazy Proxy: its first property read builds the client and throws when the environment has
 * no Supabase keys (local dev servers in the checks). Resolving a promise with it reads `.then`, which would build
 * it (and throw) right here, where the code that used to receive it touched it only inside its own try blocks. So
 * the client goes out through a second Proxy that answers `then` itself and reads everything else through, as
 * before.
 */
function notThenable(client: Db): Db {
  return new Proxy({} as Db, {
    get(_, prop) {
      if (prop === "then") return undefined;
      return Reflect.get(client, prop, client);
    },
  });
}

/**
 * A value stored in a jsonb column. The app's own shapes (puzzles, extras, histories) are plain JSON but typed as
 * interfaces, which TypeScript can't prove are `Json`; this names the one place that is asserted. No copy is made:
 * what was written before is written now.
 */
export function asJson(value: unknown): Json {
  return value as Json;
}
