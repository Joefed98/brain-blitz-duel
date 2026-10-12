/**
 * Quick or full depth for the slow checks (snip-check, puzzle-bank-check).
 *
 * Quick is the default: pull-request CI runs and local runs. Full runs the
 * original, exhaustive sample:
 *   bun scripts/snip-check.ts --full
 *   bun scripts/run-checks.ts --full        # passes CHECKS_FULL=1 to every check
 *   Actions → Checks → Run workflow with "full"
 */
export const FULL_DEPTH = process.argv.includes("--full") || process.env.CHECKS_FULL === "1";

/** Positional command-line arguments (flags such as --full dropped). */
export const depthArgs = (): string[] => process.argv.slice(2).filter((a) => !a.startsWith("--"));
