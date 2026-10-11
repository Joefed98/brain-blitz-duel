/**
 * Builds the Lamplighter (`lightup`) bank in src/lib/duel/lightUpBank.server.ts.
 *
 *   bun scripts/lightup-bank.ts            rebuild and write the bank
 *   bun scripts/lightup-bank.ts --check    rebuild and confirm it matches the committed file
 *
 * Every entry is the live generator under a fixed seed, re-verified exactly as
 * the generator accepts a board (see scripts/puzzle-bank-lib.ts).
 */
import { runBankScript } from "./puzzle-bank-lib";

await runBankScript("lightup");
