/**
 * The Play tab without jumps (22 Oct 2026, presentation and device storage only). Cards that depend on
 * the server (Daily challenge, Challenge a friend, Rejoin your last room) or on device storage (the
 * share welcome card, the name row) used to appear a moment after the page and push everything below
 * them down. Now:
 *
 *  - Before the first paint, PLAY_CARDS_BOOT (an inline script in the root's <head>, the same as a
 *    theme script) reads device storage and marks <html data-play-cards="…"> with the cards this visit
 *    should reserve and whether a name is stored. The page's markup always carries every slot; CSS
 *    (polish-layout/app-shell.css) hides the ones not marked, so the server-rendered page and the
 *    first client render are identical and the first frame already has the final layout.
 *  - A reserved card draws straight away from its last known status (this file's cache: "Daily
 *    Puzzle 694 4TH", the rejoin room's code and players), then updates in place when the server
 *    answers (same height: every card's lines are single lines).
 *  - If the server says a reserved card shouldn't show (a migration not applied, the room closed),
 *    it collapses smoothly (PlaySlot) and the cache remembers, so the next visit doesn't reserve it.
 *  - A card that wasn't reserved never pops in on this visit; the cache makes the next visit reserve it.
 *
 * scripts/play-tab-shift-check.ts proves the layout holds within 2 px from the first frame at 414x896.
 */
import { PUBLIC_GAMES } from "@/config/publicGames";
import type { DailyStatus } from "@/lib/duel/daily";
import { scheduledGames } from "@/lib/publicSchedule";

export const PLAY_CARDS_KEY = "duelz-play-cards:v1";
/** The keys the boot script reads (kept in step with session.ts, deviceHistory.ts and shareRef.ts by the check). */
export const NAME_KEY = "duelz_display_name";
export const LAST_ROOM_KEY = "duelz-last-room:v1";
export const ARRIVAL_KEY = "duelz-share-arrival:v1";
/** The Add to Home Screen hint's once-per-device flag (lib/beta/homeScreenHint.ts). */
export const HOME_HINT_KEY = "duelz-home-hint:v1";
/**
 * iPhone Safari itself: an iPhone, Safari's "Version/…" token, and none of the other browsers or in-app
 * views that also say Safari (Chrome, Firefox, Edge, Opera, Google, DuckDuckGo, Facebook, Instagram…),
 * which can't add to the home screen the same way. The boot script spells the same two patterns.
 */
export const IPHONE_UA = /iPhone|iPod/;
export const NOT_SAFARI_UA = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|DuckDuckGo|FBAN|FBAV|Instagram|Line\/|Snapchat|YaBrowser|Mercury/;

/**
 * The Next public game card's height on the Play tab (px, 414 wide) for a device with no height of its
 * own cached yet: a titled game's card has one more line. The schedule is static (publicGames.ts), so
 * the server-rendered page can't draw the card (it depends on the phone's clock) but the boot script
 * can reserve it: each configured game's start (UTC ms) and its card's height, soonest first.
 */
export const PUBLIC_CARD_H = { titled: 259, plain: 259 } as const;
export const PUBLIC_CARD_STARTS: [number, number][] = scheduledGames(PUBLIC_GAMES).map((g) => [
  g.startsAt,
  g.title ? PUBLIC_CARD_H.titled : PUBLIC_CARD_H.plain,
]);

export type PlaySlotId = "daily" | "challenge" | "rejoin" | "welcome" | "homescreen";

/** What the boot script reads of the browser for the home-screen hint (window.navigator, matchMedia). */
export interface BootDevice {
  ua: string;
  /** Already a home-screen app (navigator.standalone, or display-mode: standalone). */
  standalone: boolean;
}

/** True on iPhone Safari outside a home-screen app: where the Add to Home Screen hint may show. */
export function iphoneSafari(device: BootDevice | null): boolean {
  return !!device && !device.standalone && IPHONE_UA.test(device.ua) && /Safari\//.test(device.ua) && /Version\//.test(device.ua) && !NOT_SAFARI_UA.test(device.ua);
}

export interface CachedRejoin {
  code: string;
  /** What the card last showed; null: the server said there was nothing to rejoin. */
  open: { code: string; players: number; lobby: boolean } | null;
}

export interface PlayCardsCache {
  daily?: DailyStatus;
  challenges?: boolean;
  rejoin?: CachedRejoin;
  /** The Next public game card's last height, px (0: there was none); the schedule is read on the phone. */
  publicH?: number;
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readPlayCards(): PlayCardsCache {
  try {
    const raw = JSON.parse(storage()?.getItem(PLAY_CARDS_KEY) ?? "null") as PlayCardsCache | null;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function writePlayCards(patch: PlayCardsCache): void {
  try {
    storage()?.setItem(PLAY_CARDS_KEY, JSON.stringify({ ...readPlayCards(), ...patch }));
  } catch {
    /* the next visit just reserves by default */
  }
}

/**
 * The tokens for <html data-play-cards>: which slots to reserve, and "named" when a display name is
 * stored. The inline boot script (PLAY_CARDS_BOOT) is the same logic as a fixed string.
 */
export function playCardTokens(
  store: Pick<Storage, "getItem"> | null,
  search: string,
  device: BootDevice | null = null,
  starts: readonly [number, number][] = PUBLIC_CARD_STARTS,
  now: number = Date.now(),
): string[] {
  const read = (key: string): unknown => {
    try {
      return JSON.parse((store && store.getItem(key)) || "null");
    } catch {
      return null;
    }
  };
  const tokens: string[] = [];
  let name = "";
  try {
    name = ((store && store.getItem("duelz_display_name")) || "").trim();
  } catch {
    name = "";
  }
  if (name) tokens.push("named");
  const cache = (read("duelz-play-cards:v1") || {}) as {
    daily?: { available?: boolean };
    challenges?: boolean;
    rejoin?: { code?: string; open?: unknown };
    publicH?: number;
  };
  if (!cache.daily || cache.daily.available !== false) tokens.push("daily");
  if (cache.challenges !== false) tokens.push("challenge");
  const last = read("duelz-last-room:v1") as { code?: unknown } | null;
  if (last && typeof last.code === "string" && /^[A-Z]{4}$/.test(last.code))
    if (!(cache.rejoin && cache.rejoin.code === last.code && cache.rejoin.open === null)) tokens.push("rejoin");
  if (/[?&]ref=share(&|$)/.test(search) && !read("duelz-share-arrival:v1")) tokens.push("welcome");
  let hinted = true;
  try {
    hinted = !store || store.getItem("duelz-home-hint:v1") !== null;
  } catch {
    hinted = true;
  }
  if (!hinted && iphoneSafari(device)) tokens.push("homescreen");
  // The card's last height; else, while a configured game is still to come, its default height.
  const next = starts.find((g) => g[0] > now);
  if (typeof cache.publicH === "number" && cache.publicH > 0 && cache.publicH < 600) tokens.push("public:" + Math.round(cache.publicH));
  else if (next) tokens.push("public:" + next[1]);
  return tokens;
}

/**
 * The inline script for the root's <head>: marks <html data-play-cards> (and --play-public-h) before the
 * first paint. A fixed string, the same text on the server and in the browser (a function's toString
 * differs between the two builds and broke hydration); play-tab-shift-check proves it gives the same
 * tokens as playCardTokens and applyTokens for every case.
 */
export const PLAY_CARDS_BOOT =
  '(function(){try{var s=window.localStorage,q=location.search;' +
  'var r=function(k){try{return JSON.parse(s.getItem(k)||"null")}catch(e){return null}};' +
  'var t=[];var n="";try{n=(s.getItem("duelz_display_name")||"").trim()}catch(e){}' +
  'if(n)t.push("named");var c=r("duelz-play-cards:v1")||{};' +
  'if(!c.daily||c.daily.available!==false)t.push("daily");' +
  'if(c.challenges!==false)t.push("challenge");' +
  'var l=r("duelz-last-room:v1");' +
  'if(l&&typeof l.code==="string"&&/^[A-Z]{4}$/.test(l.code)&&!(c.rejoin&&c.rejoin.code===l.code&&c.rejoin.open===null))t.push("rejoin");' +
  'if(/[?&]ref=share(&|$)/.test(q)&&!r("duelz-share-arrival:v1"))t.push("welcome");' +
  'var v=window.navigator,u=v&&v.userAgent||"",d=false;try{d=s.getItem("duelz-home-hint:v1")!==null}catch(e){d=true}' +
  'var a=!!v&&(v.standalone===true||!!(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches));' +
  'if(!d&&!a&&/iPhone|iPod/.test(u)&&/Safari\\//.test(u)&&/Version\\//.test(u)&&!/CriOS|FxiOS|EdgiOS|OPiOS|OPT\\/|GSA\\/|DuckDuckGo|FBAN|FBAV|Instagram|Line\\/|Snapchat|YaBrowser|Mercury/.test(u))t.push("homescreen");' +
  'var h=document.documentElement;' +
  "var g=" + JSON.stringify(PUBLIC_CARD_STARTS) + ",x=null,w=Date.now();for(var i=0;i<g.length;i++)if(g[i][0]>w){x=g[i];break}" +
  'if(typeof c.publicH==="number"&&c.publicH>0&&c.publicH<600){t.push("public");h.style.setProperty("--play-public-h",Math.round(c.publicH)+"px")}' +
  'else if(x){t.push("public");h.style.setProperty("--play-public-h",x[1]+"px")}' +
  'h.setAttribute("data-play-cards",t.join(" "))}catch(e){}})();';

/** Writes the tokens: the attribute, and the public card's height as --play-public-h ("public:<px>"). */
export function applyTokens(root: Pick<HTMLElement, "setAttribute"> & { style: Pick<CSSStyleDeclaration, "setProperty"> }, tokens: string[]): void {
  root.setAttribute("data-play-cards", tokens.map((t) => (t.indexOf("public:") === 0 ? "public" : t)).join(" "));
  for (const t of tokens) if (t.indexOf("public:") === 0) root.style.setProperty("--play-public-h", t.slice(7) + "px");
}

/** This browser, as the boot script reads it. */
export function bootDevice(): BootDevice | null {
  try {
    const nav = window.navigator as Navigator & { standalone?: boolean };
    return {
      ua: nav.userAgent || "",
      standalone: nav.standalone === true || !!window.matchMedia?.("(display-mode: standalone)").matches,
    };
  } catch {
    return null;
  }
}

/** Runs the boot where there is no root <head> (the screen harness). */
export function bootPlayCards(): void {
  try {
    applyTokens(document.documentElement, playCardTokens(window.localStorage, location.search, bootDevice()));
  } catch {
    /* nothing reserved */
  }
}

/** Whether this visit reserved a slot (read once the page is up; false before the boot ran). */
export function slotReserved(id: PlaySlotId | "named"): boolean {
  if (typeof document === "undefined") return false;
  return (document.documentElement.getAttribute("data-play-cards") ?? "").split(" ").includes(id);
}
