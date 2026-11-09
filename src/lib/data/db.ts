/**
 * The data layer's client type, shared by the server modules (`*.server.ts`) and the phone's reads
 * (`roomReads.ts`, `chatReads.ts`; never named `*.client.ts`, which the server build refuses). Types only, so a phone module can name it without reaching server code.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/** A Supabase client on the generated schema: the service-role client, a server function's user client or the phone's. */
export type Db = SupabaseClient<Database>;
