/**
 * The draft timeline (scoring standard, docs/scoring-standard.md): how the server learns when each part of a
 * puzzle was done, for the unfinished score's "how early" extras.
 *
 * Every puzzle stage already reports its answer-so-far (the draft the room sends at the buzzer) after each
 * change. On a puzzle stamped for a standard game that times its parts (`standardTimesParts`), the stage wrapper
 * (FeedbackStage) records each change as an edit with its round-clock time and appends the record to the answer
 * it hands on, after TIMELINE_MARK. The server splits it off before grading (the stored answer is the plain
 * answer), rebuilds every intermediate draft and asks the game when each part counted.
 *
 * Format: TIMELINE_MARK + JSON array of [t, keep, cut, insert]: `t` the round-clock ms of the change (ms since the
 * puzzle phase started; the first entry absolute, every later one the gap from the one before), `keep` the
 * characters kept from the start of the previous draft, `cut` the characters kept from its end, `insert` the text
 * between them. The first entry edits the empty draft.
 *
 * The times are the phone's word, as every tap time is: the server holds them to the round and to its receipt
 * time, and a timeline that does not rebuild the answer it came with is ignored (no early extras, nothing else
 * changes). Shared by phone and server, pure.
 */

export const TIMELINE_MARK = "\u001etl1:";
/** Most entries kept; later changes fold into the last entry, so the final draft is always exact. */
export const TIMELINE_MAX_ENTRIES = 600;
/** Characters of timeline the server reads at most. */
export const TIMELINE_MAX_CHARS = 24_000;

export type TimelineEntry = [t: number, keep: number, cut: number, insert: string];

/** One draft at a round-clock time. */
export interface TimedDraft {
  t: number;
  draft: string;
}

/** The edit that turns `from` into `to`. */
export function draftEdit(from: string, to: string): [keep: number, cut: number, insert: string] {
  const max = Math.min(from.length, to.length);
  let keep = 0;
  while (keep < max && from.charCodeAt(keep) === to.charCodeAt(keep)) keep++;
  let cut = 0;
  while (cut < max - keep && from.charCodeAt(from.length - 1 - cut) === to.charCodeAt(to.length - 1 - cut)) cut++;
  return [keep, cut, to.slice(keep, to.length - cut)];
}

export function applyEdit(from: string, keep: number, cut: number, insert: string): string | null {
  if (!Number.isInteger(keep) || !Number.isInteger(cut) || keep < 0 || cut < 0 || keep + cut > from.length) return null;
  return from.slice(0, keep) + insert + from.slice(from.length - cut);
}

/** The phone's recorder for one round: the drafts it has seen and when. */
export class TimelineRecorder {
  private drafts: TimedDraft[] = [];

  /** Records a draft at round-clock time `t` (an unchanged draft records nothing). */
  note(draft: string, t: number): void {
    const last = this.drafts[this.drafts.length - 1];
    if (last && last.draft === draft) return;
    const time = Math.max(last ? last.t : 0, Math.round(Number.isFinite(t) ? t : 0));
    if (this.drafts.length >= TIMELINE_MAX_ENTRIES) this.drafts[this.drafts.length - 1] = { t: time, draft };
    else this.drafts.push({ t: time, draft });
  }

  get size(): number {
    return this.drafts.length;
  }

  /** The answer with its timeline (an empty answer stays empty: nothing was done). */
  attach(answer: string): string {
    if (!answer || this.drafts.length === 0) return answer;
    return answer + encodeTimeline(this.drafts);
  }
}

export function encodeTimeline(drafts: readonly TimedDraft[]): string {
  const entries: TimelineEntry[] = [];
  let prev = "";
  let prevT = 0;
  drafts.forEach((d, i) => {
    const [keep, cut, insert] = draftEdit(prev, d.draft);
    entries.push([i === 0 ? d.t : d.t - prevT, keep, cut, insert]);
    prev = d.draft;
    prevT = d.t;
  });
  return TIMELINE_MARK + JSON.stringify(entries);
}

/** Splits an answer into the plain answer and its timeline text (null when it carries none). */
export function splitTimeline(answer: string): { body: string; timeline: string | null } {
  if (typeof answer !== "string") return { body: "", timeline: null };
  const at = answer.lastIndexOf(TIMELINE_MARK);
  if (at < 0) return { body: answer, timeline: null };
  return { body: answer.slice(0, at), timeline: answer.slice(at + TIMELINE_MARK.length) };
}

/** The plain answer without any timeline (for anything that reads a draft on the phone). */
export function stripTimeline(answer: string): string {
  return splitTimeline(answer).body;
}

/**
 * The drafts a timeline describes, held to [0, latestMs] and to rising times; null when it is unreadable, too long or
 * does not end on `body` (then no part has a known time).
 */
export function decodeTimeline(text: string | null, body: string, latestMs: number): TimedDraft[] | null {
  if (text === null || text.length > TIMELINE_MAX_CHARS) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > TIMELINE_MAX_ENTRIES) return null;
  const out: TimedDraft[] = [];
  let draft = "";
  let t = 0;
  for (let i = 0; i < raw.length; i++) {
    const e = raw[i] as unknown;
    if (!Array.isArray(e) || e.length !== 4) return null;
    const [dt, keep, cut, insert] = e as [unknown, unknown, unknown, unknown];
    if (typeof dt !== "number" || !Number.isFinite(dt) || dt < 0 || typeof keep !== "number" || typeof cut !== "number" || typeof insert !== "string") return null;
    t = i === 0 ? dt : t + dt;
    const next = applyEdit(draft, keep, cut, insert);
    if (next === null) return null;
    draft = next;
    out.push({ t: Math.min(Math.round(t), Math.max(0, latestMs)), draft });
  }
  return draft === body ? out : null;
}

/**
 * When each part counted: given the number of parts each draft holds (in time order), the time after which the
 * count never again fell below k, for k = 1 … the final count. Parts the timeline never shows get null.
 */
export function partTimes(counts: readonly { t: number; parts: number }[], finalParts: number): (number | null)[] {
  const times: (number | null)[] = [];
  for (let k = 1; k <= finalParts; k++) {
    let at: number | null = null;
    for (let i = counts.length - 1; i >= 0; i--) {
      if (counts[i]!.parts >= k) at = counts[i]!.t;
      else break;
    }
    times.push(at);
  }
  return times;
}
