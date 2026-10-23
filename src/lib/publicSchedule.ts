/**
 * Public games (Tournaments, beta): the schedule in src/config/publicGames.ts turned into times,
 * the "Next up" state (before the lobby opens: Add to calendar; once it is open: Join now) and the
 * calendar file. Display only: a public game is an ordinary room with a known code.
 */
import { PUBLIC_GAMES, type PublicGameConfig } from "@/config/publicGames";
import { APP_NAME } from "@/lib/brand";

export interface PublicGame extends PublicGameConfig {
  /** The game's start (UTC ms). */
  startsAt: number;
  /** When its lobby opens (UTC ms). */
  lobbyAt: number;
}

const UK = "Europe/London";

/** Europe/London's offset from UTC at an instant, in ms (0 in winter, an hour in summer). */
function londonOffsetMs(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return asUtc - Math.floor(utcMs / 60_000) * 60_000;
}

/** A UK wall-clock date and time ("2026-10-24", "19:00") as UTC ms; NaN if malformed. */
export function ukTimeToUtcMs(date: string, time: string): number {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return Number.NaN;
  const naive = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  // Twice: the offset at the guess settles the clock change's edge.
  const guess = naive - londonOffsetMs(naive);
  return naive - londonOffsetMs(guess);
}

/** The configured games with times, soonest first; malformed entries are left out. */
export function scheduledGames(
  config: readonly PublicGameConfig[] = configuredGames(),
): PublicGame[] {
  return config
    .map((game) => ({
      ...game,
      roomCode: game.roomCode.trim().toUpperCase(),
      startsAt: ukTimeToUtcMs(game.date, game.time),
      lobbyAt: ukTimeToUtcMs(game.date, game.lobbyOpens),
    }))
    .filter((game) => Number.isFinite(game.startsAt) && Number.isFinite(game.lobbyAt))
    .map((game) => (game.lobbyAt > game.startsAt ? { ...game, lobbyAt: game.startsAt } : game))
    .sort((a, b) => a.startsAt - b.startsAt);
}

/**
 * The schedule. A check (app-shell-check) can stand in its own list through
 * window.__DUELZ_PUBLIC_GAMES__; the app never sets it.
 */
export function configuredGames(): readonly PublicGameConfig[] {
  const override =
    typeof window === "undefined"
      ? undefined
      : (window as unknown as { __DUELZ_PUBLIC_GAMES__?: PublicGameConfig[] })
          .__DUELZ_PUBLIC_GAMES__;
  return Array.isArray(override) ? override : PUBLIC_GAMES;
}

/** Games that have not started yet (the one whose lobby is open included), soonest first. */
export function upcomingGames(
  now: number,
  games: readonly PublicGame[] = scheduledGames(),
): PublicGame[] {
  return games.filter((game) => game.startsAt > now);
}

export type NextUpState = "calendar" | "join";

/** Before the lobby opens: "Add to calendar"; from lobby time until the start: "Join now". */
export function nextUpState(game: PublicGame, now: number): NextUpState {
  return now >= game.lobbyAt ? "join" : "calendar";
}

/** Room codes of the public games (for "Your results"). */
export function publicRoomCodes(games: readonly PublicGame[] = scheduledGames()): Set<string> {
  return new Set(games.map((game) => game.roomCode));
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const dateKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: UK,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "7:00 pm" (UK time). */
export function ukTime(ms: number): string {
  return timeFormat
    .format(new Date(ms))
    .replace(/\s?([ap])\.?m\.?/i, " $1m")
    .toLowerCase();
}

const datePartsFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: UK,
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** The UK date's parts for a date tile: { weekday: "Sat", day: "24", month: "Oct" }. */
export function ukDateParts(ms: number): { weekday: string; day: string; month: string } {
  const parts = datePartsFormat.formatToParts(new Date(ms));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: part("weekday"), day: part("day"), month: part("month") };
}

/** "Today", "Tomorrow" or "Sat 24 Oct" (UK dates). */
export function ukDay(ms: number, now: number): string {
  const day = dateKey.format(new Date(ms));
  if (day === dateKey.format(new Date(now))) return "Today";
  if (day === dateKey.format(new Date(now + 86_400_000))) return "Tomorrow";
  return dayFormat.format(new Date(ms)).replace(",", "");
}

const icsStamp = (ms: number) =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const icsText = (text: string) => text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/** The game as a calendar file (an hour from the start, with a reminder at lobby time). */
export function calendarFile(game: PublicGame, origin: string): string {
  const title = game.title ? `${APP_NAME}: ${game.title}` : `${APP_NAME} public game`;
  const link = `${origin}/duel/${game.roomCode}`;
  const reminder = Math.max(0, Math.round((game.startsAt - game.lobbyAt) / 60_000));
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${APP_NAME}//Public games//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${game.roomCode}-${icsStamp(game.startsAt)}@${APP_NAME.toLowerCase()}`,
    `DTSTAMP:${icsStamp(game.startsAt)}`,
    `DTSTART:${icsStamp(game.startsAt)}`,
    `DTEND:${icsStamp(game.startsAt + 60 * 60_000)}`,
    `SUMMARY:${icsText(title)}`,
    `DESCRIPTION:${icsText(`${game.rounds} rounds. The lobby opens at ${ukTime(game.lobbyAt)} (UK time). Room ${game.roomCode}: ${link}`)}`,
    `URL:${link}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(`${title}: the lobby is open`)}`,
    `TRIGGER:-PT${reminder}M`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** Downloads the game's calendar file (a data link, which iOS home-screen apps open too). */
export function downloadCalendar(game: PublicGame): void {
  const link = document.createElement("a");
  link.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(calendarFile(game, window.location.origin))}`;
  link.download = `${APP_NAME.toLowerCase()}-public-game-${game.date}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
