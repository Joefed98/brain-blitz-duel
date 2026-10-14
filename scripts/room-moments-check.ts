/**
 * Room moments (13 Oct 2026): the display-only effects on Prepare to Duel, the
 * round titles, Final Round and the winner reveal (src/lib/fx/roomMoments.ts,
 * RoomMomentFx, styles.css `rfx-*`).
 *
 * Proves: every effect ends inside its existing phase (the phase lengths are
 * unchanged); rounds 1–6 each get a different look and their own cue, the last
 * round is always Final Round; every cue is named room.* and listed in
 * docs/sound-cues/room.md; every rfx keyframe moves only transform and opacity
 * (no per-frame gradients, layout or paint properties); every part has a CSS
 * rule; reduced motion swaps to the calm fade and hides movement-only parts,
 * and that override reaches only the effect parts (an element outside them
 * still gets the app's 0.01 ms reduced-motion rule, computed in happy-dom);
 * the effect layers never take taps; the three screens mount the effects and
 * the room flow and server phase code do not import them.
 *
 *   bun scripts/room-moments-check.ts
 */
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";
import {
  DUEL_START_MS,
  ROUND_TITLE_MS,
  WINNER_REVEAL_MS,
  WINNER_ROLL_END_MS,
} from "../src/lib/duel/startPresentation";
import {
  FINAL_PUNCH_MS,
  FINAL_SPEC,
  PREPARE_SPEC,
  ROUND_EFFECTS,
  WINNER_SPEC,
  momentEndMs,
  roundMomentSpec,
  type MomentSpec,
} from "../src/lib/fx/roomMoments";

const failures: string[] = [];
const ok = (cond: boolean, message: string) => {
  if (!cond) {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
};

// Phase lengths are the server's: unchanged.
ok(DUEL_START_MS === 6000, "Prepare to Duel stays 6 s");
ok(ROUND_TITLE_MS === 3000, "round title stays 3 s");
ok(WINNER_REVEAL_MS === 6300, "winner reveal stays 6.3 s");

const specs: MomentSpec[] = [PREPARE_SPEC, FINAL_SPEC, WINNER_SPEC];
for (let total = 6; total <= 7; total++)
  for (let round = 1; round <= total; round++) specs.push(roundMomentSpec(round, total));

const css = readFileSync("src/styles.css", "utf8");
const cueDoc = readFileSync("docs/sound-cues/room.md", "utf8");
const allCues = new Set<string>();
for (const spec of specs) {
  const label = `${spec.moment}/${spec.effect}`;
  ok(
    momentEndMs(spec) <= spec.phaseMs,
    `${label} ends at ${momentEndMs(spec)} ms, inside ${spec.phaseMs} ms`,
  );
  for (const part of spec.parts) {
    ok(part.delayMs >= 0 && part.durationMs > 0, `${label} ${part.part} timing`);
    const attr = `[data-part="${part.part}"]`;
    const prefixed = `[data-part^="${part.part.split("-")[0]}-"]`;
    ok(css.includes(attr) || css.includes(prefixed), `${label} ${part.part} has a CSS rule`);
  }
  for (const { cue, atMs } of spec.cues) {
    allCues.add(cue);
    ok(/^room\.[a-zA-Z0-9.]+$/.test(cue), `${cue} is a room.* cue`);
    ok(atMs >= 0 && atMs < spec.phaseMs, `${cue} fires inside the phase`);
    ok(cueDoc.includes(`\`${cue}\``), `${cue} listed in docs/sound-cues/room.md`);
  }
}
ok(FINAL_PUNCH_MS <= ROUND_TITLE_MS, "final punch inside the title");
ok(
  WINNER_SPEC.cues.some((c) => c.cue === "room.winner.lock" && c.atMs === WINNER_ROLL_END_MS),
  "winner lock cue on the cut",
);

// Rounds: six distinct looks, cues room.round.1–6, the last round always Final Round.
ok(new Set(ROUND_EFFECTS.map((e) => e.effect)).size === 6, "six distinct round looks");
for (let round = 1; round <= 6; round++) {
  const spec = roundMomentSpec(round, 7);
  ok(spec.moment === "round", `round ${round} of 7 is a round title`);
  ok(spec.effect === ROUND_EFFECTS[round - 1]!.effect, `round ${round} uses its own look`);
  ok(spec.cues[0]?.cue === `room.round.${round}`, `round ${round} cue`);
}
for (const total of [3, 6, 7])
  ok(roundMomentSpec(total, total) === FINAL_SPEC, `round ${total} of ${total} is Final Round`);
ok(roundMomentSpec(5, 6).effect === "rails", "round 5 of 6 keeps its own look");

// Keyframes: transform and opacity only.
const keyframes = [...css.matchAll(/@keyframes (rfx-[\w-]+)\s*\{([\s\S]*?)\}\s*\}/g)];
ok(keyframes.length >= 15, `rfx keyframes found (${keyframes.length})`);
for (const [, name, body] of keyframes) {
  const props = [...(body ?? "").matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
  const bad = props.filter((p) => p !== "opacity" && p !== "transform");
  ok(bad.length === 0, `${name} animates only transform/opacity (${bad.join(", ") || "ok"})`);
}
for (const name of new Set([...css.matchAll(/animation-name:\s*(rfx-[\w-]+)/g)].map((m) => m[1])))
  ok(css.includes(`@keyframes ${name} `), `${name} is defined`);

// Reduced motion, taps, layering.
const reduced = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce) {\n  .room-fx"));
ok(
  /\.room-fx \[data-part\] \{\s*animation-name: rfx-calm !important;\s*animation-duration: var\(--rfx-dur\) !important/.test(
    reduced,
  ),
  "reduced motion: calm fade at the part's own length (the global reduced rule cuts others to 0.01 ms)",
);
ok(
  /\.room-fx \[data-motion\] \{ display: none; \}/.test(reduced),
  "reduced motion: movement-only parts hidden",
);
ok(
  /\.round-title-lines\[data-final\] \{ animation: none; \}/.test(reduced),
  "reduced motion: no title punch",
);
for (const spec of [PREPARE_SPEC, FINAL_SPEC, WINNER_SPEC])
  ok(
    spec.parts.some((p) => !p.motionOnly),
    `${spec.moment} keeps a calm part under reduced motion`,
  );
ok(/\.room-fx \{[^}]*pointer-events: none/.test(css), "effect layers never take taps");
// The override is scoped: only effect parts (`.room-fx [data-part]`) keep their
// length under reduced motion; everything else still gets the app's 0.01 ms rule.
const importantDurations = [
  ...css.matchAll(/([^{}]+)\{[^{}]*animation-duration:[^;{}]*!important/g),
].map((m) => m[1]!.trim().replace(/\s+/g, " "));
ok(
  importantDurations.length === 2 &&
    importantDurations.some((sel) => sel === "*, *::before, *::after") &&
    importantDurations.some((sel) => sel === ".room-fx [data-part]"),
  `only the global rule and .room-fx [data-part] force animation-duration (${importantDurations.join(" | ")})`,
);
const computed = (reducedMotion: "reduce" | "no-preference") => {
  const win = new Window({
    width: 390,
    height: 844,
    settings: { device: { prefersReducedMotion: reducedMotion } } as never,
  });
  const doc = win.document;
  const sheet = doc.createElement("style");
  sheet.textContent = css;
  doc.head.appendChild(sheet);
  doc.body.innerHTML = `<div class="duel-start-screen" data-category="word">
    <div class="room-fx" data-moment="round" data-effect="dial">
      <span id="part" data-part="dial" style="animation-duration: 2750ms; --rfx-dur: 2750ms"><i id="mark"></i></span>
    </div>
    <div id="bolt" class="duel-start-bolt"></div>
    <div class="round-title-lines"><h1 id="heading" class="round-title-heading">ROUND 1</h1></div>
    <span id="outside" data-part="dial" style="animation-duration: 2750ms; --rfx-dur: 2750ms"></span>
    <div id="plain" style="animation-name: rfx-halo; animation-duration: 900ms"></div>
  </div>`;
  const duration = (id: string) => win.getComputedStyle(doc.getElementById(id)!).animationDuration;
  return { win, duration };
};
{
  const { win, duration } = computed("reduce");
  ok(
    win.matchMedia("(prefers-reduced-motion: reduce)").matches,
    "happy-dom honours reduced motion",
  );
  ok(duration("part") === "2750ms", `effect part keeps its calm fade length (${duration("part")})`);
  for (const id of ["mark", "bolt", "heading", "outside", "plain"])
    ok(
      duration(id) === "0.01ms",
      `#${id} outside the effect parts still gets the 0.01 ms rule (${duration(id)})`,
    );
}
{
  const { duration } = computed("no-preference");
  ok(
    duration("plain") === "900ms",
    `without reduced motion the 0.01 ms rule is off (${duration("plain")})`,
  );
}

for (const spec of [PREPARE_SPEC, FINAL_SPEC])
  ok(!spec.parts.some((p) => p.part === "flash" && !p.motionOnly), "flashes are movement-only");

// Wiring: the three screens mount it; room flow and server phases don't know it exists.
for (const file of ["DuelStart", "RoundTitle", "WinnerReveal"])
  ok(
    /<RoomMomentFx spec=/.test(readFileSync(`src/components/duel/${file}.tsx`, "utf8")),
    `${file} mounts RoomMomentFx`,
  );
for (const file of [
  "src/routes/duel.$code.tsx",
  "src/lib/duel/duel.functions.ts",
  "src/lib/duel/roomPhase.server.ts",
  "src/lib/duel/scoring.ts",
])
  ok(
    !/roomMoments|RoomMomentFx/.test(readFileSync(file, "utf8")),
    `${file} untouched by room moments`,
  );
const component =
  readFileSync("src/components/duel/RoomMomentFx.tsx", "utf8") +
  readFileSync("src/lib/fx/useRoomMoments.ts", "utf8");
ok(
  !/requestAnimationFrame|Math\.random|playSound|playVoice/.test(component),
  "no frame loop, randomness or audio",
);

console.log(
  `room moments: ${specs.length} moment specs, ${allCues.size} cues (${[...allCues].sort().join(", ")}), ${keyframes.length} keyframes`,
);
if (failures.length) {
  console.log(`FAIL: ${failures.length} room-moments failure(s)`);
  process.exit(1);
}
console.log(
  "PASS: room moments fit their phases, distinct round looks, room.* cues documented, transform/opacity only, reduced motion calm.",
);
