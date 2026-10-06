# Extend Don't Break the Chain

- Increase the chain to 30 links in the existing 45 seconds, with six seeded boards and a new FASTER prompt at link 26.
- Keep five-link position/symbol reshuffles and existing momentum windows; extend the two-second band through link 30.
- Award five points per link, maximum 150, and update SCORE wording and the reveal breakdown.
- Keep the fixed intro illustration unless it mentions the old link count.

## Technical details
- Update shared constants so generation, client completion and server tap-log replay agree.
- Update focused regressions for seeded equality, the sixth board, timing boundaries and partial/full scores; run the stored-score check.
- No browser tests; device checks remain with you.