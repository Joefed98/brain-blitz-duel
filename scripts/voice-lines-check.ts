/**
 * voice-lines-check (18 Nov 2026, Joe's sound wiring): the announcer (src/lib/fx/announcer.ts), with the real sound
 * layer (src/lib/sound.ts) on a stub AudioContext.
 *
 *  1. Tiers: every boundary (174, 175, 184, 185, 194, 195, 199, 200) picks from the right tier; below 175 no line;
 *     each tier's three lines are manifest voice slots with a file.
 *  2. Exactly one line per round result, at the reveal's sting + 150 ms; never twice for the same round (the same key
 *     again, a re-render, a reload in the same tab); none for a reveal reopened later (firstShowing false); a reveal that
 *     closes before the line is due plays none.
 *  3. Never the same line twice in a row on a device (2,000 rounds per tier, random and adversarial pickers), and
 *     every line of a tier is heard.
 *  4. The switch and sound: Settings → Sound → Announcer voice off silences it, sound effects off silences it (and
 *     reads as off), the setting is stored with the sound settings and survives a reload; the voice bus follows the
 *     sound-effects volume.
 *  5. Where it plays (source): only AnswerReveal calls it, with this device's own stored score and AnswerReveal's
 *     `heroRun` (false on AsyncResults' reopened reveals), from the reveal's score cue time; the room passes its own
 *     result row's score; replays (ReplayPanels) and live rounds never call it; Practice, rooms (rated and tournament
 *     rooms are rooms), the Daily, challenges and Score Attack all reveal through AnswerReveal; the perfect burst's
 *     "Perfect" plays only under 175, so a 200 hears one line.
 *
 *   bun scripts/voice-lines-check.ts
 */
import { readFileSync } from "node:fs";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

/* ------------------------------------------------------------ a stub audio layer that records what starts */

type Started = { url: string; at: number };
const started: Started[] = [];
function param() {
  return {
    value: 1,
    setValueAtTime(v: number) {
      this.value = v;
    },
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues() {},
  };
}
function node() {
  return { connect: (n: unknown) => n, disconnect() {}, gain: param() };
}
class FakeContext {
  state = "running";
  currentTime = 0;
  destination = node();
  sampleRate = 48000;
  gains: ReturnType<typeof node>[] = [];
  createGain() {
    const g = node();
    this.gains.push(g);
    return g;
  }
  createDynamicsCompressor() {
    return { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() };
  }
  createBiquadFilter() {
    return { ...node(), frequency: param(), Q: param(), type: "lowpass" };
  }
  createOscillator() {
    return { ...node(), frequency: param(), type: "sine", start() {}, stop() {} };
  }
  createBuffer(_c: number, length: number, sampleRate: number) {
    return { duration: length / sampleRate, length, numberOfChannels: 1, sampleRate, url: "", getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    const source = {
      ...node(),
      buffer: null as { url: string } | null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: param(),
      onended: null,
      start() {
        if (source.buffer?.url) started.push({ url: source.buffer.url, at: Date.now() });
      },
      stop() {},
    };
    return source;
  }
  decodeAudioData(bytes: ArrayBuffer) {
    const url = new TextDecoder().decode(bytes);
    const data = new Float32Array(4800).fill(0.5);
    return Promise.resolve({ duration: 0.1, length: 4800, numberOfChannels: 1, sampleRate: 48000, url, getChannelData: () => data });
  }
  resume() {
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
  addEventListener() {}
}
const target = new EventTarget();
const local = new Map<string, string>();
const session = new Map<string, string>();
const store = (m: Map<string, string>) => ({
  getItem: (k: string) => m.get(k) ?? null,
  setItem: (k: string, v: string) => void m.set(k, v),
  removeItem: (k: string) => void m.delete(k),
});
Object.assign(globalThis, {
  window: Object.assign(target, {
    AudioContext: FakeContext,
    location: { search: "" },
    localStorage: store(local),
    sessionStorage: store(session),
    setTimeout,
    clearTimeout,
  }),
  document: { visibilityState: "visible", addEventListener() {}, removeEventListener() {}, querySelector: () => null },
  fetch: async (url: string) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer }),
});
console.warn = () => {};

const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
const sound = await import("../src/lib/sound");
const A = await import("../src/lib/fx/announcer");
const manifest = SOUND_MANIFEST as unknown as Record<string, { url: string | null; channel: string }>;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
sound.unlockAudio();
sound.loadAllSounds();
for (let i = 0; i < 400; i++) {
  const d = sound.soundDiagnostics();
  if (A.ANNOUNCER_LINES.every((id) => d.loaded.includes(id) || d.failed.includes(id))) break;
  await sleep(10);
}
const urlOf = (id: string) => manifest[id]!.url;
const lineOf = (url: string) => A.ANNOUNCER_LINES.find((id) => urlOf(id) === url) ?? null;
const take = () => started.splice(0, started.length);
const voiced = () => take().map((s) => lineOf(s.url)).filter((l): l is NonNullable<typeof l> => l !== null);
const fresh = () => {
  A.resetAnnouncerMemory();
  take();
};

/* ------------------------------------------------------------ 1. tiers */

const TIERS: Record<string, readonly string[]> = {
  t175: ["voice.great", "voice.brilliant", "voice.superb"],
  t185: ["voice.amazing", "voice.outstanding", "voice.incredible"],
  t195: ["voice.sensational", "voice.unbelievable", "voice.phenomenal"],
  t200: ["voice.perfect", "voice.legendary", "voice.flawless"],
};
const BOUNDARY: [number, readonly string[] | null][] = [
  [0, null], [150, null], [174, null], [174.9, null],
  [175, TIERS.t175!], [184, TIERS.t175!], [185, TIERS.t185!], [194, TIERS.t185!],
  [195, TIERS.t195!], [199, TIERS.t195!], [200, TIERS.t200!],
];
for (const [score, want] of BOUNDARY) {
  const got = A.announcerTier(score);
  check(JSON.stringify(got) === JSON.stringify(want), `score ${score}: tier ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
}
check(A.announcerTier(null) === null && A.announcerTier(undefined) === null && A.announcerTier(Number.NaN) === null, "no score: no tier");
for (const id of A.ANNOUNCER_LINES) {
  check(manifest[id]?.channel === "voice" && !!manifest[id]?.url, `${id}: a voice slot with a file`);
  check(sound.soundDiagnostics().loaded.includes(id), `${id}: loads`);
}
check(A.ANNOUNCER_LINES.length === 12 && new Set(A.ANNOUNCER_LINES).size === 12, "twelve distinct lines");

/* ------------------------------------------------------------ 2. one line per round result */

const DELAY = 350 + A.ANNOUNCER_AFTER_STING_MS;
for (const [score, want] of BOUNDARY) {
  fresh();
  const t0 = Date.now();
  A.announceRoundResult(`round:matchup:1:${score}`, score, true, DELAY);
  await sleep(DELAY + 40);
  const got = take();
  const lines = got.map((s) => lineOf(s.url));
  if (want === null) check(got.length === 0, `score ${score}: no line (${lines.join(", ")})`);
  else {
    check(got.length === 1 && !!lines[0] && want.includes(lines[0]), `score ${score}: exactly one line of its tier (${lines.join(", ")})`);
    check(got.length === 1 && got[0]!.at - t0 >= DELAY - 5 && got[0]!.at - t0 <= DELAY + 35, `score ${score}: plays at the sting + ${A.ANNOUNCER_AFTER_STING_MS} ms (${got[0] ? got[0].at - t0 : "-"} ms)`);
  }
}
// The same round again (a re-render, the effect re-running, a reload in the same tab): nothing more.
fresh();
A.announceRoundResult("round:sudoku:2:1000", 190, true, 20);
await sleep(60);
check(voiced().length === 1, "a round's result: one line");
A.announceRoundResult("round:sudoku:2:1000", 190, true, 20);
A.announceRoundResult("round:sudoku:2:1000", 200, true, 0);
await sleep(60);
check(voiced().length === 0, "the same round again: no second line");
// A reload keeps the tab's session storage: the round stays claimed.
const kept = session.get("duelz-announcer-rounds:v1") ?? "";
check(kept.includes("round:sudoku:2:1000"), "the claimed round is kept for the tab's session");
// A reveal reopened later (AsyncResults passes heroRun false).
fresh();
A.announceRoundResult("round:daily:3:0", 200, false, 0);
await sleep(40);
check(voiced().length === 0, "a reveal reopened later: no line");
// A reveal that closes before the line is due: none, and the round is not claimed (it never played).
fresh();
const pending = A.announceRoundResult("round:tilt:1:5", 186, true, 60);
pending?.cancel();
await sleep(100);
check(voiced().length === 0, "a reveal closed before its line: no line");
// Two rounds in a row (Practice's Play again): one line each.
fresh();
A.announceRoundResult("practice:tilt:1:100", 186, true, 0);
await sleep(30);
A.announceRoundResult("practice:tilt:1:200", 186, true, 0);
await sleep(30);
check(voiced().length === 2, "two rounds: two lines");

/* ------------------------------------------------------------ 3. never the same line twice in a row */

for (const [name, lines] of Object.entries(TIERS)) {
  A.resetAnnouncerMemory();
  let last: string | null = null;
  let repeats = 0;
  const heard = new Set<string>();
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
  for (let i = 0; i < 2000; i++) {
    // Mostly random; every fourth round the picker is pushed at the last line (the first choice), to catch a repeat.
    const random = i % 4 === 3 ? () => 0 : rand;
    const said = A.announceRoundResult(`${name}:${i}`, name === "t200" ? 200 : Number(name.slice(1)), true, 0, random);
    await sleep(0);
    const line = said?.line ?? null;
    if (line && line === last) repeats++;
    if (line) heard.add(line);
    last = line;
  }
  check(repeats === 0, `${name}: ${repeats} consecutive repeats in 2,000 rounds`);
  check(lines.every((l) => heard.has(l)), `${name}: every line heard (${[...heard].join(", ")})`);
}
take();
// The last line is remembered on the device (a reload never repeats it either).
A.resetAnnouncerMemory();
local.set("duelz-announcer-last:v1", "voice.great");
check(A.pickAnnouncerLine(TIERS.t175! as never, () => 0) !== "voice.great", "the device's last line is never picked next, after a reload");

/* ------------------------------------------------------------ 4. the switch, sound off and the volume */

fresh();
check(sound.isAnnouncerOn(), "Announcer voice: on by default");
sound.setAnnouncerOn(false);
A.announceRoundResult("switch:1", 200, true, 0);
await sleep(30);
check(voiced().length === 0, "Announcer voice off: no line");
check(JSON.parse(local.get("duelz_sound_settings_v2") ?? "{}").announcer === false, "Announcer voice is stored with the sound settings");
sound.setAnnouncerOn(true);
sound.setMuted(true);
check(!sound.isAnnouncerOn(), "sound effects off: the announcer reads as off");
A.announceRoundResult("switch:2", 200, true, 0);
await sleep(30);
check(voiced().length === 0, "sound effects off: no line");
sound.setMuted(false);
check(sound.isAnnouncerOn(), "sound effects on again: the announcer is back");
A.announceRoundResult("switch:3", 200, true, 0);
await sleep(30);
check(voiced().length === 1, "both on: the line plays");
const soundSrc = readFileSync("src/lib/sound.ts", "utf8");
check(/voiceGain\?\.gain\.setValueAtTime\(isMuted\(\) \? 0 : effectsVolume\(\), t\)/.test(soundSrc), "the voice bus follows the sound-effects volume (and mute)");
check(/entry\.channel === "voice" && voiceGain \? voiceGain : effectsGain/.test(soundSrc), "voice slots play through the voice bus");

/* ------------------------------------------------------------ 5. where it plays */

const files = (dir: string): string[] => {
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  return readdirSync(dir).flatMap((n) => {
    const p = `${dir}/${n}`;
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
};
const callers = files("src").filter((f) => f !== "src/lib/fx/announcer.ts" && /announceRoundResult\(/.test(readFileSync(f, "utf8")));
check(JSON.stringify(callers) === JSON.stringify(["src/components/duel/AnswerReveal.tsx"]), `only AnswerReveal announces (${callers.join(", ")})`);
const reveal = readFileSync("src/components/duel/AnswerReveal.tsx", "utf8");
check(/announceRoundResult\(key, myScore, heroRunAllowed, REVEAL_SCORE_DELAY_MS \+ ANNOUNCER_AFTER_STING_MS\)/.test(reveal),
  "AnswerReveal announces its own stored score, not on a reopened reveal, at the score cue + 150 ms");
check(/fx\.onRevealScore\(score, def\.theme\), REVEAL_SCORE_DELAY_MS\)/.test(reveal), "the score sting is at REVEAL_SCORE_DELAY_MS");
check(/heroRun=\{false\}/.test(readFileSync("src/components/async/AsyncResults.tsx", "utf8")), "the Daily's reopened reveals pass heroRun false");
check(/myScore=\{myResult \? myResult\.score : null\}/.test(readFileSync("src/routes/duel.$code.tsx", "utf8")), "a room's reveal gets this device's own result row only");
check(/myScore=\{graded\.score\}/.test(readFileSync("src/routes/practice.tsx", "utf8")), "Practice's reveal gets its own graded score");
check(/myScore=\{reveal \? reveal\.result\.score : null\}/.test(readFileSync("src/components/async/AsyncRun.tsx", "utf8")), "the Daily's, challenges' and Score Attack's reveal gets the player's own stored result");
check(!/AnswerReveal|announcer/.test(readFileSync("src/components/replay/ReplayPanels.tsx", "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")), "replays never announce");
const signature = readFileSync("src/lib/fx/signature.ts", "utf8");
check(/if \(score === undefined \|\| score < ANNOUNCER_MIN_SCORE\) playVoice\("voice\.perfect"\)/.test(signature), "the perfect burst's Perfect plays only under 175 (a 200 hears the announcer's one line)");
check(/perfectBurst\(ref\.current, score\)/.test(readFileSync("src/lib/fx/useSignature.ts", "utf8")), "the perfect burst is given the stored score");
const settings = readFileSync("src/components/settings/SettingsPage.tsx", "utf8");
check(/label="Announcer voice" on=\{sound\.announcer && !sound\.muted\}[^\n]*disabled=\{sound\.muted\}/.test(settings), "Settings → Sound → Announcer voice: off and fixed while sound is off");

if (failures.length) {
  for (const f of failures.slice(0, 60)) console.log(`FAIL ${f}`);
  console.log(`FAIL voice-lines-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log(`PASS voice-lines-check: ${passes} assertions`);
