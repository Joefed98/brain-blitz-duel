/**
 * Builds the Chroma Lines (`flow`) bank in src/lib/duel/flowBank.server.ts.
 *
 *   bun scripts/flow-bank.ts            rebuild and write the bank
 *   bun scripts/flow-bank.ts --check    rebuild and confirm it matches the committed file
 *
 * Every entry is the live generator under a fixed seed, re-verified exactly as
 * the generator accepts a board (see scripts/puzzle-bank-lib.ts).
 */
import { runBankScript } from "./puzzle-bank-lib";

await runBankScript("flow");
