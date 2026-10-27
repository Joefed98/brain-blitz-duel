/**
 * A fixed clock for the browser checks that draw the Play tab and other dated screens (27 Oct 2026):
 * celebrations-check's switch-off markup was recorded on Mon 26 Oct and its harness schedules public
 * games days after "now", so on a public-game day the Play tab's date tile read THU where the recording
 * read WED and the check failed on main with no change. The checks that draw those screens now start
 * the clock at one fixed instant (FIXED_NOW, the recording's day) in the check's own process and in every
 * page, so the screens read the same on any day.
 *
 * The clock is shifted, not frozen: Date.now() and `new Date()` read FIXED_NOW at the moment fixClock()
 * runs and then advance in real time, the same in Node (room fixtures stamp their times there) and in the
 * page (one shared offset), so timers, animations, countdowns and the server's phase clock behave exactly
 * as before. performance.now() and requestAnimationFrame are untouched.
 *
 *   const pageClock = fixClock();             // Node's Date from here on
 *   await context.addInitScript(pageClock.script, pageClock.arg);   // each browser context
 */

/** Mon 26 Oct 2026, 15:00 UK (GMT, so 15:00 UTC): the day celebrations-off.json was recorded. */
export const FIXED_NOW = Date.UTC(2026, 9, 26, 15, 0, 0);

/** Date reads real time plus `offset` (in the page, before its own scripts; and in Node). */
function shiftPageDate(offset: number): void {
  const Real = Date;
  const realNow = Real.now.bind(Real);
  class Shifted extends Real {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(realNow() + offset);
      else super(...(args as [number]));
    }
    static now(): number {
      return realNow() + offset;
    }
  }
  (globalThis as unknown as { Date: DateConstructor }).Date = Shifted as unknown as DateConstructor;
}

let installed: { offset: number } | null = null;

/**
 * Shifts this process's Date to read `at` now (once per process; later calls reuse the same offset)
 * and returns the init script that shifts each page's Date by the same amount.
 */
export function fixClock(at: number = FIXED_NOW): { script: (offset: number) => void; arg: number } {
  if (!installed) {
    const offset = at - Date.now();
    installed = { offset };
    shiftPageDate(offset);
  }
  return { script: shiftPageDate, arg: installed.offset };
}

/**
 * A fixed public-games schedule for checks that draw the Play tab or Tournaments without one of their own
 * (through window.__DUELZ_PUBLIC_GAMES__): the shape of the beta's first schedule, two and four days after
 * FIXED_NOW, so the Next public game card is drawn whatever src/config/publicGames.ts holds.
 */
export const FIXED_SCHEDULE = [
  { date: "2026-10-28", time: "20:00", lobbyOpens: "19:45", rounds: 6, roomCode: "JULZ", title: "Launch night" },
  { date: "2026-10-30", time: "20:00", lobbyOpens: "19:45", rounds: 6, roomCode: "JULZ", title: "Friday night game" },
];
