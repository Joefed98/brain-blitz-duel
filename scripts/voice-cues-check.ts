/**
 * voice-cues-check (18 Nov 2026, Joe's items 22–23): every spoken and crowd-voice slot the Sports games' sound
 * observers play (src/lib/fx/gameSounds.ts) plays on cue. A sibling of sound-retheme-check and sound-nov-2026-check,
 * on the same stubbed Web Audio, here with a clock that runs a source's `ended` at its real length, gains that keep
 * their values and the node graph, so a source's heard gain and an early stop can be read.
 *
 * The slots (docs/sound-cues/home-run-top-bins-elevenlabs.md, sports-elevenlabs.md, batch6-sports-cards.md):
 *  - Home Run (homerunRev 5, dealt): the umpire's `homerun.umpStrike` (strike one or two, swinging or looking),
 *    `homerun.umpBall` (ball one to three), `homerun.umpOut` (a caught ball reaching the glove), `homerun.strikeout`
 *    (strike three), the crowd's `homerun.roar` (a home run), `homerun.groan` (a catch), `homerun.runScores` (a run
 *    in), `homerun.inningsEnd` (the third out or the clock), and the organ's `homerun.walk` (ball four, never "Ball").
 *  - Curl Champ (curlRev 4, dealt): the crowd's `curling.ooh` (a red knocked out of the house), `curling.applause` (a
 *    stone at rest in the 4-foot or after its throw took a red out), `curling.shot` (your stone takes shot) and
 *    `curling.aw` (a stone at rest just short of counting: curlingFx's near-miss verdict).
 *  - Top Bins (freekickRev 6, dealt): `freekick.roar` (a goal), `freekick.groan` (a save, or wide off the woodwork),
 *    `freekick.chant` (the fifth goal in a row).
 *  - Apex (racingRev 4, dealt): `racing.roar` and `racing.chequer` (the finish line).
 *  - The crowd beds `homerun.crowd` and `freekick.crowd` loop exactly while the run is live.
 * Cue Ball and Crazy Golf have no spoken or crowd slot.
 *
 * Every slot is given its recording in public/sounds (the wiring in progress puts each file on its slot; a slot that
 * already has a file keeps it), each on its own URL so its plays are told apart even where slots share a file.
 *
 *  1. On cue: the skill-band bots play each game through its sim with the real sound observer on every tick. Each
 *     event is worked out from the sim's own state change (the innings' count and outcome, the sheet's stones, the
 *     kick's outcome, the finish), never from the observer. Each slot must play on exactly the frames its event happens
 *     on, exactly once each (the same frame: well inside 50 ms; a scheduled one, the umpire's "out" at the glove,
 *     within 3 frames of the art's catch), and never on another event's frame ("Ball" never on a strike).
 *  2. Mute: with the effects muted no voice or crowd slot starts a source.
 *  3. Volume: the effects slider scales every play's heard gain (source gain × channel gain) exactly.
 *  4. Not cut off: no voice or crowd source is stopped before its recording's end (a same-slot replay, a moment hold
 *     or anything else).
 *
 *   bun scripts/voice-cues-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync } from "node:fs";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}
const realNow = Date.now.bind(Date);
const started = realNow();

type Entry = { channel: string; url: string | null; loop?: boolean; ms: number };
const manifest = SOUND_MANIFEST as unknown as Record<string, Entry>;

/** The slots this check proves (one-shots) and the crowd beds (loops). */
const VOICE_SLOTS = [
  "homerun.umpStrike",
  "homerun.umpBall",
  "homerun.umpOut",
  "homerun.strikeout",
  "homerun.walk",
  "homerun.roar",
  "homerun.groan",
  "homerun.runScores",
  "homerun.inningsEnd",
  "curling.ooh",
  "curling.aw",
  "curling.applause",
  "curling.shot",
  "freekick.roar",
  "freekick.groan",
  "freekick.chant",
  "racing.roar",
  "racing.chequer",
] as const;
const CROWD_BEDS = ["homerun.crowd", "freekick.crowd"] as const;

/* ------------------------------------------------------------- the recordings */

/** An MP3's length (ms) from its frames, less the LAME tag's delay and padding. */
function mp3Ms(bytes: Uint8Array): number {
  const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const RATES = [44100, 48000, 32000];
  let at = 0;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) at = 10 + ((bytes[6]! << 21) | (bytes[7]! << 14) | (bytes[8]! << 7) | bytes[9]!);
  let frames = 0;
  let rate = 44100;
  let delay = 0;
  let padding = 0;
  let first = true;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff || (bytes[at + 1]! & 0xe0) !== 0xe0) break;
    const bitrate = BITRATES[bytes[at + 2]! >> 4] ?? 0;
    const r = RATES[(bytes[at + 2]! >> 2) & 3] ?? 0;
    if (!bitrate || !r) break;
    const pad = (bytes[at + 2]! >> 1) & 1;
    const side = bytes[at + 3]! >> 6 === 3 ? 17 : 32;
    const tag = String.fromCharCode(...bytes.slice(at + 4 + side, at + 8 + side));
    if (first && (tag === "Xing" || tag === "Info")) {
      const d = at + 4 + side + 120 + 21;
      delay = (bytes[d]! << 4) | (bytes[d + 1]! >> 4);
      padding = ((bytes[d + 1]! & 0x0f) << 8) | bytes[d + 2]!;
    } else {
      frames++;
      rate = r;
    }
    first = false;
    at += Math.floor((144000 * bitrate) / r) + pad;
  }
  return (Math.max(0, frames * 1152 - delay - padding) * 1000) / rate;
}

/** Each slot's own URL in this check (`?slot=`), and its recording's length. */
const slotMs = new Map<string, number>();
for (const slot of [...VOICE_SLOTS, ...CROWD_BEDS]) {
  const entry = manifest[slot];
  check(!!entry, `${slot}: no manifest entry`);
  if (!entry) continue;
  check(entry.channel === "effects", `${slot}: on the ${entry.channel} channel (the game's sounds are effects)`);
  const own = `/sounds/${slot}.mp3`;
  const url = entry.url ?? (existsSync(`public${own}`) ? own : null);
  check(!!url && existsSync(`public${url!.split("?")[0]}`), `${slot}: no recording in public/sounds (${url ?? "none"})`);
  if (!url || !existsSync(`public${url.split("?")[0]}`)) continue;
  slotMs.set(slot, mp3Ms(new Uint8Array(readFileSync(`public${url.split("?")[0]}`))));
  entry.url = `${url.split("?")[0]}?slot=${slot}`;
}
const slotOfUrl = (url: string) => /[?&]slot=([^&]+)/.exec(url)?.[1] ?? null;

/* ------------------------------------------------------------- stubbed audio */

let now = 0;
let timerId = 0;
const timers = new Map<number, { at: number; fn: () => void }>();
const realSetTimeout = globalThis.setTimeout;
Object.assign(globalThis, {
  setTimeout: (fn: () => void, ms = 0) => {
    timers.set(++timerId, { at: now + Math.max(0, ms), fn });
    return timerId;
  },
  clearTimeout: (id: number) => void timers.delete(id),
});
Object.defineProperty(globalThis, "performance", { value: { now: () => now }, configurable: true, writable: true });
const flush = () => new Promise<void>((resolve) => realSetTimeout(resolve, 0));
/** Moves the clock on, running every timer due on the way, in order (synchronously). */
function tickClock(ms: number): void {
  const end = now + ms;
  for (;;) {
    let due: [number, { at: number; fn: () => void }] | null = null;
    for (const t of timers) if (t[1].at <= end && (!due || t[1].at < due[1].at)) due = t;
    if (!due) break;
    timers.delete(due[0]);
    now = Math.max(now, due[1].at);
    due[1].fn();
  }
  now = end;
}

interface Param {
  value: number;
  setValueAtTime: (v: number) => void;
  linearRampToValueAtTime: (v: number) => void;
  exponentialRampToValueAtTime: (v: number) => void;
  cancelScheduledValues: () => void;
  setTargetAtTime: (v: number) => void;
}
const param = (): Param => {
  const p: Param = {
    value: 1,
    setValueAtTime: (v) => void (p.value = v),
    linearRampToValueAtTime: (v) => void (p.value = v),
    exponentialRampToValueAtTime: (v) => void (p.value = v),
    cancelScheduledValues: () => {},
    setTargetAtTime: (v) => void (p.value = v),
  };
  return p;
};
interface FakeNode {
  out: FakeNode | null;
  gain?: Param;
  connect: (next: any) => any;
  disconnect: () => void;
}
const node = (): FakeNode => {
  const n: FakeNode = {
    out: null,
    connect: (next: any) => {
      n.out = next ?? null;
      return next ?? node();
    },
    disconnect() {},
  };
  return n;
};
/** The gain a source is heard at: every gain node from it to the destination, multiplied. */
function heardGain(n: FakeNode | null): number {
  let g = 1;
  for (let at = n; at; at = at.out) if (at.gain) g *= at.gain.value;
  return g;
}

interface Played {
  slot: string;
  url: string;
  tick: number;
  at: number;
  ms: number;
  loop: boolean;
  gain: number;
  stoppedAt: number | null;
}
const plays: Played[] = [];
let currentTick = -1;
class FakeAudioContext {
  state = "running";
  get currentTime() {
    return now / 1000;
  }
  sampleRate = 44100;
  destination = node();
  createGain() {
    const n = node();
    n.gain = param();
    return n;
  }
  createBiquadFilter() {
    return { ...node(), frequency: param(), type: "" };
  }
  createOscillator() {
    return { ...node(), frequency: param(), type: "", start() {}, stop() {}, addEventListener() {} };
  }
  createBuffer(_c: number, length: number, sampleRate: number) {
    return { duration: length / sampleRate, length, numberOfChannels: 1, sampleRate, getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    const ended: (() => void)[] = [];
    const base = node();
    let record: Played | null = null;
    let endTimer = 0;
    const fireEnded = () => {
      const fn = (source as any).onended;
      if (typeof fn === "function") fn();
      ended.forEach((f) => f());
    };
    const source = Object.assign(base, {
      buffer: null as { url: string; duration: number } | null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: param(),
      onended: null as null | (() => void),
      addEventListener: (type: string, fn: () => void) => void (type === "ended" && ended.push(fn)),
      start() {
        const url = source.buffer?.url ?? "";
        const rate = source.playbackRate.value || 1;
        const ms = ((source.buffer?.duration ?? 0) * 1000) / rate;
        record = { slot: slotOfUrl(url) ?? "", url, tick: currentTick, at: now, ms, loop: source.loop, gain: heardGain(base.out), stoppedAt: null };
        plays.push(record);
        if (!source.loop) endTimer = (globalThis.setTimeout as any)(fireEnded, ms);
      },
      stop(when?: number) {
        if (!record || record.stoppedAt !== null) return;
        record.stoppedAt = when !== undefined && when * 1000 > now ? when * 1000 : now;
        (globalThis.clearTimeout as any)(endTimer);
        (globalThis.setTimeout as any)(fireEnded, Math.max(0, record.stoppedAt - now));
      },
    });
    return source;
  }
  decodeAudioData(bytes: ArrayBuffer) {
    const url = new TextDecoder().decode(bytes);
    const slot = slotOfUrl(url);
    const ms = slot ? slotMs.get(slot) ?? 1000 : 300;
    const length = Math.max(1, Math.round((44100 * ms) / 1000));
    const data = new Float32Array(length).fill(0.5);
    return Promise.resolve({ duration: length / 44100, length, numberOfChannels: 1, sampleRate: 44100, url, getChannelData: () => data });
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  addEventListener() {}
}
const fakeDoc = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const store = new Map<string, string>();
const fakeWin = Object.assign(new EventTarget(), {
  AudioContext: FakeAudioContext,
  location: { search: "" },
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
  setTimeout: (fn: () => void, ms?: number) => (globalThis.setTimeout as (f: () => void, m?: number) => number)(fn, ms),
  clearTimeout: (id: number) => globalThis.clearTimeout(id),
  devicePixelRatio: 2,
});
Object.assign(globalThis, {
  window: fakeWin,
  document: fakeDoc,
  fetch: async (url: string) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer }),
});
const EPOCH = Date.now();
Date.now = () => EPOCH + now;
const sound = await import("../src/lib/sound");
sound.unlockAudio();
sound.loadAllSounds();
sound.installSoundCueBridge();
const want = [...VOICE_SLOTS, ...CROWD_BEDS].filter((s) => slotMs.has(s));
for (let i = 0; i < 400 && !want.every((id) => sound.soundDiagnostics().loaded.includes(id as never)); i++) await flush();
const notLoaded = want.filter((id) => !sound.soundDiagnostics().loaded.includes(id as never));
check(notLoaded.length === 0, `every voice and crowd slot decodes (${notLoaded.join(", ")})`);

/* ------------------------------------------------------------- the games */

const { GAME_BY_TYPE } = await import("./arcade-skill-bands/games");
const { Human } = await import("./arcade-skill-bands/human");
const gs = await import("../src/lib/fx/gameSounds");
const HR = await import("../src/lib/arcade/homerunInnings");
const CU = await import("../src/lib/arcade/curling");
const { CurlFxTracker } = await import("../src/lib/arcade/curlingFx");
const FK = await import("../src/lib/arcade/freekick");
const { HOMERUN_REV_DEALT } = await import("../src/lib/arcade/homerun");
const { RACING_REV_DEALT } = await import("../src/lib/arcade/racing");

/** One frame's events (labels for messages) and, for each slot, how many times it must play this frame. */
interface Frame {
  events: string[];
  want: Map<string, number>;
  /** Plays due a few frames from now (the art's timing): the tick each lands on. */
  later: { slot: string; tick: number; event: string }[];
}
interface Watcher {
  /** Called on every tick with the state before and after it. */
  frame: (p: any, s: any) => Frame;
}
const ALL = ["weak", "average", "good", "great", "elite", "perfect"] as const;
interface GameRun {
  type: string;
  rev: number;
  levels: readonly string[];
  seeds: number;
  observer: () => { frame: (s: any, running: boolean) => void; stop: () => void };
  watcher: () => Watcher;
  slots: readonly string[];
  beds: readonly string[];
}
const frameOf = (): Frame => ({ events: [], want: new Map(), later: [] });
const add = (f: Frame, event: string, ...slots: string[]) => {
  f.events.push(event);
  for (const s of slots) f.want.set(s, (f.want.get(s) ?? 0) + 1);
};

/** Home Run's innings: each pitch's outcome from the innings' count, the catch at the glove on the art's flight. */
function homerunWatcher(): Watcher {
  return {
    frame(p, s) {
      const f = frameOf();
      const was = p.inn;
      const inn = s.inn;
      if (!was || !inn) return f;
      if (inn.hits.length > was.hits.length) {
        const hit = inn.hits[inn.hits.length - 1];
        const strikeKind = hit.out === HR.HR5_WHIFF || hit.out === HR.HR5_STRIKE_CALLED;
        if (strikeKind && inn.outs > was.outs) add(f, "strike three", "homerun.strikeout");
        else if (strikeKind && inn.strikes > was.strikes) add(f, `strike ${inn.strikes}`, "homerun.umpStrike");
        else if (strikeKind) add(f, "a strike that changed no count (sim?)");
        if (hit.out === HR.HR5_FOUL) add(f, "foul");
        if (hit.out === HR.HR5_BALL && inn.balls > was.balls) add(f, `ball ${inn.balls}`, "homerun.umpBall");
        else if (hit.out === HR.HR5_BALL && was.balls === 3 && inn.balls === 0) add(f, "ball four (walk)", "homerun.walk");
        if (hit.out === HR.HR5_HOMER) add(f, "home run", "homerun.roar");
        if (hit.out === HR.HR5_OUT_CAUGHT) {
          f.events.push("fly ball (caught later)");
          // The art's flight (homerun.renderer.ts v5Flight / the catcher's run): the ball reaches the glove here.
          const glove = hit.at + 40 + Math.round(hit.feet / 9);
          f.later.push({ slot: "homerun.umpOut", tick: glove, event: "the catch" }, { slot: "homerun.groan", tick: glove, event: "the catch" });
        }
        if (hit.out >= HR.HR5_SINGLE && hit.out <= HR.HR5_CHOICE && hit.out !== HR.HR5_HOMER) f.events.push(HR.HR5_OUTCOME_NAMES[hit.out] ?? "hit");
      }
      if (inn.runs > was.runs) add(f, "run scores", "homerun.runScores");
      if (inn.endAt > 0 && was.endAt === 0) add(f, "innings over", "homerun.inningsEnd");
      return f;
    },
  };
}

/** Curl Champ: each red leaving the house, and each thrown stone's verdict at rest (curlingFx's own tracker). */
function curlingWatcher(): Watcher {
  const fx = new CurlFxTracker();
  let atRelease = { takeouts: 0, shot: -1 };
  return {
    frame(p, s) {
      const f = frameOf();
      fx.observe(s, now);
      if (s.thrown > p.thrown) atRelease = { takeouts: CU.curlTakeouts(p), shot: CU.curlShotTeam(p) };
      let knocked = 0;
      for (let i = 0; i < s.theirs; i++) {
        const wasIn = p.live[i] && CU.curlInHouse(p.x[i], p.y[i]);
        const isIn = s.live[i] && CU.curlInHouse(s.x[i], s.y[i]);
        if (wasIn && !isIn) knocked++;
      }
      if (knocked > 0) add(f, "a red knocked out of the house", "curling.ooh");
      if (s.pts.length > p.pts.length) {
        const shot = CU.curlShotTeam(s) === CU.TEAM_MINE && atRelease.shot !== CU.TEAM_MINE;
        const four = s.four[s.four.length - 1] === 1;
        const tookOut = CU.curlTakeouts(s) > atRelease.takeouts;
        const near = fx.verdicts.some((v: any) => v.tick === s.tick && v.kind === "near");
        if (shot) add(f, "your stone at rest takes shot", "curling.shot");
        else if (four || tookOut) add(f, four ? "a stone in the 4-foot" : "a stone at rest after a takeout", "curling.applause");
        else if (near) add(f, "a near miss at rest", "curling.aw");
        else f.events.push("a stone at rest");
      }
      return f;
    },
  };
}

/** Top Bins: each kick's outcome as the sim resolves it (its outs and goals), the streak reaching five. */
function freekickWatcher(): Watcher {
  return {
    frame(p, s) {
      const f = frameOf();
      if (s.goals > p.goals) add(f, "goal", "freekick.roar");
      const fl = s.fl;
      const was = p.fl;
      if (fl && was && s.kickTick === p.kickTick && fl.out !== was.out) {
        if (fl.out === FK.FK_OUT_SAVED) add(f, "a save", "freekick.groan");
        else if (fl.out === FK.FK_OUT_WIDE && (fl.post || fl.bar)) add(f, "wide off the woodwork", "freekick.groan");
        else if (fl.out === FK.FK_OUT_WIDE) f.events.push("wide");
        else if (fl.out === FK.FK_OUT_WALL) f.events.push("into the wall");
      }
      if (s.best >= 5 && p.best < 5) add(f, "five in a row", "freekick.chant");
      return f;
    },
  };
}

function racingWatcher(): Watcher {
  return {
    frame(p, s) {
      const f = frameOf();
      if (s.finishTick > 0 && p.finishTick === 0) add(f, "the finish line", "racing.roar", "racing.chequer");
      return f;
    },
  };
}

const HOMERUN_SLOTS = VOICE_SLOTS.filter((s) => s.startsWith("homerun."));
const GAME_RUNS: GameRun[] = [
  { type: "homerun", rev: HOMERUN_REV_DEALT, levels: [...ALL, "idle"], seeds: 4, observer: gs.homerunSounds, watcher: homerunWatcher, slots: HOMERUN_SLOTS, beds: ["homerun.crowd"] },
  { type: "curling", rev: CU.CURLING_REV, levels: ALL, seeds: 2, observer: gs.curlingSounds, watcher: curlingWatcher, slots: VOICE_SLOTS.filter((s) => s.startsWith("curling.")), beds: [] },
  { type: "freekick", rev: FK.FREEKICK_REV_DEALT, levels: ALL, seeds: 4, observer: gs.freekickSounds, watcher: freekickWatcher, slots: VOICE_SLOTS.filter((s) => s.startsWith("freekick.")), beds: ["freekick.crowd"] },
  { type: "racing", rev: RACING_REV_DEALT, levels: ["average", "elite"], seeds: 2, observer: gs.racingSounds, watcher: racingWatcher, slots: ["racing.roar", "racing.chequer"], beds: [] },
];

const TICK_MS = 1000 / 60;
/** A scheduled play may land this many frames from its event (50 ms). */
const SCHEDULED_FRAMES = 3;
const VOICE = new Set<string>(VOICE_SLOTS);

interface RunResult {
  /** Each voice play, in order: slot, tick, heard gain. */
  plays: Played[];
  events: Record<string, number>;
}
const totals: Record<string, { plays: number; events: number }> = {};

/** Plays one bot run with the observer, checking each frame; returns its voice plays. */
async function playRun(run: GameRun, n: number, level: string, judge: boolean): Promise<RunResult> {
  const spec = GAME_BY_TYPE.get(run.type as never)! as any;
  const { bot } = (await import(`./arcade-skill-bands/bots/${run.type}.ts`)) as { bot: (ctx: any) => { events?: any[] } };
  const seed = spec.seedForRev?.(n, run.rev) ?? spec.seedFor(n);
  const game = spec.gameFor(run.rev, seed);
  // "idle": no input at all (every pitch taken: the only way the bots' runs reach ball four).
  const events = level === "idle" ? [] : bot({ game, seed, rev: run.rev, human: new Human(run.type as never, seed, level as never) }).events ?? [];
  const byTick = new Map(events.map((e: any) => [e.t, e]));
  const obs = run.observer();
  const watch = run.watcher();
  const label = `${run.type} seed ${seed} ${level}`;
  const from = plays.length;
  const counted: Record<string, number> = {};
  const due: { slot: string; tick: number; event: string; met: boolean }[] = [];
  const eventsAt = new Map<number, string[]>();
  const wrong: string[] = [];
  let s = game.init(seed);
  currentTick = s.tick;
  obs.frame(s, true);
  const bedsOff: string[] = [];
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const p = s;
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    tickClock(TICK_MS);
    currentTick = s.tick;
    const fr = watch.frame(p, s);
    eventsAt.set(s.tick, fr.events);
    for (const l of fr.later) due.push({ ...l, met: false });
    const before = plays.length;
    obs.frame(s, true);
    if (!judge) continue;
    const here = new Map<string, number>();
    for (let i = before; i < plays.length; i++) if (VOICE.has(plays[i]!.slot)) here.set(plays[i]!.slot, (here.get(plays[i]!.slot) ?? 0) + 1);
    for (const slot of run.slots) {
      const wantN = fr.want.get(slot) ?? 0;
      counted[slot] = (counted[slot] ?? 0) + wantN;
      let got = here.get(slot) ?? 0;
      // A scheduled play: matched to its due event within SCHEDULED_FRAMES.
      for (let k = 0; k < got; k++) {
        const d = due.find((x) => x.slot === slot && !x.met && Math.abs(x.tick - s.tick) <= SCHEDULED_FRAMES);
        if (!d) break;
        d.met = true;
        got--;
        counted[slot] = (counted[slot] ?? 0) + 1;
      }
      if (got !== wantN) {
        const what = fr.events.length ? fr.events.join(", ") : "no event";
        wrong.push(`${slot} played ${got}× at tick ${s.tick} for ${wantN} event${wantN === 1 ? "" : "s"} (frame: ${what})`);
      }
    }
    for (const d of due) if (!d.met && s.tick > d.tick + SCHEDULED_FRAMES && !(d as any).reported) {
      (d as any).reported = true;
      wrong.push(`${d.slot} missing for ${d.event} due at tick ${d.tick}`);
    }
    if (s.tick % 30 === 0 && !game.isOver(s)) {
      for (const bed of run.beds) {
        const live = plays.some((x) => x.slot === bed && x.loop && x.stoppedAt === null);
        if (!live) bedsOff.push(`${bed} not looping at tick ${s.tick}`);
      }
    }
  }
  obs.frame(s, false);
  obs.stop();
  tickClock(1000);
  if (judge) {
    for (const d of due) if (!d.met && !(d as any).reported && d.tick <= s.tick) wrong.push(`${d.slot} missing for ${d.event} due at tick ${d.tick}`);
    check(wrong.length === 0, `${label}: ${wrong.length} wrong frame(s): ${wrong.slice(0, 4).join("; ")}`);
    check(bedsOff.length === 0, `${label}: ${bedsOff.slice(0, 2).join("; ")}`);
    for (const bed of run.beds) check(!plays.some((x) => x.slot === bed && x.loop && x.stoppedAt === null), `${label}: ${bed} still looping after the run`);
  }
  const mine = plays.slice(from).filter((x) => VOICE.has(x.slot));
  if (judge) for (const [slot, k] of Object.entries(counted)) {
    const t = (totals[`${run.type}|${slot}`] ??= { plays: 0, events: 0 });
    t.events += k;
    t.plays += mine.filter((x) => x.slot === slot).length;
  }
  void eventsAt;
  if (process.env.VOICE_CUES_VERBOSE) console.error(`${label} ${judge ? "judged" : "plain"}: ${s.tick} ticks, ${((realNow() - started) / 1000).toFixed(1)} s, timers ${timers.size}`);
  return { plays: mine, events: counted };
}

/* 1. On cue, every slot, every level. */
for (const run of GAME_RUNS) {
  for (let n = 0; n < run.seeds; n++) for (const level of run.levels) await playRun(run, n, level, true);
  for (const slot of run.slots) {
    const t = totals[`${run.type}|${slot}`] ?? { plays: 0, events: 0 };
    check(t.events > 0, `${run.type}: no ${slot} event in ${run.seeds * run.levels.length} bot runs (the check needs one)`);
  }
}

/* 2–3. Mute and volume: the same runs muted, at full volume and at 0.4. */
const VOL = 0.4;
for (const run of GAME_RUNS) {
  const level = run.type === "racing" ? "elite" : "great";
  for (let n = 0; n < 2; n++) {
    sound.setMuted(false);
    sound.setEffectsVolume(1);
    sound.resetPlayCaps();
    const full = await playRun(run, n, level, false);
    sound.setEffectsVolume(VOL);
    sound.resetPlayCaps();
    const low = await playRun(run, n, level, false);
    sound.setEffectsVolume(1);
    sound.setMuted(true);
    sound.resetPlayCaps();
    const muted = await playRun(run, n, level, false);
    sound.setMuted(false);
    const tag = `${run.type} run ${n} ${level}`;
    check(full.plays.length > 0, `${tag}: no voice play to compare`);
    check(muted.plays.length === 0, `${tag}: ${muted.plays.length} voice plays with the effects muted (${muted.plays.slice(0, 3).map((x) => x.slot).join(", ")})`);
    const same = full.plays.length === low.plays.length && full.plays.every((x, i) => x.slot === low.plays[i]!.slot && x.tick === low.plays[i]!.tick);
    check(same, `${tag}: the plays at volume ${VOL} differ from full volume (${full.plays.length} vs ${low.plays.length})`);
    if (same) {
      const off = full.plays.filter((x, i) => x.gain <= 0 || Math.abs(low.plays[i]!.gain - x.gain * VOL) > 1e-9);
      check(off.length === 0, `${tag}: ${off.length} plays not scaled by the slider (${off.slice(0, 2).map((x) => `${x.slot} ${x.gain}`).join(", ")})`);
    }
  }
}

/* 4. Not cut off: every voice or crowd one-shot played to its end. */
const cut = plays.filter((x) => VOICE.has(x.slot) && !x.loop && x.stoppedAt !== null && x.stoppedAt < x.at + x.ms - 1);
check(cut.length === 0, `${cut.length} voice plays cut off early: ${cut.slice(0, 4).map((x) => `${x.slot} at tick ${x.tick} after ${Math.round(x.stoppedAt! - x.at)} of ${Math.round(x.ms)} ms`).join("; ")}`);
const lengths = [...VOICE_SLOTS].filter((s) => !plays.some((x) => x.slot === s && Math.abs(x.ms - (slotMs.get(s) ?? 0)) < 2));
check(lengths.length === 0, `played at their recording's length: ${lengths.join(", ")}`);

/* ------------------------------------------------------------- report */

console.log("voice-cues-check: slot, events in the bot runs, plays");
for (const [key, t] of Object.entries(totals)) console.log(`  ${key.split("|")[1]!.padEnd(22)} ${String(t.events).padStart(5)} events ${String(t.plays).padStart(5)} plays`);
console.log(`${passes} passed, ${failures.length} failed (${((realNow() - started) / 1000).toFixed(1)} s)`);
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  process.exit(1);
}
console.log("PASS voice-cues-check");
process.exit(0);
