/**
 * Presentation palette only; values and scoring remain in bullseye.ts.
 * Phone-test notes (27 Oct 2026): the 9 and 8 are lighter golds stepping out from the 10, the 2 and 1 lighter pinks
 * stepping out from the 3 (they were dark red, blue, near-black and white), so the board reads as two warm families
 * and a black dart shows on every ring. The dark ring edges keep neighbouring rings apart wherever a shuffle puts them.
 */
export const FLIGHTPATH_COLOURS = ["#F5B82E", "#F8CD66", "#FBE2A4", "#E8A7DC", "#F1C6EA", "#F9E3F5"] as const;
export const FLIGHTPATH_INKS = ["#0B0B0F", "#0B0B0F", "#0B0B0F", "#0B0B0F", "#0B0B0F", "#0B0B0F"] as const;
const VALUES = [10, 9, 8, 3, 2, 1];
export function flightpathColour(value: number): string { return FLIGHTPATH_COLOURS[VALUES.indexOf(value)] ?? FLIGHTPATH_COLOURS[0]; }
export function flightpathInk(value: number): string { return FLIGHTPATH_INKS[VALUES.indexOf(value)] ?? FLIGHTPATH_INKS[0]; }
