/**
 * Per-game sound observers. They read sim state after each frame and play
 * manifest sounds on transitions; they never feed anything back to the sim.
 *
 * Each moment plays its own slot (`<gameId>.<event>`, docs/sound-cues/arcade.md)
 * once that slot has a file, else the shared sound it always played, unchanged.
 */
import { cueHasFile, ensureCueLoop, ensureSlotLoop, playSlotOr, stopCueLoop, stopSlotLoop } from "@/lib/sound";
import { liveCue, momentFrame } from "@/lib/fx/momentCues";
import type { SoundId } from "@/lib/fx/manifest";
import { ORBIT_EIGHT, type OrbitState } from "@/lib/arcade/orbit";
import { CLASH_LANE_EXPAND_TICK, type ClashState } from "@/lib/arcade/colourClash";
import { SWING_CHASE_REACH, SWING_REV, SWING_ROCK_WARN, SWING_ROCK_WARN_V6, SWING_WORLD_W, swingJetAt, type SwingState } from "@/lib/arcade/swing";
import { WAV_CELL, WAV_COLS, WAV_SHIP_H, wavDropPx, wavForm, wavShipY, type WavState } from "@/lib/arcade/wavefront";
import { CROSS_CYCLE_FROM, CROSS_REV2, CROSS_ROADWORKS_FROM, CROSS_ROADWORKS_TWO_FROM, type CrossState } from "@/lib/arcade/cross";
import { FLIP_CRUMBLE_TICKS, flipCrackTick, flipSpeed, type FlipState } from "@/lib/arcade/flip";
import { HOVER_WORLD_W, type HoverPillar, type HoverState } from "@/lib/arcade/hover";
import { snakeStepTicks, type SnakeState } from "@/lib/arcade/snake";
import { BRK_SLIDE_STARTS, brkDestroyed, brkPaddleY, type BrkState } from "@/lib/arcade/breaker";
import { RALLY_BUMPER2_FROM, RALLY_BUMPER_FROM, type RallyState } from "@/lib/arcade/rally";
import { PIN_BALLS, PIN_RUN_TICKS, type PinState } from "@/lib/arcade/pinball";
import type { Pin4State } from "@/lib/arcade/pinball4";
import { BURST_RADIUS, burstCeiling, burstFloorY, type BurstState } from "@/lib/arcade/burst";
import { BEAT_COMBO_TIERS, BEAT_FALL_TICKS, BEAT_JUDGE_PENDING, type BeatState } from "@/lib/arcade/beat";
import { BINTOSS_AIM, BINTOSS_FLY, BINTOSS_NARROW_FROM, BINTOSS_THROWS, BINTOSS_WAIT, type BinTossState } from "@/lib/arcade/binToss";
import type { TiltState } from "@/lib/arcade/tilt";
import { btEventCountdown, type BtCourse, type BtState } from "@/lib/arcade/ballTrack";
import { JUNC_BUILD_EVERY, JUNC_BUILDS, type JuncState } from "@/lib/arcade/junction";
import { skylineFlagAt, skylineGustAt, skylineStreakMult, type SkylineState } from "@/lib/arcade/skyline";
import { INK_LIVE_PRE_CAP, inkIsLive, type InkState } from "@/lib/arcade/inkBridge";
import { inkFailedOnBlock } from "@/lib/arcade/inkBridge.renderer";
import { BULLSEYE_ARROWS, type BullseyeState } from "@/lib/arcade/bullseye";
import type { BubState } from "@/lib/arcade/bubble";
import { SLICE_SPECIAL_NONE, type SliceState } from "@/lib/arcade/slice";
import { SNIP_EATEN, type SnipState } from "@/lib/arcade/snip";
import { arenaLight } from "@/lib/arcade/arenaFills.renderer";

/** Sounds a success-effect cue with a file stands in for on this frame (momentCues.ts). */
let quiet: ReadonlySet<string> = new Set();
/** Start of every observer frame: fire this frame's success-effect cues first. */
function beginFrame(game: string, state: { tick: number }): void {
  quiet = momentFrame(game, state);
}

/** An arcade moment: its own slot's file, else the shared sound (unless a success cue replaces it). */
function sfx(cue: SoundId, fallback: SoundId, volume = 1, rate = 1, overlap = false, keepRate = false): void {
  if (quiet.has(cue)) return;
  playSlotOr(cue, fallback, volume, rate, overlap, keepRate);
}

/** A renderer effect's named cue (liveCue), unless a success cue with a file replaces it this frame. */
function effectCue(cue: string, gapMs = 0, rate?: number): void {
  if (!quiet.has(cue)) liveCue(cue, gapMs, rate);
}

/**
 * Quiet ambient and sustain loops (sound batch 3): one per game, at 0.25–0.35 under the music, faded in
 * over 500 ms while `on` and out when it turns off or the run ends. Silent until the slot has a file.
 */
const LOOP_VOLUME = 0.3;
function loopCue(cue: string, on: boolean, volume = LOOP_VOLUME): void {
  if (on) ensureCueLoop(cue, volume);
  else stopCueLoop(cue);
}

/** A ball (velocities in 1/256 px a tick) that turned back this frame: sideways reversed, or rising turned to falling. */
function turnedBack(before: { vx: number; vy: number } | undefined, after: { vx: number; vy: number }): boolean {
  if (!before) return false;
  return (before.vx !== 0 && after.vx !== 0 && before.vx > 0 !== after.vx > 0) || (before.vy < 0 && after.vy > 0);
}

export interface GameSounds<S> {
  frame: (state: S, running: boolean) => void;
  stop: () => void;
}

const AMBIENCE_VOLUME = 0.22;

export function orbitSounds(): GameSounds<OrbitState> {
  let prev: OrbitState | null = null;
  const announced = new Set<number>();
  return {
    frame(state, running) {
      beginFrame("orbit", state);
      if (running) ensureSlotLoop("orbit.ambience", "arc_space_ambience", AMBIENCE_VOLUME);
      else stopSlotLoop("orbit.ambience", "arc_space_ambience");
      if (prev && state.tick > prev.tick) {
        if (state.releaseTick !== prev.releaseTick && state.flying > 0) sfx("orbit.launch", "arc_thruster");
        if (prev.checkpoint < 0 && state.checkpoint >= 0) sfx("orbit.checkpoint", "arc_pickup");
        if (state.respawnTick !== prev.respawnTick || (state.ended === 2 && prev.ended !== 2)) sfx("orbit.crash", "arc_crash");
        // A planet caught: the bloom and ring; every tenth also sends a shooting star across the sky.
        if (state.captured > prev.captured) {
          if (Math.trunc(state.captured / 10) > Math.trunc(prev.captured / 10)) effectCue("orbit.shootingStar");
          else effectCue("orbit.planetCaught");
        }
        // The first figure-eight planet and the first asteroid belt: a heads-up as the one before is reached.
        for (const at of [state.planets.findIndex((p) => p.kind === ORBIT_EIGHT), state.planets.findIndex((p) => p.hazard >= 0)]) {
          if (at > 0 && !announced.has(at) && prev.cur < at - 1 && state.cur === at - 1) {
            announced.add(at);
            effectCue("orbit.newHazard");
          }
        }
      } else if (prev && state.tick < prev.tick) announced.clear();
      prev = state;
    },
    stop: () => stopSlotLoop("orbit.ambience", "arc_space_ambience"),
  };
}

/** swingRev 4+: the dragon is off the left edge and its arrow has turned red (under 4 m behind), as the renderer draws it. */
function swingDragonNear(s: SwingState): boolean {
  const chase = s.chaseX ?? 0;
  if (s.rev !== SWING_REV || s.ended !== 0 || chase === 0 || chase + SWING_CHASE_REACH - s.camX >= 0) return false;
  return Math.max(0, Math.trunc((s.x - chase - SWING_CHASE_REACH) / (40 * 256))) < 4;
}

export function swingSounds(): GameSounds<SwingState> {
  let prev: SwingState | null = null;
  return {
    frame(state, running) {
      beginFrame("swing", state);
      loopCue("swing.lava", running && state.ended === 0);
      if (prev && state.tick > prev.tick) {
        if (state.ended === 2 && prev.ended !== 2) sfx("swing.crash", "arc_crash");
        else if (prev.rope < 0 && state.rope >= 0) sfx("swing.grapple", "arc_grapple");
        // swingRev 4: a star taken, the dragon appearing, a stalactite starting to shake, a jet erupting.
        if ((state.stars ?? 0) > (prev.stars ?? 0)) sfx("swing.starTaken", "arc_pickup", 0.9);
        if ((state.chaseX ?? 0) !== 0 && (prev.chaseX ?? 0) === 0) sfx("swing.dragon", "arc_siren", 0.6);
        if ((state.rocks ?? []).some((r, i) => r.phase === 1 && prev!.rocks?.[i]?.phase === 0)) sfx("swing.rockShake", "arc_clank", 0.5);
        if ((state.rocks ?? []).some((r, i) => r.phase === 3 && prev!.rocks?.[i]?.phase === 2)) sfx("swing.rockLand", "arc_wood_knock", 0.5);
        if ((state.rocks ?? []).some((r, i) => r.phase === 2 && prev!.rocks?.[i]?.phase === 1)) effectCue("swing.rockFall");
        // The crumble builds (grit, the shadow growing) halfway through a stalactite's warning.
        const half = (state.tuned ? SWING_ROCK_WARN_V6 : SWING_ROCK_WARN) / 2;
        if ((state.rocks ?? []).some((r, i) => r.phase === 1 && r.t >= half && prev!.rocks?.[i]?.phase === 1 && prev!.rocks[i]!.t < half)) effectCue("swing.rockCrumble", 300);
        if (swingDragonNear(state) && !swingDragonNear(prev)) effectCue("swing.dragonNear", 4000);
        // Lava jets (tick-driven, as the renderer draws them): the warning bubbles, then the eruption.
        if (state.ended === 0) {
          // Only jets on screen (the renderer's camera window).
          const jets = (state.jets ?? []).filter((j) => j.x >= state.camX && j.x <= state.camX + SWING_WORLD_W * 256);
          if (jets.some((j) => swingJetAt(j, state.tick).bubbling && !swingJetAt(j, prev!.tick).bubbling)) effectCue("swing.jetBubble", 600);
          if (jets.some((j) => swingJetAt(j, state.tick).h > 0 && swingJetAt(j, prev!.tick).h === 0)) effectCue("swing.jetErupt", 600);
        }
      }
      prev = state;
    },
    stop: () => stopCueLoop("swing.lava"),
  };
}

/** wavefront.ts PITCH_Y: the formation's row pitch (px). */
const WAV_ROW_PITCH = 36;
/** The formation's lowest ship within two drops of the ship line (it ends the run on reaching it). */
function wavDanger(s: WavState): boolean {
  if (s.ended !== 0 || (s.enter ?? 0) > 0) return false;
  const form = wavForm(s);
  let lowest = -1;
  s.shapes.forEach((code, i) => {
    if (code !== 0) lowest = Math.max(lowest, form ? form[i]![1] : Math.trunc(i / WAV_COLS) * WAV_ROW_PITCH);
  });
  return lowest >= 0 && s.fy + lowest + WAV_CELL >= wavShipY(s) - WAV_SHIP_H / 2 - 2 * wavDropPx(s);
}

export function wavefrontSounds(): GameSounds<WavState> {
  let prev: WavState | null = null;
  return {
    frame(state, running) {
      beginFrame("wavefront", state);
      loopCue("wavefront.danger", running && wavDanger(state));
      if (prev && state.tick > prev.tick) {
        if (state.fireIn > prev.fireIn) sfx("wavefront.fire", "arc_blaster", 0.6, 1, true);
        if (state.pierce > prev.pierce) sfx("wavefront.pierce", "arc_retro_pickup");
        // Ships and the armoured ship destroyed this frame (bursts carry the kill tick).
        if (state.bursts.some((b) => b.t > prev!.tick && (b.c === 3 || b.c === 4))) sfx("wavefront.bigExplode", "arc_big_explode", 0.8);
        else if (state.bursts.some((b) => b.t > prev!.tick && b.c !== 3)) sfx("wavefront.shapePop", "arc_shape_pop", 0.7);
        if (state.lives < prev.lives) sfx("wavefront.lifeLost", "arc_lose_life");
        // wavRev 2: a boss hit, the next formation (or the boss) arriving, a ship peeling off to dive.
        if ((state.bossHits ?? 0) > (prev.bossHits ?? 0) && !state.bossKilled) sfx("wavefront.bossHit", "arc_retro_hit", 0.7, 1, true);
        if ((state.enter ?? 0) > 0 && (prev.enter ?? 0) === 0) sfx("wavefront.formation", "stage_complete", 0.8);
        if ((state.divers ?? []).length > (prev.divers ?? []).length) sfx("wavefront.dive", "arc_retro_blip", 0.5, 1, true);
        if (state.saucerDir !== 0 && prev.saucerDir === 0) effectCue("wavefront.saucerEnter");
        // The laser pickup becomes visible when its wait runs out.
        if (state.drop && state.drop.wait <= 0 && (!prev.drop || prev.drop.wait > 0)) effectCue("wavefront.laserDrop");
        // An armour plate knocked off without a kill (no burst is drawn).
        if (state.armourHits > prev.armourHits && !state.bursts.some((b) => b.t > prev!.tick && b.c === 4)) effectCue("wavefront.armourHit");
        if (state.reds.length > prev.reds.length) effectCue("wavefront.enemyFire", 150);
        // The formation marches a step, or drops a row at a wall (the same thump, lower).
        if (state.wave === prev.wave && (state.enter ?? 0) === 0 && (prev.enter ?? 0) === 0) {
          if (state.dir !== prev.dir && state.fy > prev.fy) effectCue("wavefront.rowDrop", 100);
          else if (state.fx !== prev.fx) effectCue("wavefront.march", 100);
        }
      }
      prev = state;
    },
    stop: () => stopCueLoop("wavefront.danger"),
  };
}

/** crossRev 2+: the crossings (0-based) that bring a new layout: the first cycle lane, roadworks, the chicane. */
const CROSS_NEW_LAYOUTS = [CROSS_CYCLE_FROM, CROSS_ROADWORKS_FROM, CROSS_ROADWORKS_TWO_FROM];

export function crossSounds(): GameSounds<CrossState> {
  let prev: CrossState | null = null;
  const announced = new Set<number>();
  return {
    frame(state, running) {
      beginFrame("cross", state);
      loopCue("cross.traffic", running && !state.dead);
      if (prev && state.tick > prev.tick) {
        if (state.lives < prev.lives) sfx("cross.lifeLost", "arc_lose_life");
        else if (state.crossings > prev.crossings) sfx("cross.crossed", "stage_complete");
        else if (state.col !== prev.col || (state.hop > 0 && (prev.hop === 0 || state.hop > prev.hop))) sfx("cross.hop", "arc_honk", 0.6);
        // A new layout's crossing begins (its kerb pause ends).
        const go = prev.tick < state.pauseUntil && state.tick >= state.pauseUntil;
        if (go && (state.rev ?? 0) >= CROSS_REV2 && CROSS_NEW_LAYOUTS.includes(state.crossings) && !announced.has(state.crossings)) {
          announced.add(state.crossings);
          effectCue("cross.newHazard");
        }
      } else if (prev && state.tick < prev.tick) announced.clear();
      prev = state;
    },
    stop: () => stopCueLoop("cross.traffic"),
  };
}

/** flip.ts speeds the tunnel up every 3 s (SPEED_STEP_TICKS). */
const FLIP_STEP_TICKS = 180;

export function flipSounds(): GameSounds<FlipState> {
  let prev: FlipState | null = null;
  return {
    frame(state, running) {
      beginFrame("flip", state);
      void running;
      if (prev && state.tick > prev.tick) {
        if (state.ended === 2 && prev.ended !== 2) sfx("flip.crash", "arc_crash");
        else if (state.flipT > prev.flipT) sfx("flip.flip", "arc_gravity_flip", 0.7);
        if (state.ended === 0) {
          // The tunnel speeds up a step (every 3 s); only every third step is sounded (9, 18, 27, 36, 45 s).
          if (flipSpeed(state.tick) > flipSpeed(prev.tick) && Math.trunc(state.tick / FLIP_STEP_TICKS) % 3 === 0) effectCue("flip.speedUp");
          // A crumble tile first touched starts to crack; FLIP_CRUMBLE_TICKS later it collapses into lava.
          if ((state.cracks?.length ?? 0) > (prev.cracks?.length ?? 0)) effectCue("flip.crackStart");
          const cracks = state.cracks ?? [];
          for (let k = 0; k < cracks.length; k += 2) {
            const at = flipCrackTick(state, cracks[k]!);
            if (at !== null && at + FLIP_CRUMBLE_TICKS > prev.tick && at + FLIP_CRUMBLE_TICKS <= state.tick) {
              effectCue("flip.collapse");
              break;
            }
          }
        }
      }
      prev = state;
    },
    stop: () => {},
  };
}

/* ============================ Retro Arcade world ============================ */

/** Coin once when the run starts; shared by every Retro Arcade game. */
function retroStart(cue: SoundId) {
  let started = false;
  return (running: boolean) => {
    if (running && !started) {
      started = true;
      sfx(cue, "arc_retro_coin");
    }
  };
}

export function hoverSounds(): GameSounds<HoverState> {
  let prev: HoverState | null = null;
  const start = retroStart("hover.start");
  return {
    frame(state, running) {
      beginFrame("hover", state);
      start(running);
      if (prev && state.tick > prev.tick) {
        if (state.crashed && !prev.crashed) sfx("hover.crash", "arc_retro_explode");
        else {
          if (state.gates > prev.gates) sfx("hover.gate", "arc_retro_note");
          // hoverRev 2: a gold star collected.
          if ((state.stars ?? 0) > (prev.stars ?? 0)) sfx("hover.star", "arc_retro_coin", 0.8);
          // hoverRev 2: the first two-gap and the first moving barrier scroll into view.
          if (state.rev) {
            const onScreen = (p: HoverPillar | undefined, distance: number) => !!p && p.x0 - distance <= HOVER_WORLD_W * 256;
            const firsts = [state.pillars.find((p) => p.gap2Top !== undefined), state.pillars.find((p) => p.movePhase !== undefined)];
            if (firsts.some((p) => onScreen(p, state.distance) && !onScreen(p, prev!.distance))) effectCue("hover.newHazard");
          }
        }
      }
      prev = state;
    },
    stop: () => {},
  };
}

/** snake.rockFalling's length: the rock sprite falls in for this long before it lands. */
const SNAKE_ROCK_FALL_TICKS = 48;

export function snakeSounds(): GameSounds<SnakeState> {
  let prev: SnakeState | null = null;
  const start = retroStart("snake.start");
  return {
    frame(state, running) {
      beginFrame("snake", state);
      start(running);
      if (prev && state.tick > prev.tick) {
        if (state.dead && !prev.dead) sfx("snake.dead", "arc_retro_explode");
        else if (state.eaten > prev.eaten) sfx("snake.eat", "arc_retro_blip");
        // snakeRev 2: a rock's shadow appears, then it lands clear of the head.
        else if ((state.rocks?.length ?? 0) > (prev.rocks?.length ?? 0)) sfx("snake.rockLand", "arc_retro_hit", 0.7);
        else if ((state.rockWarn ?? -1) >= 0 && (prev.rockWarn ?? -1) < 0) sfx("snake.rockWarn", "arc_retro_note", 0.5, 0.7);
        // snakeRev 3 meteor shower: a low alarm as the three shadows appear.
        if ((state.showerDone ?? 0) > (prev.showerDone ?? 0)) sfx("snake.showerAlarm", "arc_retro_note", 0.7, 0.5, true);
        // The rock (or the shower) falls in over its last 0.8 s before impact.
        const landings = [(state.rockWarn ?? -1) >= 0 ? state.rockLandTick : undefined, (state.showerWarn?.length ?? 0) > 0 ? state.showerLandTick : undefined];
        if (!state.dead && landings.some((at) => at !== undefined && at - prev!.tick > SNAKE_ROCK_FALL_TICKS && at - state.tick <= SNAKE_ROCK_FALL_TICKS && at > state.tick)) effectCue("snake.rockFalling", 300);
        // A speed step on the 5th, 15th, 25th star (the 10th and 20th have the STREAK banner).
        if (!state.dead && snakeStepTicks(state.eaten) < snakeStepTicks(prev.eaten) && state.eaten % 10 !== 0) effectCue("snake.speedUp");
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
  const start = retroStart("beat.start");
  return {
    frame(state, running) {
      beginFrame("beat", state);
      start(running);
      if (prev && state.tick > prev.tick) {
        // A combo of 10 or more broken: its glow bands vanish (its own file stands in for the miss).
        const broke = prev.combo >= 10 && state.combo < prev.combo;
        if (broke) effectCue("beat.comboLost");
        if (state.misses > prev.misses && !(broke && cueHasFile("beat.comboLost"))) sfx("beat.miss", "arc_retro_hit");
        // beatRev 2+: the first swipe notes come into the lanes.
        const firstSwipe = state.chart.swipes?.findIndex((d) => d !== 0) ?? -1;
        const swipeAt = firstSwipe >= 0 ? state.chart.ticks[firstSwipe]! - BEAT_FALL_TICKS : -1;
        if (swipeAt >= 0 && prev.tick < swipeAt && state.tick >= swipeAt) effectCue("beat.swipeArrive");
        const hits = state.perfect + state.good + state.ok - (prev.perfect + prev.good + prev.ok);
        const heldNew = state.lastJudge === BEAT_JUDGE_PENDING && state.judgeAge === 0;
        // An own file keeps the lane pitch.
        if (hits > 0 || heldNew) sfx("beat.note", "arc_retro_note", 0.8, BEAT_LANE_RATES[Math.max(0, state.lastLane)] ?? 1, true, true);
        // The combo glow steps up a tier (10, 25, 50); 10 and 50 are also every-ten banners (beat.comboTen).
        const tier = (c: number) => BEAT_COMBO_TIERS.filter((t) => c >= t).length;
        if (tier(state.combo) > tier(prev.combo) && state.combo % 10 !== 0) effectCue("beat.comboTier");
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function breakerSounds(): GameSounds<BrkState> {
  let prev: BrkState | null = null;
  const start = retroStart("breaker.start");
  return {
    frame(state, running) {
      beginFrame("breaker", state);
      start(running);
      if (prev && state.tick > prev.tick) {
        if (state.losses > prev.losses) sfx("breaker.ballLost", "arc_retro_explode");
        if (state.powerUps > prev.powerUps) sfx("breaker.powerUp", "arc_retro_pickup");
        // brkRev 2: Fireball lit.
        if ((state.fireballs ?? 0) > (prev.fireballs ?? 0)) sfx("breaker.fireballLit", "arc_retro_coin", 0.8);
        // A brick destroyed bursts into pixels: its own cue stands in for the hit once it has a file.
        const broke = brkDestroyed(state) > brkDestroyed(prev);
        if (broke) effectCue("breaker.brickBreak", 40);
        if (state.hits > prev.hits && !(broke && cueHasFile("breaker.brickBreak"))) sfx("breaker.brickHit", "arc_retro_hit", 0.8, 1, true);
        if (state.capsules.length > prev.capsules.length) effectCue("breaker.capsuleDrop");
        if (!state.fire && prev.fire) effectCue("breaker.fireballOut");
        if (state.pause === 0 && prev.pause > 0 && state.losses === prev.losses) effectCue("breaker.relaunch");
        // brkRev 2+: rows 3 and 7 start sliding (30 s, 60 s).
        if (state.slide && BRK_SLIDE_STARTS.some((at) => prev!.tick < at && state.tick >= at)) effectCue("breaker.rowsSlide");
        // Laser fired: the beam timer jumps to full; one instance per fired ball.
        if (state.beam > prev.beam) sfx("breaker.laser", "arc_laser_beam", 0.8);
        for (let b = 0; b < state.balls.length - prev.balls.length; b++) sfx("breaker.multiball", "arc_multiball", 0.7);
        // Paddle hit: a ball near the paddle that was falling and now rises.
        const paddleHit = state.balls.some((ball, i) => {
          const before = prev!.balls[i];
          return !!before && before.vy > 0 && ball.vy < 0 && ball.y > (brkPaddleY(state) - 40) * 256;
        });
        if (paddleHit) sfx("breaker.paddle", "arc_retro_blip", 0.8, 1, true);
        // A ball off a side wall or the ceiling: turned back with no brick hit and no paddle return.
        else if (state.hits === prev.hits && state.balls.length === prev.balls.length && state.balls.some((ball, i) => turnedBack(prev!.balls[i], ball))) effectCue("breaker.wallBounce");
        // brkRev 9 (the expansion, existing sounds only): a gold brick broken chimes, a bounce off gold clinks,
        // a combo stepping up to ×2 or ×3 rings the pickup a little higher.
        if ((state.goldBroken ?? 0) > (prev.goldBroken ?? 0)) sfx("breaker.fireballLit", "arc_retro_coin", 0.9, 1.25);
        else if ((state.clinks ?? 0) > (prev.clinks ?? 0)) effectCue("breaker.wallBounce", 0, 1.4);
        if ((state.comboUps ?? 0) > (prev.comboUps ?? 0)) sfx("breaker.powerUp", "arc_retro_pickup", 0.7, 1.2);
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function pinballSounds(): GameSounds<PinState> {
  let prev: PinState | null = null;
  const start = retroStart("pinball.start");
  return {
    frame(state, running) {
      beginFrame("pinball", state);
      start(running);
      if (prev && state.tick > prev.tick) {
        // The last ball launched (BALL 3/3); every ball drained before time (its own file stands in for the drain).
        // pinRev 4 plunges a new ball for each lock, so its last ball is the one after the second drain.
        const p4 = state as Partial<Pin4State>;
        const q4 = prev as Partial<Pin4State>;
        if (p4.rev4 ? state.lost === PIN_BALLS - 1 && prev.lost < PIN_BALLS - 1 : state.launched >= PIN_BALLS && prev.launched < PIN_BALLS) effectCue("pinball.lastBall");
        // pinRev 4 (the expansion; existing sounds only): a ramp zaps, a combo crackles, a lock dings,
        // multiball zaps, a jackpot or a skill shot chimes.
        if (p4.rev4) {
          if ((p4.ramps ?? 0) > (q4.ramps ?? 0)) {
            const combo = p4.combo ?? 1;
            if (combo > 1) sfx(`shared.celebrate.crackle${Math.min(3, combo - 1)}` as SoundId, "arc_retro_pickup", 0.9);
            else sfx("shared.celebrate.zap", "arc_retro_pickup", 0.8);
          }
          if ((p4.locksMade ?? 0) > (q4.locksMade ?? 0)) sfx("shared.celebrate.countDing", "tick", 0.9);
          if ((p4.multiballs ?? 0) > (q4.multiballs ?? 0)) sfx("shared.celebrate.zap", "arc_retro_pickup", 1);
          if ((p4.jackpots ?? 0) > (q4.jackpots ?? 0) || (p4.skills ?? 0) > (q4.skills ?? 0)) sfx("shared.celebrate.chime", "correct", 0.9);
        }
        const over = state.lost >= PIN_BALLS && prev.lost < PIN_BALLS && state.tick < PIN_RUN_TICKS;
        if (over) effectCue("pinball.gameOver");
        if (state.lost > prev.lost && !(over && cueHasFile("pinball.gameOver"))) sfx("pinball.ballLost", "arc_retro_explode");
        if (state.live && !prev.live) sfx("pinball.launch", "arc_bounce", 0.8);
        if (state.bumps > prev.bumps) sfx("pinball.bumperHit", "arc_retro_hit", 0.8, 1, true);
        if (state.slings > prev.slings) sfx("pinball.sling", "arc_retro_blip", 0.6, 1.3, true);
        if (state.drops > prev.drops) sfx("pinball.dropTarget", "arc_retro_coin", 0.8, 1, true);
        if (state.banks > prev.banks || state.laneSets > prev.laneSets) sfx("pinball.bankComplete", "arc_retro_pickup");
        else if (state.laneLights > prev.laneLights) sfx("pinball.laneLight", "arc_retro_note", 0.8);
        // The light row under the table (arenaFills.renderer.ts, display only): one lamp a bumper or sling,
        // two a drop target or lit lane, a chase along all five for a bank or the multiplier lanes.
        if (state.banks > prev.banks || state.laneSets > prev.laneSets) arenaLight("pinball", 5);
        else if (state.drops > prev.drops || state.laneLights > prev.laneLights) arenaLight("pinball", 2);
        else if (state.bumps > prev.bumps || state.slings > prev.slings) arenaLight("pinball", 1);
        if (state.spins > prev.spins) sfx("pinball.spinner", "arc_retro_blip", 0.5, 1.6, true);
        // A flipper raised (each side once per press).
        if ((state.held & ~prev.held) !== 0) sfx("pinball.flipper", "arc_retro_blip", 0.7, 0.8, true);
        // A dropped bank pops back up (not a drain, which turns every light off).
        if (prev.targets !== 0 && state.targets === 0 && state.drops === prev.drops && state.lost === prev.lost) effectCue("pinball.bankReset");
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function rallySounds(): GameSounds<RallyState> {
  let prev: RallyState | null = null;
  const start = retroStart("rally.start");
  return {
    frame(state, running) {
      beginFrame("rally", state);
      start(running);
      if (prev && state.tick > prev.tick) {
        if (state.dead && !prev.dead) sfx("rally.dead", "arc_retro_explode");
        if (state.goldHits > prev.goldHits) sfx("rally.goldHit", "arc_retro_note");
        if (state.hits > prev.hits) sfx("rally.hit", "arc_retro_blip");
        // The light row under the court (arenaFills.renderer.ts, display only): one lamp a return, two a
        // gold hit, three a pad, a chase along all five every 10th return.
        const total = (x: RallyState) => x.hits + x.goldHits;
        if (state.hits > prev.hits && state.hits % 10 === 0) arenaLight("rally", 5);
        else if ((state.targetHits ?? 0) > (prev.targetHits ?? 0)) arenaLight("rally", 3);
        else if (state.goldHits > prev.goldHits) arenaLight("rally", 2);
        else if (total(state) > total(prev)) arenaLight("rally", 1);
        if (state.golds.length > prev.golds.length) effectCue("rally.goldEnter");
        // A ball off a side or the far wall (not the paddle, a bumper or a pad).
        const plain = state.hits === prev.hits && state.goldHits === prev.goldHits && (state.bounces ?? 0) === (prev.bounces ?? 0) && (state.targetHits ?? 0) === (prev.targetHits ?? 0);
        if (plain && !state.dead && (turnedBack(prev, state) || (state.golds.length === prev.golds.length && state.golds.some((g, i) => turnedBack(prev!.golds[i], g))))) effectCue("rally.wallBounce");
        // Rev 2+: the BUMPER warning blinks 2 s before a bumper appears, then it is in play.
        const crossed = (at: number) => prev!.tick < at && state.tick >= at;
        if ((state.bumper && crossed(RALLY_BUMPER_FROM - 120)) || (state.bumper2 && crossed(RALLY_BUMPER2_FROM - 120))) effectCue("rally.bumperWarn");
        if ((state.bumper && crossed(RALLY_BUMPER_FROM)) || (state.bumper2 && crossed(RALLY_BUMPER2_FROM))) effectCue("rally.bumperIn");
      }
      prev = state;
    },
    stop: () => {},
  };
}

/** Floor-bounce pitch per atom size (0 is the biggest). */
const BURST_BOUNCE_RATES = [0.7, 0.85, 1.05, 1.25];
function burstTouching(s: BurstState): boolean {
  const ceil = burstCeiling(s.wave, burstFloorY(s));
  return s.balls.some((b) => b.y / 256 - (BURST_RADIUS[b.size] ?? 8) <= ceil + 2);
}

export function burstSounds(): GameSounds<BurstState> {
  let prev: BurstState | null = null;
  const start = retroStart("burst.start");
  return {
    frame(state, running) {
      beginFrame("burst", state);
      start(running);
      if (prev && state.tick > prev.tick) {
        if (state.ended === 2 && prev.ended !== 2) sfx("burst.gameOver", "arc_retro_explode");
        else if (state.lives < prev.lives) sfx("burst.lifeLost", "arc_lose_life");
        if (state.hits > prev.hits) sfx("burst.hit", "arc_retro_hit", 0.8, 1, true);
        if ((state.shield && !prev.shield) || (state.burst && !prev.burst)) sfx("burst.powerUp", "arc_retro_pickup");
        // burstRev 2: a FREEZE icon caught.
        if ((state.freezes ?? 0) > (prev.freezes ?? 0)) sfx("burst.freezeCaught", "arc_retro_coin", 0.8);
        if (state.shots.length > prev.shots.length) sfx("burst.shot", "arc_retro_blip", 0.6, 1, true);
        if (state.icons.length > prev.icons.length) effectCue("burst.iconDrop");
        if (!state.shield && prev.shield && state.lives === prev.lives) effectCue("burst.shieldBreak");
        if (!state.freeze && prev.freeze) effectCue("burst.thaw");
        if (state.wave > prev.wave) effectCue("burst.newWave");
        // The ceiling flashes white as an atom touches it (as the renderer works it out).
        if (burstTouching(state) && !burstTouching(prev)) effectCue("burst.ceilingTouch");
        // An atom bounces off the floor, pitched by its size (the biggest that bounced).
        if (state.hits === prev.hits && state.balls.length === prev.balls.length) {
          let size = -1;
          state.balls.forEach((b, i) => {
            const a = prev!.balls[i];
            if (a && a.size === b.size && a.vy > 0 && b.vy < 0 && (size < 0 || b.size < size)) size = b.size;
          });
          if (size >= 0) effectCue("burst.atomBounce", 0, BURST_BOUNCE_RATES[size] ?? 1);
        }
        if (state.lives === 1 && prev.lives > 1 && state.ended === 0) effectCue("burst.lastLife");
      }
      prev = state;
    },
    stop: () => {},
  };
}

/* ============================== Fairground world ============================= */

/** Sting once when a run finishes perfect; shared by every Fairground game. */
function fairPerfect(cue: SoundId) {
  let played = false;
  return (perfect: boolean) => {
    if (perfect && !played) {
      played = true;
      sfx(cue, "arc_fair_sting");
    }
  };
}

/** The ball now in hand brings something new: the narrower bucket (throw 4), the first spinner or the first trolley. */
function binTossNewHazard(s: BinTossState): boolean {
  const i = s.throwIndex;
  const first = (has: (k: number) => boolean) => has(i) && !Array.from({ length: i }, (_, k) => k).some(has);
  return i === BINTOSS_NARROW_FROM || first((k) => !!s.spinners?.[k]) || first((k) => (s.slides[k]?.amp ?? 0) > 0);
}

export function binTossSounds(): GameSounds<BinTossState> {
  let prev: BinTossState | null = null;
  const perfect = fairPerfect("bintoss.perfect");
  return {
    frame(state) {
      beginFrame("bintoss", state);
      if (prev && state.tick > prev.tick) {
        if (state.baskets > prev.baskets) {
          sfx("bintoss.basket", "arc_fair_bucket");
          if (state.baskets === BINTOSS_THROWS) sfx("bintoss.allBaskets", "arc_fair_bell");
        } else if (state.resolved > prev.resolved) sfx("bintoss.missBounce", "arc_bounce", 0.7);
        if (state.wobbleTick !== prev.wobbleTick && state.wobbleTick > 0) sfx("bintoss.wobble", "arc_bounce", 0.7, 1, true);
        if (state.hooped && !prev.hooped) effectCue("bintoss.hoopGlow");
        if (state.knockTick !== prev.knockTick && (state.knockTick ?? 0) > 0) effectCue("bintoss.spinnerKnock", 100);
        if (prev.phase === BINTOSS_AIM && state.phase === BINTOSS_FLY) effectCue("bintoss.throw");
        if (prev.phase === BINTOSS_WAIT && state.phase === BINTOSS_AIM && binTossNewHazard(state)) effectCue("bintoss.newHazard");
        perfect(state.baskets === BINTOSS_THROWS);
      }
      prev = state;
    },
    stop: () => {},
  };
}

export function bullseyeSounds(): GameSounds<BullseyeState> {
  let prev: BullseyeState | null = null;
  const perfect = fairPerfect("bullseye.perfect");
  return {
    frame(state) {
      beginFrame("bullseye", state);
      if (prev && state.tick > prev.tick) {
        if (state.flightTick > 0 && prev.flightTick === 0) effectCue("bullseye.dartThrow");
        if (prev.flightTick > 0 && state.flightTick === 0 && state.hits.length > 0) {
          sfx("bullseye.thud", "arc_fair_thud");
          if (state.hits[state.hits.length - 1]!.value === 10) sfx("bullseye.bull", "arc_fair_bell");
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
function toyKnock(cue: SoundId) {
  let lastAt = -Infinity;
  return () => {
    const now = typeof performance === "undefined" ? 0 : performance.now();
    if (now - lastAt < KNOCK_GAP_MS) return;
    lastAt = now;
    sfx(cue, "arc_wood_knock", 0.7, 1, true);
  };
}

/** Quiet marble-roll loop while the player's ball moves. */
function toyRoll(cue: SoundId, moving: boolean) {
  if (moving) ensureSlotLoop(cue, "arc_marble_roll", ROLL_VOLUME);
  else stopSlotLoop(cue, "arc_marble_roll");
}

/** Speed (1/256 px a tick) above which a stop against a wall counts as a knock. */
const TILT_KNOCK_SPEED = 100;
const TILT_ROLL_SPEED = 40;

export function tiltSounds(): GameSounds<TiltState> {
  let prev: TiltState | null = null;
  const knock = toyKnock("tilt.knock");
  return {
    frame(state, running) {
      beginFrame("tilt", state);
      toyRoll("tilt.roll", running && Math.abs(state.vx) + Math.abs(state.vy) > TILT_ROLL_SPEED);
      if (prev && state.tick > prev.tick) {
        if (state.caught && !prev.caught) sfx("tilt.caught", "arc_crash");
        else if (state.ended === 2 && prev.ended !== 2) effectCue("tilt.pitFall");
        if (prev.chaser && !state.chaser && !state.caught && state.level === prev.level) effectCue("tilt.chaserFall");
        if (state.mazes > prev.mazes) sfx("tilt.mazeDone", "arc_marble_clink");
        else if ((state.cupped ?? 0) > (prev.cupped ?? 0)) sfx("tilt.cup", "arc_marble_clink", 0.7);
        if ((state.stars ?? 0) > (prev.stars ?? 0)) sfx("tilt.starTaken", "arc_leaf_collect", 0.8);
        // tiltRev 8: a quick star is the star's chime a little higher; a key opens its gate with the latch; a fall
        // into a black hole (the marble goes back to its start) is the old run-ending fall's cue.
        if ((state.quickTaken ?? 0) > (prev.quickTaken ?? 0)) sfx("tilt.starTaken", "arc_leaf_collect", 0.8, 1.25);
        if ((state.keysTaken ?? 0) > (prev.keysTaken ?? 0)) sfx("tilt.gate", "arc_latch");
        if ((state.falls ?? 0) > (prev.falls ?? 0)) effectCue("tilt.pitFall");
        if (state.mazes === prev.mazes && state.level === prev.level) {
          if (state.gate && !prev.gate) sfx("tilt.gate", "arc_latch");
          const hitX = Math.abs(prev.vx) > TILT_KNOCK_SPEED && state.vx === 0;
          const hitY = Math.abs(prev.vy) > TILT_KNOCK_SPEED && state.vy === 0;
          if (hitX || hitY) knock();
        }
      }
      prev = state;
    },
    stop: () => stopSlotLoop("tilt.roll", "arc_marble_roll"),
  };
}

export function ballTrackSounds(course?: BtCourse): GameSounds<BtState> {
  let prev: BtState | null = null;
  return {
    frame(state, running) {
      beginFrame("balltrack", state);
      toyRoll("balltrack.roll", running && state.balls.some((b) => b.cell >= 0));
      if (prev && state.tick > prev.tick) {
        if (state.home > prev.home) sfx("balltrack.marbleHome", "arc_marble_clink");
        if (state.wrong > prev.wrong) sfx("balltrack.wrong", "arc_wood_knock");
        if (state.actions > prev.actions) sfx("balltrack.switch", "arc_latch", 0.8, 1, true);
        if (state.next > prev.next) effectCue("balltrack.release");
        if (state.lost > prev.lost) effectCue("balltrack.lost");
        // The cups slide to new places (relay, then shuffle) and flash.
        if (course && [course.relay.tick, course.shuffle.tick].some((t) => prev!.tick < t && state.tick >= t)) effectCue("balltrack.shuffle");
        // Each step of the hopper's 5-4-3-2-1 before the relay and the shuffle.
        const count = course ? btEventCountdown(course, state.tick) : null;
        if (course && count !== null && count !== btEventCountdown(course, prev.tick)) effectCue("balltrack.countdown");
      }
      prev = state;
    },
    stop: () => stopSlotLoop("balltrack.roll", "arc_marble_roll"),
  };
}

/* ============================== Real World ============================== */

const HORN_GAP_MS = 700;

export function junctionSounds(): GameSounds<JuncState> {
  let prev: JuncState | null = null;
  let hornAt = -Infinity;
  return {
    frame(state) {
      beginFrame("junction", state);
      if (prev && state.tick > prev.tick) {
        if (state.gaveUp > prev.gaveUp) {
          const now = typeof performance === "undefined" ? 0 : performance.now();
          if (now - hornAt >= HORN_GAP_MS) {
            hornAt = now;
            sfx("junction.horn", "arc_horn", 0.6);
          }
        }
        const known = new Set(prev.cars.map((c) => c.id));
        if (state.cars.some((c) => c.amb && !known.has(c.id))) sfx("junction.siren", "arc_siren", 0.5);
        // junctionRev 2: a new road opens; a bus clears the junction.
        if (state.rev && Math.trunc(state.tick / JUNC_BUILD_EVERY) > Math.trunc(prev.tick / JUNC_BUILD_EVERY) && state.tick <= JUNC_BUILDS * JUNC_BUILD_EVERY) sfx("junction.newRoad", "arc_clank", 0.7);
        if ((state.busCleared ?? 0) > (prev.busCleared ?? 0)) sfx("junction.busCleared", "arc_honk", 0.4);
        if (state.ended === 2 && prev.ended === 0) sfx("junction.crash", "arc_crash");
        else if (state.ended === 1 && prev.ended === 0) sfx("junction.complete", "stage_complete");
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
      beginFrame("skyline", state);
      if (prev && state.tick > prev.tick) {
        if (state.blocks.length > prev.blocks.length) {
          sfx("skyline.drop", "arc_clank", 0.8, 1, true);
          if (state.perfectTick === state.tick) sfx("skyline.perfect", "correct");
          // skylineRev 2: a streak bonus drop (3rd perfect in a row or later).
          if ((state.streakPoints ?? 0) > (prev.streakPoints ?? 0)) sfx("skyline.streakDrop", "arc_retro_coin", 0.7);
          // skylineRev 7 (the expansion, existing sounds only): a new streak multiplier tier dings, a gold block
          // landed perfectly chimes, a height milestone zaps.
          if (state.expandRev) {
            if (skylineStreakMult(state.streak ?? 0) > skylineStreakMult(prev.streak ?? 0)) sfx("shared.celebrate.countDing", "tick", 0.8);
            if ((state.golds ?? 0) > (prev.golds ?? 0)) sfx("shared.celebrate.chime", "correct", 0.9);
            if ((state.milestones ?? 0) > (prev.milestones ?? 0)) sfx("shared.celebrate.zap", "arc_retro_pickup", 0.9);
          }
        }
        if (state.missed && !prev.missed) sfx("skyline.miss", "arc_crash");
        else if (skylineGustAt(state, state.tick) !== 0 && skylineGustAt(prev, prev.tick) === 0) effectCue("skyline.gust");
        // The flag streams a second before a gust blows.
        else if (skylineFlagAt(state, state.tick) !== 0 && skylineFlagAt(prev, prev.tick) === 0) effectCue("skyline.gustWarn");
      }
      prev = state;
    },
    stop: () => {},
  };
}

/** Rainbow world; shared run-end feedback supplies the complete cue. */

/** Speed along a line (1/256 px a tick) above which the coin is heard rolling. */
const INK_ROLL_SPEED = 40;

export function inkBridgeSounds(): GameSounds<InkState> {
  let prev: InkState | null = null;
  let armed = -1;
  return {
    frame(state, running) {
      beginFrame("inkbridge", state);
      loopCue("inkbridge.coinRoll", running && !!state.dropping && state.ball.on >= 0 && Math.abs(state.ball.sp) > INK_ROLL_SPEED, 0.25);
      if (prev && state.tick > prev.tick) {
        // Keep one draw sound after the first segment of each stroke.
        if (state.strokeStarts.length > prev.strokeStarts.length) armed = state.strokeStarts[state.strokeStarts.length - 1] ?? -1;
        if (armed >= 0 && state.segs.length > armed) {
          sfx("inkbridge.draw", "arc_rainbow", 0.6);
          armed = -1;
        }
        if (state.flashTick === state.tick || state.flashTick > prev.flashTick) {
          if (state.flashKind === 1) {
            sfx("inkbridge.pot", "arc_rainbow_pot");
          } else if (inkFailedOnBlock(state)) {
            sfx("inkbridge.bump", "arc_rainbow_bump");
          } else if (state.flashKind === 2) effectCue("inkbridge.fail");
        }
        if (state.dropping && !prev.dropping) effectCue("inkbridge.release");
        // The coin lands on a rainbow; the live levels (9–10) begin.
        if (state.dropping && prev.dropping && prev.ball.on < 0 && state.ball.on >= 0) effectCue("inkbridge.coinLand", 150);
        if (inkIsLive(state.level, state.rev) && !inkIsLive(prev.level, prev.rev)) effectCue("inkbridge.liveLevel");
        // The ink meter and pen tip pulse red at the pre-release cap (as the renderer draws it).
        const cap = (INK_LIVE_PRE_CAP - 2) * 256;
        if (!state.dropping && state.preInkUsed >= cap && prev.preInkUsed < cap) effectCue("inkbridge.inkOut");
      }
      prev = state;
    },
    stop: () => stopCueLoop("inkbridge.coinRoll"),
  };
}

/* ============================== High Seas ============================== */

const WAVES_VOLUME = 0.18;

export function bubbleSounds(): GameSounds<BubState> {
  let prev: BubState | null = null;
  let lastPop = -1e9;
  return {
    frame(state, running) {
      beginFrame("bubble", state);
      if (running) ensureSlotLoop("bubble.waves", "arc_sea_waves", WAVES_VOLUME);
      else stopSlotLoop("bubble.waves", "arc_sea_waves");
      if (prev && state.tick > prev.tick) {
        if (state.queueAt > prev.queueAt) sfx("bubble.load", "arc_sea_bubble", 0.7);
        if (state.popped > prev.popped) {
          const now = typeof performance === "undefined" ? 0 : performance.now();
          if (now - lastPop >= 40) {
            lastPop = now;
            sfx("bubble.pop", "arc_sea_pop", 0.7, 1, true);
          }
        }
        // bubbleRev 2 specials layer their own sound over the pop.
        if ((state.bombs ?? 0) > (prev.bombs ?? 0)) sfx("bubble.bomb", "arc_big_explode", 0.6, 1, true);
        if ((state.lines ?? 0) > (prev.lines ?? 0)) sfx("bubble.line", "arc_laser_beam", 0.55, 1.2, true);
        if ((state.jokers ?? 0) > (prev.jokers ?? 0)) sfx("bubble.jokerLand", "arc_rainbow", 0.6, 1, true);
        if (state.descents > prev.descents) effectCue("bubble.descend");
        // 8 or more cleared by one shot sends a rush of bubbles up; the reef reaching the gun ends the run.
        if (state.popped + state.dropped - (prev.popped + prev.dropped) >= 8) effectCue("bubble.rush");
        if (state.dead && !prev.dead) effectCue("bubble.reefLost");
        // A shot that sticks without popping, dropping or setting off a special.
        const special = (s: BubState) => (s.bombs ?? 0) + (s.lines ?? 0) + (s.jokers ?? 0);
        if (state.shots > prev.shots && state.popped === prev.popped && state.dropped === prev.dropped && special(state) === special(prev)) effectCue("bubble.stick");
      }
      prev = state;
    },
    stop: () => stopSlotLoop("bubble.waves", "arc_sea_waves"),
  };
}

/** Orchard Snip; shared feedback owns the all-ten complete cue. */
export function snipSounds(): GameSounds<SnipState> {
  let prev: SnipState | null = null;
  return {
    frame(state) {
      beginFrame("snip", state);
      if (prev && state.tick > prev.tick) {
        if (state.cuts > prev.cuts) sfx("snip.cut", "arc_rope_cut", 0.8, 1, true);
        // snipRev 3: a springy branch bounce.
        if ((state.springHits ?? 0) > (prev.springHits ?? 0)) sfx("snip.springBounce", "arc_bounce", 0.7);
        // snipRev 5: a picker's crook snags the apple (a low, slow bounce: the vine taking it).
        if (state.hookTick !== undefined && state.hookTick !== prev.hookTick) sfx("snip.hook", "arc_bounce", 0.6, 0.7, true);
        const got = (s: SnipState) => s.starGot.reduce((n, g) => n + g, 0);
        const levelChanged = state.endTick !== prev.endTick;
        if (!levelChanged && state.level === prev.level && got(state) > got(prev)) sfx("snip.star", "arc_leaf_collect");
        if (levelChanged) {
          if (state.stars > prev.stars && got(prev) === 0) sfx("snip.star", "arc_leaf_collect");
          if (state.lastOutcome === SNIP_EATEN) sfx("snip.basket", "arc_orchard_basket");
          else sfx("snip.miss", "arc_orchard_miss");
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
      beginFrame("slice", state);
      const now = typeof performance === "undefined" ? 0 : performance.now();
      if (prev && state.tick > prev.tick) {
        if (state.slices > prev.slices && now - lastCut >= 60) {
          lastCut = now;
          sfx("slice.cut", "arc_knife_slice", 0.8, 1, true);
        }
        if (state.bombsHit > prev.bombsHit) { sfx("slice.bomb", "arc_crash"); sfx("slice.bombBell", "arc_chilli_bell"); }
        if (state.frenzyFrom.length > prev.frenzyFrom.length) sfx("slice.frenzyStart", "arc_ketchup");
        if (state.slowFrom.length > prev.slowFrom.length) sfx("slice.slow", "arc_mustard");
        // Slice owns its combo cue; slice.tsx passes { combo: false } to arcadeFeedback.
        const combo = state.comboLive ? 1 + state.streak : 0;
        const prevCombo = prev.comboLive ? 1 + prev.streak : 0;
        if (combo > prevCombo && combo > 1) sfx("slice.comboUp", "arc_slice_combo", 0.8);
        // The combo meter runs out (a chilli ending it has its own sound).
        if (prev.comboLive && !state.comboLive && state.bombsHit === prev.bombsHit) effectCue("slice.comboEnd");
        // Food thrown up, or a chilli launched with its fizzing fuse.
        const thrown = state.objects.filter((o) => o.launchTick > prev!.tick && o.launchTick <= state.tick);
        if (thrown.some((o) => o.bomb)) effectCue("slice.fuse", 150);
        // A special bottle thrown up: its own toss sound stands in for the plain whoosh once it has a file.
        const special = thrown.some((o) => o.special !== SLICE_SPECIAL_NONE);
        if (special) effectCue("slice.specialIn");
        if (thrown.some((o) => !o.bomb) && !(special && cueHasFile("slice.specialIn"))) effectCue("slice.toss");
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
      beginFrame("stroop", state);
      if (prev && state.tick > prev.tick) {
        if (state.lane !== prev.lane) sfx("stroop.lane", "pz_clash_lane", 0.8, 1, true);
        if (state.correct > prev.correct) sfx("stroop.right", "pz_clash_right");
        if (state.wrong > prev.wrong) sfx("stroop.wrong", "pz_clash_wrong");
        if (state.dropping && !prev.dropping) effectCue("stroop.drop", 80);
        // Every 15 s the rule banner flashes and the gates reshuffle; at 30 s a lane is added too.
        if (!state.ended && !state.finishTick && Math.trunc(state.tick / 900) > Math.trunc(prev.tick / 900)) {
          if (prev.tick < CLASH_LANE_EXPAND_TICK && state.tick >= CLASH_LANE_EXPAND_TICK) effectCue("stroop.lanesGrow");
          else effectCue("stroop.ruleFlash");
        }
      }
      prev = state;
    },
    stop: () => {},
  };
}
