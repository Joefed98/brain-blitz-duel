/** Presentation palette only; values and scoring remain in bullseye.ts. */
export const FLIGHTPATH_COLOURS = ["#F5B82E", "#9B2335", "#2471B5", "#E8A7DC", "#30343B", "#F7F7F8"] as const;
export const FLIGHTPATH_INKS = ["#0B0B0F", "#FFFFFF", "#FFFFFF", "#0B0B0F", "#FFFFFF", "#0B0B0F"] as const;
const VALUES = [10, 9, 8, 3, 2, 1];
export function flightpathColour(value: number): string { return FLIGHTPATH_COLOURS[VALUES.indexOf(value)] ?? FLIGHTPATH_COLOURS[0]; }
export function flightpathInk(value: number): string { return FLIGHTPATH_INKS[VALUES.indexOf(value)] ?? FLIGHTPATH_INKS[0]; }