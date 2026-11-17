/**
 * Bomb Defusal's level panels (the Attention overhaul, stage 3, 15 Nov 2026): version 3's plain clue card on any panel
 * size. A panel has `wires` wires and the two buttons; a plan of `steps` distinct actions is chosen first, then a card
 * of plain clues that are TRUE of that plan, kept only when exactly one ordered sequence of `steps` actions satisfies
 * every clue (it is the plan), every clue is needed (dropping any one lets another sequence through) and the card's
 * size is in the level's range. Zero answers and two answers are both rejected before a panel is ever banked.
 *
 * The proof enumerates every ordered sequence (Easy 840, Hard 181,440, Expert 1,814,400) as bytes and keeps one bit
 * mask per clue, so a card's answers are an AND of its masks. Slow for Expert (seconds a panel), so the panels are
 * banked offline by scripts/bomb-levels-bank.ts (bombLevelsBank.server.ts) and dealt by index from the room seed.
 * Server-only.
 */
import { cutAction, encodeBombActions, encodeBombConstraints, isCut, pressAction, cutIndex, WIRE_COLOURS, BOMB_SWITCH_POSITIONS, type BombAction, type BombConstraint, type WireColour } from "./bomb";
import { pick, randomBelow, shuffled } from "./random";
import type { BombPuzzleData } from "./types";

/** The levers a level's panel is built to (attentionLevels.data.ts BombLevel). */
export interface BombLevers {
  wires: number;
  steps: number;
  clues: readonly [number, number];
  timeLimitMs: number;
}

type Family = "step" | "before" | "next" | "which";

/** At most this many clues of each kind on one card (version 3's caps, a little wider for the longer cards). */
export function bombFamilyCap(l: BombLevers): Record<Family, number> {
  const big = l.steps >= 7;
  return { step: big ? 3 : 2, before: big ? 6 : 5, next: big ? 3 : 2, which: 3 };
}

interface Clue {
  id: string;
  text: string;
  family: Family;
  pair?: string | undefined;
  /** Whether the sequence at offset `o` (steps bytes) satisfies the clue. */
  test: (seq: Uint8Array, o: number) => boolean;
  /** The same clue on an action list (the plan). */
  holds: (plan: readonly number[]) => boolean;
}

const plainAct = (action: BombAction) => (isCut(action) ? `cut wire ${cutIndex(action) + 1}` : `press ${action.slice(1)}`);
const capFirst = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const colourWord = (colour: WireColour) => colour.charAt(0) + colour.slice(1).toLowerCase();
const NUMBER_WORDS = ["", "", "both", "all 3", "all 4", "all 5", "all 6", "all 7", "all 8"];

/** The actions a panel of `wires` wires offers: the cuts, then A and B. */
export function bombActionsOf(wires: number): BombAction[] {
  return [...Array.from({ length: wires }, (_, i) => cutAction(i)), pressAction("A"), pressAction("B")];
}

/** Every plain clue a panel could carry (version 3's kinds), each with a byte test for the proof. */
export function levelClueCandidates(wiresOf: readonly WireColour[], steps: number): Clue[] {
  const actions = bombActionsOf(wiresOf.length);
  const n = actions.length;
  const out: Clue[] = [];
  const indexOf = (s: Uint8Array, o: number, a: number) => {
    for (let k = 0; k < steps; k++) if (s[o + k] === a) return k;
    return -1;
  };
  for (let x = 0; x < n; x++) {
    const ax = actions[x]!;
    for (let step = 0; step < steps; step++) {
      out.push({ id: `step:${step + 1}:${ax}`, text: `Step ${step + 1}: ${plainAct(ax)}.`, family: "step", test: (s, o) => s[o + step] === x, holds: (p) => p[step] === x });
    }
    out.push({
      id: `no:${ax}`,
      text: isCut(ax) ? `Do not cut wire ${cutIndex(ax) + 1}.` : `Do not press button ${ax.slice(1)}.`,
      family: "which",
      test: (s, o) => indexOf(s, o, x) < 0,
      holds: (p) => !p.includes(x),
    });
    for (let y = 0; y < n; y++) {
      if (x === y) continue;
      const ay = actions[y]!;
      const pair = [ax, ay].sort().join("|");
      out.push({
        id: `before:${ax}:${ay}`,
        text: `${capFirst(plainAct(ax))} at some point before you ${plainAct(ay)}.`,
        family: "before",
        pair,
        test: (s, o) => {
          const a = indexOf(s, o, x);
          const b = indexOf(s, o, y);
          return a >= 0 && b >= 0 && a < b;
        },
        holds: (p) => p.indexOf(x) >= 0 && p.indexOf(y) >= 0 && p.indexOf(x) < p.indexOf(y),
      });
      out.push({
        id: `next:${ax}:${ay}`,
        text: `${capFirst(plainAct(ax))}, then ${plainAct(ay)} as the very next step.`,
        family: "next",
        pair,
        test: (s, o) => {
          const a = indexOf(s, o, x);
          return a >= 0 && a + 1 < steps && s[o + a + 1] === y;
        },
        holds: (p) => p.indexOf(x) >= 0 && p[p.indexOf(x) + 1] === y,
      });
    }
  }
  const bA = n - 2;
  const bB = n - 1;
  out.push({ id: "both-buttons", text: "Press both buttons.", family: "which", test: (s, o) => indexOf(s, o, bA) >= 0 && indexOf(s, o, bB) >= 0, holds: (p) => p.includes(bA) && p.includes(bB) });
  for (const colour of WIRE_COLOURS) {
    const idx = wiresOf.flatMap((w, i) => (w === colour ? [i] : []));
    if (!idx.length) continue;
    const name = colourWord(colour);
    out.push({
      id: `every:${colour}`,
      text: idx.length === 1 ? `Cut the ${name} wire.` : `Cut ${NUMBER_WORDS[idx.length]} ${name} wires.`,
      family: "which",
      test: (s, o) => idx.every((w) => indexOf(s, o, w) >= 0),
      holds: (p) => idx.every((w) => p.includes(w)),
    });
    out.push({
      id: `none:${colour}`,
      text: idx.length === 1 ? `Do not cut the ${name} wire.` : `Do not cut any ${name} wire.`,
      family: "which",
      test: (s, o) => idx.every((w) => indexOf(s, o, w) < 0),
      holds: (p) => idx.every((w) => !p.includes(w)),
    });
  }
  for (let k = Math.max(1, steps - 3); k <= Math.min(wiresOf.length, steps); k++) {
    out.push({
      id: `cuts:${k}`,
      text: `Cut exactly ${k} wires.`,
      family: "which",
      test: (s, o) => {
        let c = 0;
        for (let j = 0; j < steps; j++) if (s[o + j]! < bA) c++;
        return c === k;
      },
      holds: (p) => p.filter((a) => a < bA).length === k,
    });
  }
  return out;
}

/** Every ordered choice of `steps` distinct actions of `n`, as packed bytes; cached per size. */
const SEQUENCES = new Map<string, { bytes: Uint8Array; count: number }>();
export function bombSequences(n: number, steps: number): { bytes: Uint8Array; count: number } {
  const key = `${n}:${steps}`;
  const cached = SEQUENCES.get(key);
  if (cached) return cached;
  let count = 1;
  for (let k = 0; k < steps; k++) count *= n - k;
  const bytes = new Uint8Array(count * steps);
  const prefix = new Uint8Array(steps);
  const used = new Uint8Array(n);
  let at = 0;
  const walk = (depth: number) => {
    if (depth === steps) {
      bytes.set(prefix, at * steps);
      at++;
      return;
    }
    for (let a = 0; a < n; a++) {
      if (used[a]) continue;
      used[a] = 1;
      prefix[depth] = a;
      walk(depth + 1);
      used[a] = 0;
    }
  };
  walk(0);
  const out = { bytes, count };
  SEQUENCES.set(key, out);
  return out;
}

function maskOf(clue: Clue, seqs: { bytes: Uint8Array; count: number }, steps: number): Uint32Array {
  const mask = new Uint32Array(Math.ceil(seqs.count / 32));
  for (let i = 0; i < seqs.count; i++) if (clue.test(seqs.bytes, i * steps)) mask[i >> 5]! |= 1 << (i & 31);
  return mask;
}

function and(a: Uint32Array, b: Uint32Array): Uint32Array {
  const out = new Uint32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i]! & b[i]!;
  return out;
}

function bitsOf(bits: Uint32Array, limit = Number.MAX_SAFE_INTEGER): number {
  let n = 0;
  for (let i = 0; i < bits.length && n < limit; i++) {
    let w = bits[i]!;
    while (w && n < limit) {
      w &= w - 1;
      n++;
    }
  }
  return n;
}

function firstOf(bits: Uint32Array): number {
  for (let i = 0; i < bits.length; i++) if (bits[i]) return i * 32 + Math.clz32(bits[i]! & -bits[i]!) * -1 + 31;
  return -1;
}

function allOf(count: number): Uint32Array {
  const bits = new Uint32Array(Math.ceil(count / 32)).fill(0xffff_ffff);
  for (let i = count; i < bits.length * 32; i++) bits[i >> 5]! &= ~(1 << (i & 31));
  return bits;
}

function solutionsOf(masks: Uint32Array[], count: number, limit = 3): number {
  let bits = allOf(count);
  for (const m of masks) bits = and(bits, m);
  return bitsOf(bits, limit);
}

/** The index of a plan among the sequences (walk order: lexicographic over action indices). */
function planIndex(plan: readonly number[], n: number): number {
  let index = 0;
  const used: boolean[] = Array.from({ length: n }, () => false);
  for (let k = 0; k < plan.length; k++) {
    let below = 0;
    for (let a = 0; a < plan[k]!; a++) if (!used[a]) below++;
    let rest = 1;
    for (let j = k + 1; j < plan.length; j++) rest *= n - j;
    index += below * rest;
    used[plan[k]!] = true;
  }
  return index;
}

const familiesOk = (clues: Clue[], cap: Record<Family, number>) => {
  const counts: Record<Family, number> = { step: 0, before: 0, next: 0, which: 0 };
  for (const c of clues) if (++counts[c.family] > cap[c.family]) return false;
  return true;
};
const pairsOk = (clues: Clue[]) => {
  const seen = new Set<string>();
  for (const c of clues) {
    if (!c.pair) continue;
    if (seen.has(c.pair)) return false;
    seen.add(c.pair);
  }
  return true;
};

/** A level's panel and its proved card (version 3's wording); throws if none passes in the budget. */
export function generateBombAt(l: BombLevers, maxAttempts = 400): BombPuzzleData {
  const actions = bombActionsOf(l.wires);
  const n = actions.length;
  const seqs = bombSequences(n, l.steps);
  const cap = bombFamilyCap(l);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const wires = Array.from({ length: l.wires }, () => pick(WIRE_COLOURS));
    const buttons = [
      { label: "A" as const, colour: pick(WIRE_COLOURS) },
      { label: "B" as const, colour: pick(WIRE_COLOURS) },
    ];
    const plan = shuffled(Array.from({ length: n }, (_, i) => i)).slice(0, l.steps);
    const target = planIndex(plan, n);
    const pool = shuffled(levelClueCandidates(wires, l.steps).filter((c) => c.holds(plan)));
    const masks: (Uint32Array | undefined)[] = [];
    const maskAt = (i: number) => (masks[i] ??= maskOf(pool[i]!, seqs, l.steps));
    let picked: number[] | null = null;
    for (let restart = 0; restart < 8 && !picked; restart++) {
      const chosen: number[] = [];
      let bits = allOf(seqs.count);
      while (bitsOf(bits, 2) > 1 && chosen.length < l.clues[1] + 4) {
        const clues = chosen.map((i) => pool[i]!);
        const before = bitsOf(bits);
        const options: { i: number; next: Uint32Array; left: number }[] = [];
        for (let i = 0; i < pool.length; i++) {
          if (chosen.includes(i)) continue;
          const c = pool[i]!;
          if (!familiesOk([...clues, c], cap) || !pairsOk([...clues, c])) continue;
          const next = and(bits, maskAt(i));
          const left = bitsOf(next);
          if (left < before) options.push({ i, next, left });
        }
        if (!options.length) break;
        options.sort((a, b) => a.left - b.left);
        const o = options[randomBelow(Math.min(6, options.length))]!;
        chosen.push(o.i);
        bits = o.next;
      }
      if (bitsOf(bits, 2) !== 1 || firstOf(bits) !== target) continue;
      let kept = [...chosen];
      for (const drop of shuffled([...chosen])) {
        const rest = kept.filter((i) => i !== drop);
        if (solutionsOf(rest.map(maskAt), seqs.count, 2) === 1) kept = rest;
      }
      if (kept.length < l.clues[0] || kept.length > l.clues[1]) continue;
      picked = kept;
    }
    if (!picked) continue;
    const cluesMasks = picked.map(maskAt);
    if (solutionsOf(cluesMasks, seqs.count) !== 1) continue;
    // Every clue needed: without any one, a second sequence gets through.
    if (!cluesMasks.every((_, drop) => solutionsOf(cluesMasks.filter((__, k) => k !== drop), seqs.count, 2) >= 2)) continue;
    const planActions = plan.map((i) => actions[i]!);
    const constraints: BombConstraint[] = planActions.slice(0, -1).map((a, i) => ({ kind: "before", a, b: planActions[i + 1]! }) as const);
    return {
      type: "bomb",
      wires,
      buttons,
      light: randomBelow(2) === 1,
      serial: Array.from({ length: 3 }, () => randomBelow(10)).join(""),
      switchPosition: pick(BOMB_SWITCH_POSITIONS),
      rules: shuffled(picked.map((i) => pool[i]!)).map((c) => ({ id: c.id, text: c.text })),
      stepCount: l.steps,
      bombVersion: 3,
      timeLimitMs: l.timeLimitMs,
      required: encodeBombActions(planActions),
      constraints: encodeBombConstraints(constraints),
      sequence: encodeBombActions(planActions),
    };
  }
  throw new Error("Bomb Defusal could not build a level panel");
}

/** Re-proves a banked level panel from its clue ids: one sequence, the stored one, every clue needed, the wording. */
export function inspectBombLevel(puzzle: BombPuzzleData, l: BombLevers): { solutions: number; unique: boolean; allNeeded: boolean; wordingOk: boolean; capsOk: boolean; size: boolean } {
  const actions = bombActionsOf(puzzle.wires.length);
  const seqs = bombSequences(actions.length, puzzle.stepCount);
  const candidates = levelClueCandidates(puzzle.wires, puzzle.stepCount);
  const clues = puzzle.rules.map((r) => candidates.find((c) => c.id === r.id));
  const known = clues.filter((c): c is Clue => !!c);
  const masks = known.map((c) => maskOf(c, seqs, puzzle.stepCount));
  let bits = allOf(seqs.count);
  for (const m of masks) bits = and(bits, m);
  const found = bitsOf(bits, 3);
  const plan = (puzzle.sequence ?? "").split(",").map((a) => actions.indexOf(a as BombAction));
  return {
    solutions: found,
    unique: found === 1 && known.length === puzzle.rules.length && firstOf(bits) === planIndex(plan, actions.length),
    allNeeded: masks.every((_, drop) => solutionsOf(masks.filter((__, k) => k !== drop), seqs.count, 2) >= 2),
    wordingOk: puzzle.rules.every((r, i) => clues[i]?.text === r.text),
    capsOk: familiesOk(known, bombFamilyCap(l)) && pairsOk(known),
    size: puzzle.wires.length === l.wires && puzzle.stepCount === l.steps && puzzle.rules.length >= l.clues[0] && puzzle.rules.length <= l.clues[1],
  };
}
