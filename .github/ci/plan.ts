/**
 * Which check files each CI shard runs (1 Nov 2026). Shared by run-shard.ts and ci-shards-check.
 *
 *  - A fast shard (checks.yml, every push) runs its listed checks that start no browser; the catch-all (g) also runs
 *    every unlisted check that starts no browser.
 *  - A browser shard (full-suite.yml, ready to merge) runs its listed checks; BROWSER_CATCH_ALL (play21) also runs
 *    every unlisted browser check and any browser check listed in a fast shard.
 *
 * So every routine check runs in exactly one workflow, and no browser starts on a push.
 */
import { allCheckFiles, isBrowserCheck } from "./browser";
import { BROWSER_CATCH_ALL, CATCH_ALL, CI_SKIP, OPTIONAL, SHARDS, isBrowserShard } from "./shards";

export const base = (entry: string) => entry.split("@")[0]!;

export type ShardPlan = {
  /** Entries this shard runs (`file` or `file@k/n`). */
  files: string[];
  /** Entries listed here that are not in this branch yet. */
  notYet: string[];
  /** Unlisted checks the shard picked up (catch-alls only). */
  unassigned: string[];
  /** Browser checks listed in this fast shard, run in BROWSER_CATCH_ALL instead. */
  movedToBrowser: string[];
  /** Listed (or skipped) files no longer in the branch. */
  stale: string[];
};

export function shardPlan(shard: string, checks: string[] = allCheckFiles()): ShardPlan {
  const listedEntries = Object.values(SHARDS).flat();
  const listed = new Set(listedEntries.map(base));
  const stale = [...listed, ...Object.keys(CI_SKIP)].filter((f) => !checks.includes(f));
  const present = (entry: string) => checks.includes(base(entry)) && !(base(entry) in CI_SKIP);
  const own = SHARDS[shard] ?? [];
  const notYet = own.filter((f) => !checks.includes(base(f)));
  const unlisted = checks.filter((f) => !listed.has(f) && !OPTIONAL.includes(f) && !(f in CI_SKIP));

  if (!isBrowserShard(shard)) {
    const movedToBrowser = own.filter((f) => present(f) && isBrowserCheck(f));
    const unassigned = shard === CATCH_ALL ? unlisted.filter((f) => !isBrowserCheck(f)) : [];
    const files = [...own.filter((f) => present(f) && !isBrowserCheck(f)), ...unassigned];
    return { files, notYet, unassigned, movedToBrowser, stale };
  }

  let unassigned: string[] = [];
  if (shard === BROWSER_CATCH_ALL) {
    const fastListed = Object.entries(SHARDS)
      .filter(([k]) => !isBrowserShard(k))
      .flatMap(([, v]) => v)
      .filter((f) => present(f) && isBrowserCheck(f));
    unassigned = [...unlisted.filter((f) => isBrowserCheck(f)), ...fastListed];
  }
  return { files: [...own.filter(present), ...unassigned], notYet, unassigned, movedToBrowser: [], stale };
}
