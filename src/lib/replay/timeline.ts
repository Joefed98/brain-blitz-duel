/**
 * A seekable timeline over one stored round (display only). The first pass
 * steps the stored run from the start and keeps a copy of the state every
 * KEYFRAME_EVERY ticks, so any later jump costs at most that many sim steps.
 * The pass can run in slices (scanSome) so it never holds up a frame; the
 * states it produces are the stepper's own, so a seek reaches exactly the
 * state the server replay had on that tick.
 */
import type { ReplayStepper } from "./steppers";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const KEYFRAME_EVERY = 60;

const copy = <S>(state: S): S =>
  typeof structuredClone === "function"
    ? structuredClone(state)
    : (JSON.parse(JSON.stringify(state)) as S);

export type TickObserver<S> = (state: S, tick: number, previous: S) => void;

export class ReplayTimeline<S = any> {
  readonly stepper: ReplayStepper<S>;
  private keyframes = new Map<number, S>();
  private scanState: S;
  private scanTick = 0;
  private done = false;
  /** The tick the run ended on (known once the scan has finished; until then the stepper's last tick). */
  endTick: number;
  finalScore: number | null = null;
  private cursorState: S;
  private cursorTick = 0;

  constructor(
    stepper: ReplayStepper<S>,
    private readonly observe?: TickObserver<S>,
  ) {
    this.stepper = stepper;
    this.scanState = stepper.init();
    this.keyframes.set(0, copy(this.scanState));
    this.endTick = stepper.lastTick;
    this.cursorState = copy(this.scanState);
  }

  get scanned(): boolean {
    return this.done;
  }

  get scanProgress(): number {
    return this.done ? 1 : this.scanTick / Math.max(1, this.stepper.lastTick);
  }

  /** Steps the first pass by up to `ticks`; returns true once the whole run is scanned. */
  scanSome(ticks: number): boolean {
    const { stepper } = this;
    for (let i = 0; i < ticks && !this.done; i++) {
      const tick = this.scanTick + 1;
      const previous = this.scanState;
      this.scanState = stepper.step(previous, tick);
      this.scanTick = tick;
      this.observe?.(this.scanState, tick, previous);
      if (tick % KEYFRAME_EVERY === 0) this.keyframes.set(tick, copy(this.scanState));
      if (stepper.isOver(this.scanState) || tick >= stepper.lastTick) {
        this.done = true;
        this.endTick = tick;
        this.finalScore = stepper.score(this.scanState);
        this.keyframes.set(tick, copy(this.scanState));
      }
    }
    return this.done;
  }

  scanAll(): void {
    while (!this.scanSome(10_000)) {
      /* keep stepping */
    }
  }

  /** The state after `tick` ticks (0 = the start), clamped to the run. */
  stateAt(tick: number): S {
    const target = Math.max(
      0,
      Math.min(Math.trunc(tick), this.done ? this.endTick : this.scanTick),
    );
    if (target === this.cursorTick) return this.cursorState;
    if (target > this.cursorTick && target - this.cursorTick <= KEYFRAME_EVERY) {
      this.advanceCursor(target);
      return this.cursorState;
    }
    const base = Math.floor(target / KEYFRAME_EVERY) * KEYFRAME_EVERY;
    const from =
      this.keyframes.get(target) !== undefined
        ? target
        : this.keyframes.get(base) !== undefined
          ? base
          : 0;
    this.cursorState = copy(this.keyframes.get(from)!);
    this.cursorTick = from;
    this.advanceCursor(target);
    return this.cursorState;
  }

  private advanceCursor(target: number): void {
    while (this.cursorTick < target) {
      const tick = this.cursorTick + 1;
      this.cursorState = this.stepper.step(this.cursorState, tick);
      this.cursorTick = tick;
    }
  }
}
