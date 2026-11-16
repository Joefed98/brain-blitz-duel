/**
 * pattern-demos-serve (15 Nov 2026): a dev server on a throwaway local database, for recording and test-saving the
 * Pattern overhaul's intro demos (pattern-demos-record.ts, pattern-demos-save.ts). A tool, not a check.
 *
 *   bun scripts/pattern-demos-serve.ts [port=5397]
 *
 * The server-function harness's PostgreSQL (every migration applied) and its PostgREST / GoTrue stand-in, with
 * unblock_bank loaded from the fallback bank in its order (Gridlock's intro example is the table's first row, as live),
 * then `vite dev` on 127.0.0.1 with SUPABASE_* pointed at it and INTRO_DEMO_KEY "localdemokey" unless set. Runs until
 * stopped; the database goes with it. The socket directory is printed for psql (rate limits: `DELETE FROM
 * public.rate_limit_hits`).
 */
import { spawn } from "node:child_process";

import { ANON_KEY, SERVICE_KEY, startLocalDb, startRestServer } from "./server-fn-harness";
import { UNBLOCK_BANK } from "../src/lib/duel/unblockBank.server";

const port = process.argv[2] ?? "5397";
const db = startLocalDb("pattern-demos-serve-");
if (db.failed) throw new Error(`migration failed ${db.failed.file}: ${db.failed.error}`);
const values = UNBLOCK_BANK.map((e) => {
  const [l, m, s] = e.split("|");
  return `('${l}', ${Number(m)}, '${s}')`;
});
const loaded = db.psql(`INSERT INTO public.unblock_bank (layout, min_moves, solution) VALUES ${values.join(",")};`);
if (!loaded.ok) throw new Error(loaded.err);
const rest = await startRestServer(db.socketDir);
console.log(`database socket ${db.socketDir}, REST ${rest.url}`);
const vite = spawn("bunx", ["vite", "dev", "--host", "127.0.0.1", "--port", port, "--strictPort"], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_OPTIONS: process.env["NODE_OPTIONS"] ?? "--max-old-space-size=6144",
    SUPABASE_URL: rest.url,
    VITE_SUPABASE_URL: rest.url,
    SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
    SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: ANON_KEY,
    INTRO_DEMO_KEY: process.env["INTRO_DEMO_KEY"] ?? "localdemokey",
  },
});
const stop = async () => {
  vite.kill();
  await rest.stop();
  db.stop();
  process.exit(0);
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
vite.on("exit", stop);
