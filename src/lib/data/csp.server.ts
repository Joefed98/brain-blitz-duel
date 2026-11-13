/**
 * The content security policy trial's reports (`public.csp_reports`, 13 Nov 2026): the service role writes them, nobody
 * reads them through the API (Joe reads them in the dashboard; docs/security/csp-trial.md has the query).
 */
import type { Db } from "./db.server";
import type { Result } from "./rooms.server";

/** Stores report rows: the directive and the blocked host only. */
export async function insertCspReports(client: Db, rows: { directive: string; blocked_host: string }[]): Promise<Result<null>> {
  const { error } = await client.from("csp_reports").insert(rows);
  return { data: null, error };
}
