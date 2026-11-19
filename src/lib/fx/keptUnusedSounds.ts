/**
 * Joe's recordings kept in public/sounds/ but played by no slot (Joe's bring-back, 19 Nov 2026;
 * docs/sound-cues/sounds-bring-back.md): he chose the sound each slot played before #453, and kept these so any of them
 * can be switched back later. sound-manifest-check and offline-media-refresh-check accept an unused file only if it is
 * listed here; the offline worker (src/lib/offline/swPlugin.ts) leaves every listed file out of the download.
 * Changed with Joe's approval, 19 Nov 2026.
 */
export interface KeptUnusedSound {
  /** The file in public/sounds/. */
  file: string;
  /** The slot it was recorded for. */
  slot: string;
  note: string;
}

const NOTE = "Joe kept the old sound, 19 Nov 2026";
/** An entry: the file, its slot (the file's name less .mp3) and the note. */
const kept = (file: string): KeptUnusedSound => ({ file, slot: file.replace(/\.mp3$/, ""), note: NOTE });

export const KEPT_UNUSED_SOUNDS: readonly KeptUnusedSound[] = [
  kept("balance.select.mp3"),
  kept("balance.solve.mp3"),
  kept("balltrack.marbleHome.mp3"),
  kept("blockparty.place.mp3"),
  kept("blockparty.reset.mp3"),
  kept("bomb.defuse.mp3"),
  kept("breaker.ballLost.mp3"),
  kept("breaker.brickHit.mp3"),
  kept("breaker.fireballLit.mp3"),
  kept("breaker.laser.mp3"),
  kept("breaker.multiball.mp3"),
  kept("breaker.paddle.mp3"),
  kept("breaker.powerUp.mp3"),
  kept("bridges.snapBack.mp3"),
  kept("bubble.load.mp3"),
  kept("bubble.pop.mp3"),
  kept("burst.hit.mp3"),
  kept("burst.lifeLost.mp3"),
  kept("burst.powerUp.mp3"),
  kept("burst.shot.mp3"),
  kept("chain.reshuffle.mp3"),
  kept("checkout.undo.mp3"),
  kept("clayshoot.goldShatter.mp3"),
  kept("cross.jetPuff.mp3"),
  kept("curling.aw.mp3"),
  kept("curling.clack.mp3"),
  kept("curling.countTick.mp3"),
  kept("fences.over.mp3"),
  kept("fillomino.erase.mp3"),
  kept("fillomino.undo.mp3"),
  kept("flip.crash.mp3"),
  kept("flip.flipDown.mp3"),
  kept("flip.flipUp.mp3"),
  kept("flow.cut.mp3"),
  kept("flow.draw.mp3"),
  kept("gravity.boardClear.mp3"),
  kept("inkbridge.bump.mp3"),
  kept("inkbridge.pot.mp3"),
  kept("matchup.chestHome.mp3"),
  kept("measure.near.mp3"),
  kept("measure.target.mp3"),
  kept("minesweeper.clear.mp3"),
  kept("minigolf.loop.mp3"),
  kept("minigolf.putt.mp3"),
  kept("minigolf.sand.mp3"),
  kept("numhunt.shuffle.mp3"),
  kept("numline.bullseye.mp3"),
  kept("numline.dragTick.mp3"),
  kept("numpyramid.swap.mp3"),
  kept("orbit.crash.mp3"),
  kept("orbit.launch.mp3"),
  kept("pinball.multiballStart.mp3"),
  kept("pipes.flow.mp3"),
  kept("push.stuck.mp3"),
  kept("pyramid.undo.mp3"),
  kept("racing.kerb.mp3"),
  kept("rally.edgeSave.mp3"),
  kept("rally.hit.mp3"),
  kept("reaction.bar.mp3"),
  kept("safe.solve.mp3"),
  kept("skyline.drop.mp3"),
  kept("skyline.perfect.mp3"),
  kept("swing.crash.mp3"),
  kept("swing.grapple.mp3"),
  kept("swing.rockLand.mp3"),
  kept("swing.rockShake.mp3"),
  kept("swing.streak.mp3"),
  kept("target.lock.mp3"),
  kept("target.reset.mp3"),
  kept("target.select.mp3"),
  kept("target.undo.mp3"),
  kept("tilt.cup.mp3"),
  kept("tilt.gate.mp3"),
  kept("unblock.laneClear.mp3"),
  kept("unblock.slide.mp3"),
  kept("unblock.slideLong.mp3"),
  kept("whack.bonk.mp3"),
];

/** Each listed file's URL (`/sounds/<file>`). */
export const KEPT_UNUSED_URLS: ReadonlySet<string> = new Set(KEPT_UNUSED_SOUNDS.map((s) => `/sounds/${s.file}`));
