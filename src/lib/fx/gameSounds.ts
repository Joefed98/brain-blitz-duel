/**
 * Per-game sound observers. They read sim state after each frame and play
 * manifest sounds on transitions; they never feed anything back to the sim.
 */
import { ensureLoop, playSound, stopLoop } from "@/lib/sound";
import type { OrbitState } from "@/lib/arcade/orbit";
import type { SwingState } from "@/lib/arcade/swing";
import type { WavState } from "@/lib/arcade/wavefront";
import type { CrossState } from "@/lib/arcade/cross";
import type { FlipState } from "@/lib/arcade/flip";
import { HOVER_IMPULSE, type HoverState } from "@/lib/arcade/hover";
import type { SnakeState } from "@/lib/arcade/snake";
import { BRK_PADDLE_Y, type BrkState } from "@/lib/arcade/breaker";
import type { RallyState } from "@/lib/arcade/rally";
import type { BurstState } from "@/lib/arcade/burst";
import { BEAT_JUDGE_PENDING, type BeatState } from "@/lib/arcade/beat";
import { BINTOSS_THROWS, type BinTossState } from "@/lib/arcade/binToss";
import type { TiltState } from "@/lib/arcade/tilt";
import type { BtState } from "@/lib/arcade/ballTrack";
import { BULLSEYE_ARROWS, type BullseyeState } from "@/lib/arcade/bullseye";

export interface GameSounds<S> {
  frame: (state: S, running: boolean) => void;
  stop: () => void;
}

const AMBIENCE_VOLUME = 0.22;
const HISS_VOLUME = 0.18;

export function orbitSounds(): GameSounds<OrbitState> {
  let prev: OrbitState | null = null;
  return {
    frame(state, running) {
      if (running) ensureLoop("arc_space_ambience", AMBIENCE_VOLUME);
      else stopLoop("arc_space_ambience");
      if (prev && state.tick > prev.tick) {
        if (state.releaseTick !== prev.releaseTick && state.flying > 0) playSound("arc_thruster");
        if (prev.checkpoint < 0 && state.checkpoint >= 0) playSound("arc_pickup");
        if (state.respawnTick !== prev.respawnTick || (state.ended === 2 && prev.ended !== 2)) playSound("arc_crash");
      }
      prev = state;
    },
    stop: () => stopLoop("arc_space_ambience"),
  };
}

export function swingSounds(): GameSounds<SwingState> {
  let prev: SwingState | null = null;
  return {
    frame(state, running) {
      if (running) ensureLoop("arc_lava_hiss", HISS_VOLUME);
      else stopLoop("arc_lava_hiss");
      if (prev && state.tick > prev.tick) {
        if (state.ended === 2 && prev.ended !== 2) playSound("arc_crash");
        else if (prev.rope >= 0 && state.rope < 0) playSound("arc_swoosh");
      }
      prev = state;
    },
    stop: () => stopLoop("arc_lava_hiss"),
  };
}

/** Gem chime for cascade step n: up one semitone per step. */
export function playGemChime(step: number): void {
  playSound("arc_gem_chime", 1, Math.pow(2, Math.min(step, 12) / 12));
}

export function wavefrontSounds(): GameSounds<WavState> {
  let prev: WavState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.fireIn > prev.fireIn) playSound("arc_laser", 0.6, 1, true);
        // Shapes and the armour block destroyed this frame (bursts carry the kill tick).
        if (state.bursts.some((b) => b.t > prev!.tick && b.c !== 3)) playSound("arc_crash", 0.7);
        if (state.lives < prev.lives) playSound("arc_lose_life");
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function crossSounds(): GameSounds<CrossState> {
  let prev: CrossState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.lives < prev.lives) playSound("arc_lose_life");
        else if (state.crossings > prev.crossings) playSound("stage_complete");
        else if (state.col !== prev.col || (state.hop > 0 && (prev.hop === 0 || state.hop > prev.hop))) playSound("arc_swoosh", 0.6);
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function flipSounds(): GameSounds<FlipState> {
  let prev: FlipState | null = null;
  return {
    frame(state, running) {
      if (running) ensureLoop("arc_lava_hiss", HISS_VOLUME);
      else stopLoop("arc_lava_hiss");
      if (prev && state.tick > prev.tick) {
        if (state.ended === 2 && prev.ended !== 2) playSound("arc_crash");
        else if (state.flipT > prev.flipT) playSound("arc_swoosh", 0.7);
      }
      prev = state;
    },
    stop: () => stopLoop("arc_lava_hiss"),
  };
}

/* ============================ Retro Arcade world ============================ */

/** Coin once when the run starts; shared by every Retro Arcade game. */
function retroStart() {
  let started = false;
  return (running: boolean) => {
    if (running && !started) {
      started = true;
      playSound("arc_retro_coin");
    }
  };
}

export function hoverSounds(): GameSounds<HoverState> {
  let prev: HoverState | null = null;
  const start = retroStart();
  return {
    frame(state, running) {
      start(running);
      if (prev && state.tick > prev.tick) {
        if (state.crashed && !prev.crashed) playSound("arc_retro_explode");
        else {
          if (state.gates > prev.gates) playSound("arc_retro_note");
          // A tap sets vy to the impulse exactly; gravity alone never reaches it.
          if (state.vy === HOVER_IMPULSE) playSound("arc_retro_blip", 0.7, 1, true);
        }
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function snakeSounds(): GameSounds<SnakeState> {
  let prev: SnakeState | null = null;
  const start = retroStart();
  return {
    frame(state, running) {
      start(running);
      if (prev && state.tick > prev.tick) {
        if (state.dead && !prev.dead) playSound("arc_retro_explode");
        else if (state.eaten > prev.eaten) playSound("arc_retro_blip");
      }
      prev = state;
    },
    stop: () => {},
  };
}

/** Lane pitches: a rising major-ish set of semitone steps. */
const BEAT_LANE_RATES = [1, 2 ** (4 / 12), 2 ** (7 / 12), 2 ** (12 / 12)];

export function beatSounds(): GameSounds<BeatState> {
  let prev: BeatState | null = null;
  const start = retroStart();
  return {
    frame(state, running) {
      start(running);
      if (prev && state.tick > prev.tick) {
        if (state.misses > prev.misses) playSound("arc_retro_hit");
        const hits = state.perfect + state.good + state.ok - (prev.perfect + prev.good + prev.ok);
        const heldNew = state.lastJudge === BEAT_JUDGE_PENDING && state.judgeAge === 0;
        if (hits > 0 || heldNew) playSound("arc_retro_note", 0.8, BEAT_LANE_RATES[Math.max(0, state.lastLane)] ?? 1, true);
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function breakerSounds(): GameSounds<BrkState> {
  let prev: BrkState | null = null;
  const start = retroStart();
  return {
    frame(state, running) {
      start(running);
      if (prev && state.tick > prev.tick) {
        if (state.losses > prev.losses) playSound("arc_retro_explode");
        if (state.powerUps > prev.powerUps) playSound("arc_retro_pickup");
        if (state.hits > prev.hits) playSound("arc_retro_hit", 0.8, 1, true);
        // Paddle hit: a ball near the paddle that was falling and now rises.
        const paddleHit = state.balls.some((ball, i) => {
          const before = prev!.balls[i];
          return !!before && before.vy > 0 && ball.vy < 0 && ball.y > (BRK_PADDLE_Y - 40) * 256;
        });
        if (paddleHit) playSound("arc_retro_blip", 0.8, 1, true);
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function rallySounds(): GameSounds<RallyState> {
  let prev: RallyState | null = null;
  const start = retroStart();
  return {
    frame(state, running) {
      start(running);
      if (prev && state.tick > prev.tick) {
        if (state.dead && !prev.dead) playSound("arc_retro_explode");
        if (state.goldHits > prev.goldHits) playSound("arc_retro_note");
        if (state.hits > prev.hits) playSound("arc_retro_blip");
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function burstSounds(): GameSounds<BurstState> {
  let prev: BurstState | null = null;
  const start = retroStart();
  return {
    frame(state, running) {
      start(running);
      if (prev && state.tick > prev.tick) {
        if (state.ended === 2 && prev.ended !== 2) playSound("arc_retro_explode");
        else if (state.lives < prev.lives) playSound("arc_lose_life");
        if (state.hits > prev.hits) playSound("arc_retro_hit", 0.8, 1, true);
        if ((state.shield && !prev.shield) || (state.burst && !prev.burst)) playSound("arc_retro_pickup");
        if (state.shots.length > prev.shots.length) playSound("arc_retro_blip", 0.6, 1, true);
      }
      prev = state;
    },
    stop: () => {},
  };
}

/* ============================== Fairground world ============================= */

/** Sting once when a run finishes perfect; shared by every Fairground game. */
function fairPerfect() {
  let played = false;
  return (perfect: boolean) => {
    if (perfect && !played) {
      played = true;
      playSound("arc_fair_sting");
    }
  };
}

export function binTossSounds(): GameSounds<BinTossState> {
  let prev: BinTossState | null = null;
  const perfect = fairPerfect();
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.baskets > prev.baskets) {
          playSound("arc_fair_bucket");
          if (state.baskets === BINTOSS_THROWS) playSound("arc_fair_bell");
        } else if (state.resolved > prev.resolved) playSound("arc_bounce", 0.7);
        if (state.wobbleTick !== prev.wobbleTick && state.wobbleTick > 0) playSound("arc_bounce", 0.7, 1, true);
        perfect(state.baskets === BINTOSS_THROWS);
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function bullseyeSounds(): GameSounds<BullseyeState> {
  let prev: BullseyeState | null = null;
  const perfect = fairPerfect();
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (prev.flightTick > 0 && state.flightTick === 0 && state.hits.length > 0) {
          playSound("arc_fair_thud");
          if (state.hits[state.hits.length - 1]!.value === 10) playSound("arc_fair_bell");
        }
        perfect(state.hits.length === BULLSEYE_ARROWS && state.flightTick === 0 && state.total === BULLSEYE_ARROWS * 10);
      }
      prev = state;
    },
    stop: () => {},
  };
}

/* ================================ Toybox world =============================== */

const ROLL_VOLUME = 0.14;
const KNOCK_GAP_MS = 80;

/** Wood knock on ball-to-wall contact, at most one per 80 ms. */
function toyKnock() {
  let lastAt = -Infinity;
  return () => {
    const now = typeof performance === "undefined" ? 0 : performance.now();
    if (now - lastAt < KNOCK_GAP_MS) return;
    lastAt = now;
    playSound("arc_wood_knock", 0.7, 1, true);
  };
}

/** Quiet marble-roll loop while the player's ball moves. */
function toyRoll(moving: boolean) {
  if (moving) ensureLoop("arc_marble_roll", ROLL_VOLUME);
  else stopLoop("arc_marble_roll");
}

/** Speed (1/256 px a tick) above which a stop against a wall counts as a knock. */
const TILT_KNOCK_SPEED = 100;
const TILT_ROLL_SPEED = 40;

export function tiltSounds(): GameSounds<TiltState> {
  let prev: TiltState | null = null;
  const knock = toyKnock();
  return {
    frame(state, running) {
      toyRoll(running && Math.abs(state.vx) + Math.abs(state.vy) > TILT_ROLL_SPEED);
      if (prev && state.tick > prev.tick) {
        if (state.caught && !prev.caught) playSound("arc_crash");
        if (state.mazes > prev.mazes) playSound("arc_marble_clink");
        else if (state.level === prev.level) {
          if (state.gate && !prev.gate) playSound("arc_latch");
          const hitX = Math.abs(prev.vx) > TILT_KNOCK_SPEED && state.vx === 0;
          const hitY = Math.abs(prev.vy) > TILT_KNOCK_SPEED && state.vy === 0;
          if (hitX || hitY) knock();
        }
      }
      prev = state;
    },
    stop: () => stopLoop("arc_marble_roll"),
  };
}

export function ballTrackSounds(): GameSounds<BtState> {
  let prev: BtState | null = null;
  return {
    frame(state, running) {
      toyRoll(running && state.balls.some((b) => b.cell >= 0));
      if (prev && state.tick > prev.tick) {
        if (state.home > prev.home) playSound("arc_marble_clink");
        if (state.wrong > prev.wrong) playSound("arc_wood_knock");
        if (state.actions > prev.actions) playSound("arc_latch", 0.8, 1, true);
      }
      prev = state;
    },
    stop: () => stopLoop("arc_marble_roll"),
  };
}
