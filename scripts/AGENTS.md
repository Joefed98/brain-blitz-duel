# Scripts

- Colour Flood: the routine check (scripts/logic-grid-check.ts) quick-tests every bank board and runs the exhaustive par proof on a seeded sample of 40; the full proof (scripts/flood-par-proof.ts) runs only at bank rebuild; why: proving all 400 is too slow for a routine run.
- Puzzle banks (flow, blockparty, tubes, gravity, lightup, iceslide): the routine check (scripts/puzzle-bank-check.ts) verifies every entry and rebuilds a sample from its fixed seed; the byte-for-byte rebuild of all six (scripts/puzzle-bank-rebuild-check.ts, ~20 min) is optional; why: a full rebuild is far over the 300 s check limit.
