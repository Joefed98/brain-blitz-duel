# Scripts

- Colour Flood: the routine check (scripts/logic-grid-check.ts) quick-tests every bank board and runs the exhaustive par proof on a seeded sample of 40; the full proof (scripts/flood-par-proof.ts) runs only at bank rebuild; why: proving all 400 is too slow for a routine run.
