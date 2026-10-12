/**
 * Per-game sound observers. They read sim state after each frame and play
 * manifest sounds on transitions; they never feed anything back to the sim.
 */
import { ensureLoop, playSound, stopLoop } from "@/lib/sound";
import type { OrbitState } from "@/lib/arcade/orbit";
import type { ClashState } from "@/lib/arcade/colourClash";
import type { SwingState } from "@/lib/arcade/swing";
import type { WavState } from "@/lib/arcade/wavefront";
import type { CrossState } from "@/lib/arcade/cross";
import type { FlipState } from "@/lib/arcade/flip";
import { type HoverState } from "@/lib/arcade/hover";
import type { SnakeState } from "@/lib/arcade/snake";
import { BRK_PADDLE_Y, type BrkState } from "@/lib/arcade/breaker";
import type { RallyState } from "@/lib/arcade/rally";
import type { BurstState } from "@/lib/arcade/burst";
import { BEAT_JUDGE_PENDING, type BeatState } from "@/lib/arcade/beat";
import { BINTOSS_THROWS, type BinTossState } from "@/lib/arcade/binToss";
import type { TiltState } from "@/lib/arcade/tilt";
import type { BtState } from "@/lib/arcade/ballTrack";
import { JUNC_BUILD_EVERY, JUNC_BUILDS, type JuncState } from "@/lib/arcade/junction";
import type { SkylineState } from "@/lib/arcade/skyline";
import type { InkState } from "@/lib/arcade/inkBridge";
import { inkFailedOnBlock } from "@/lib/arcade/inkBridge.renderer";
import { BULLSEYE_ARROWS, type BullseyeState } from "@/lib/arcade/bullseye";
import type { BubState } from "@/lib/arcade/bubble";
import type { SliceState } from "@/lib/arcade/slice";
import { SNIP_EATEN, type SnipState } from "@/lib/arcade/snip";

export interface GameSounds<S> {
  frame: (state: S, running: boolean) => void;
  stop: () => void;
}

const AMBIENCE_VOLUME = 0.22;

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
      void running;
      if (prev && state.tick > prev.tick) {
        if (state.ended === 2 && prev.ended !== 2) playSound("arc_crash");
        else if (prev.rope < 0 && state.rope >= 0) playSound("arc_grapple");
        // swingRev 4: a star taken, the dragon appearing, a stalactite starting to shake, a jet erupting.
        if ((state.stars ?? 0) > (prev.stars ?? 0)) playSound("arc_pickup", 0.9);
        if ((state.chaseX ?? 0) !== 0 && (prev.chaseX ?? 0) === 0) playSound("arc_siren", 0.6);
        if ((state.rocks ?? []).some((r, i) => r.phase === 1 && prev!.rocks?.[i]?.phase === 0)) playSound("arc_clank", 0.5);
        if ((state.rocks ?? []).some((r, i) => r.phase === 3 && prev!.rocks?.[i]?.phase === 2)) playSound("arc_wood_knock", 0.5);
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function wavefrontSounds(): GameSounds<WavState> {
  let prev: WavState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.fireIn > prev.fireIn) playSound("arc_blaster", 0.6, 1, true);
        if (state.pierce > prev.pierce) playSound("arc_retro_pickup");
        // Ships and the armoured ship destroyed this frame (bursts carry the kill tick).
        if (state.bursts.some((b) => b.t > prev!.tick && (b.c === 3 || b.c === 4))) playSound("arc_big_explode", 0.8);
        else if (state.bursts.some((b) => b.t > prev!.tick && b.c !== 3)) playSound("arc_shape_pop", 0.7);
        if (state.lives < prev.lives) playSound("arc_lose_life");
        // wavRev 2: a boss hit, the next formation (or the boss) arriving, a ship peeling off to dive.
        if ((state.bossHits ?? 0) > (prev.bossHits ?? 0) && !state.bossKilled) playSound("arc_retro_hit", 0.7, 1, true);
        if ((state.enter ?? 0) > 0 && (prev.enter ?? 0) === 0) playSound("stage_complete", 0.8);
        if ((state.divers ?? []).length > (prev.divers ?? []).length) playSound("arc_retro_blip", 0.5, 1, true);
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
        else if (state.col !== prev.col || (state.hop > 0 && (prev.hop === 0 || state.hop > prev.hop))) playSound("arc_honk", 0.6);
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
      void running;
      if (prev && state.tick > prev.tick) {
        if (state.ended === 2 && prev.ended !== 2) playSound("arc_crash");
        else if (state.flipT > prev.flipT) playSound("arc_gravity_flip", 0.7);
      }
      prev = state;
    },
    stop: () => {},
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
          // hoverRev 2: a gold star collected.
          if ((state.stars ?? 0) > (prev.stars ?? 0)) playSound("arc_retro_coin", 0.8);
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
        // snakeRev 2: a rock's shadow appears, then it lands clear of the head.
        else if ((state.rocks?.length ?? 0) > (prev.rocks?.length ?? 0)) playSound("arc_retro_hit", 0.7);
        else if ((state.rockWarn ?? -1) >= 0 && (prev.rockWarn ?? -1) < 0) playSound("arc_retro_note", 0.5, 0.7);
        // snakeRev 3 meteor shower: a low alarm as the three shadows appear.
        if ((state.showerDone ?? 0) > (prev.showerDone ?? 0)) playSound("arc_retro_note", 0.7, 0.5, true);
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
        // brkRev 2: Fireball lit.
        if ((state.fireballs ?? 0) > (prev.fireballs ?? 0)) playSound("arc_retro_coin", 0.8);
        if (state.hits > prev.hits) playSound("arc_retro_hit", 0.8, 1, true);
        // Laser fired: the beam timer jumps to full; one instance per fired ball.
        if (state.beam > prev.beam) playSound("arc_laser_beam", 0.8);
        for (let b = 0; b < state.balls.length - prev.balls.length; b++) playSound("arc_multiball", 0.7);
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
        // burstRev 2: a FREEZE icon caught.
        if ((state.freezes ?? 0) > (prev.freezes ?? 0)) playSound("arc_retro_coin", 0.8);
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
        else if ((state.cupped ?? 0) > (prev.cupped ?? 0)) playSound("arc_marble_clink", 0.7);
        if ((state.stars ?? 0) > (prev.stars ?? 0)) playSound("arc_leaf_collect", 0.8);
        if (state.mazes === prev.mazes && state.level === prev.level) {
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

/* ============================== Real World ============================== */

const HORN_GAP_MS = 700;

export function junctionSounds(): GameSounds<JuncState> {
  let prev: JuncState | null = null;
  let hornAt = -Infinity;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.gaveUp > prev.gaveUp) {
          const now = typeof performance === "undefined" ? 0 : performance.now();
          if (now - hornAt >= HORN_GAP_MS) {
            hornAt = now;
            playSound("arc_horn", 0.6);
          }
        }
        const known = new Set(prev.cars.map((c) => c.id));
        if (state.cars.some((c) => c.amb && !known.has(c.id))) playSound("arc_siren", 0.5);
        // junctionRev 2: a new road opens; a bus clears the junction.
        if (state.rev && Math.trunc(state.tick / JUNC_BUILD_EVERY) > Math.trunc(prev.tick / JUNC_BUILD_EVERY) && state.tick <= JUNC_BUILDS * JUNC_BUILD_EVERY) playSound("arc_clank", 0.7);
        if ((state.busCleared ?? 0) > (prev.busCleared ?? 0)) playSound("arc_honk", 0.4);
        if (state.ended === 2 && prev.ended === 0) playSound("arc_crash");
        else if (state.ended === 1 && prev.ended === 0) playSound("stage_complete");
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function skylineSounds(): GameSounds<SkylineState> {
  let prev: SkylineState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.blocks.length > prev.blocks.length) {
          playSound("arc_clank", 0.8, 1, true);
          if (state.perfectTick === state.tick) playSound("correct");
          // skylineRev 2: a streak bonus drop (3rd perfect in a row or later).
          if ((state.streakPoints ?? 0) > (prev.streakPoints ?? 0)) playSound("arc_retro_coin", 0.7);
        }
        if (state.missed && !prev.missed) playSound("arc_crash");
      }
      prev = state;
    },
    stop: () => {},
  };
}

/** Rainbow world; shared run-end feedback supplies the complete cue. */

export function inkBridgeSounds(): GameSounds<InkState> {
  let prev: InkState | null = null;
  let armed = -1;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        // Keep one draw sound after the first segment of each stroke.
        if (state.strokeStarts.length > prev.strokeStarts.length) armed = state.strokeStarts[state.strokeStarts.length - 1] ?? -1;
        if (armed >= 0 && state.segs.length > armed) {
          playSound("arc_rainbow", 0.6);
          armed = -1;
        }
        if (state.flashTick === state.tick || state.flashTick > prev.flashTick) {
          if (state.flashKind === 1) {
            playSound("arc_rainbow_pot");
          } else if (inkFailedOnBlock(state)) {
            playSound("arc_rainbow_bump");
          }
        }
      }
      prev = state;
    },
    stop: () => {},
  };
}

/* ============================== High Seas ============================== */

const WAVES_VOLUME = 0.18;

export function bubbleSounds(): GameSounds<BubState> {
  let prev: BubState | null = null;
  let lastPop = -1e9;
  return {
    frame(state, running) {
      if (running) ensureLoop("arc_sea_waves", WAVES_VOLUME);
      else stopLoop("arc_sea_waves");
      if (prev && state.tick > prev.tick) {
        if (state.queueAt > prev.queueAt) playSound("arc_sea_bubble", 0.7);
        if (state.popped > prev.popped) {
          const now = typeof performance === "undefined" ? 0 : performance.now();
          if (now - lastPop >= 40) {
            lastPop = now;
            playSound("arc_sea_pop", 0.7, 1, true);
          }
        }
        // bubbleRev 2 specials layer their own sound over the pop.
        if ((state.bombs ?? 0) > (prev.bombs ?? 0)) playSound("arc_big_explode", 0.6, 1, true);
        if ((state.lines ?? 0) > (prev.lines ?? 0)) playSound("arc_laser_beam", 0.55, 1.2, true);
        if ((state.jokers ?? 0) > (prev.jokers ?? 0)) playSound("arc_rainbow", 0.6, 1, true);
      }
      prev = state;
    },
    stop: () => stopLoop("arc_sea_waves"),
  };
}

/** Orchard Snip; shared feedback owns the all-ten complete cue. */
export function snipSounds(): GameSounds<SnipState> {
  let prev: SnipState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.cuts > prev.cuts) playSound("arc_rope_cut", 0.8, 1, true);
        // snipRev 3: a springy branch bounce.
        if ((state.springHits ?? 0) > (prev.springHits ?? 0)) playSound("arc_bounce", 0.7);
        const got = (s: SnipState) => s.starGot.reduce((n, g) => n + g, 0);
        const levelChanged = state.endTick !== prev.endTick;
        if (!levelChanged && state.level === prev.level && got(state) > got(prev)) playSound("arc_leaf_collect");
        if (levelChanged) {
          if (state.stars > prev.stars && got(prev) === 0) playSound("arc_leaf_collect");
          if (state.lastOutcome === SNIP_EATEN) playSound("arc_orchard_basket");
          else playSound("arc_orchard_miss");
        }
      }
      prev = state;
    },
    stop: () => {},
  };
}

/** Kitchen Slice: common arcade cues, no nautical ambience or launch sounds. */
export function sliceSounds(): GameSounds<SliceState> {
  let prev: SliceState | null = null;
  let lastCut = -1e9;
  return {
    frame(state) {
      const now = typeof performance === "undefined" ? 0 : performance.now();
      if (prev && state.tick > prev.tick) {
        if (state.slices > prev.slices && now - lastCut >= 60) {
          lastCut = now;
          playSound("arc_knife_slice", 0.8, 1, true);
        }
        if (state.bombsHit > prev.bombsHit) { playSound("arc_crash"); playSound("arc_chilli_bell"); }
        if (state.frenzyFrom.length > prev.frenzyFrom.length) playSound("arc_ketchup");
        if (state.slowFrom.length > prev.slowFrom.length) playSound("arc_mustard");
        // Slice owns its combo cue; slice.tsx passes { combo: false } to arcadeFeedback.
        const combo = state.comboLive ? 1 + state.streak : 0;
        const prevCombo = prev.comboLive ? 1 + prev.streak : 0;
        if (combo > prevCombo && combo > 1) playSound("arc_slice_combo", 0.8);
      }
      prev = state;
    },
    stop: () => {},
  };
}

/** Colour Clash: lane moves and landings read from observed sim state only. */
export function colourClashSounds(): GameSounds<ClashState> {
  let prev: ClashState | null = null;
  return {
    frame(state) {
      if (prev && state.tick > prev.tick) {
        if (state.lane !== prev.lane) playSound("pz_clash_lane", 0.8, 1, true);
        if (state.correct > prev.correct) playSound("pz_clash_right");
        if (state.wrong > prev.wrong) playSound("pz_clash_wrong");
      }
      prev = state;
    },
    stop: () => {},
  };
}
