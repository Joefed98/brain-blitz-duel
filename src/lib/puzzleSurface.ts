/** Presentation roles only. No game state, answers, hit testing or input routing. */
export const PUZZLE_PATH_FRACTION = 0.16;
export const PUZZLE_TOUCH_MIN = 44;
export const PUZZLE_ACTIONS = /^(undo|reset|restart|clear|fire|defuse|submit|enter|check|done|lock in|shuffle|erase|pencil)$/i;
export const PUZZLE_PRIMARY_ACTIONS = /^(fire|defuse|submit|enter|check|done|lock in)$/i;
export const MEANINGFUL_SURFACE_GAMES = new Set([
  "flow", "flood", "lightsout", "tents", "shikaku", "lightup", "pairmatch", "spotdiff", "symscan",
  "pipes", "iceslide", "push", "gravity", "unblock", "blockparty", "rings", "tubes", "balance", "tower",
]);
export function surfaceState(classes: string, given = false): string {
  if (/(?:border|bg|text)-(?:destructive|warn)(?:\b|\/)/.test(classes)) return "error";
  if (given) return "given";
  if (/(?:ring-[234]|outline-2).*?(?:primary|me)|border-primary.*shadow/.test(classes)) return "selected";
  if (/bg-(?:primary|me|opponent)(?:\b|\/)|border-primary/.test(classes)) return "active";
  return "idle";
}
export function pathWidth(cell: number): number {
  return cell * PUZZLE_PATH_FRACTION;
}