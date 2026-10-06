# Fix Colour Clash spawning

- Replace the fixed centre-lane spawn with a seeded random draw from the lane count at the item's spawn tick.
- Define the three-/four-lane counts and 30-second transition once as integer constants.
- Keep inputs, colours, scoring and timing unchanged.

## Verification
- Confirm seeded spawn coverage before and after 30 seconds and integer state.
- Run the identity proof with only Colour Clash selected; no browser tests.
- Report the cause and proof result.