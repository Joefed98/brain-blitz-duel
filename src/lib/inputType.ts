/**
 * The input type a result was played with (31 Oct 2026, recording only; docs/desktop-layout.md): "touch",
 * "mouse", "keyboard" or a mix ("mouse+keyboard"), sent with every room, daily / challenge and practice
 * answer and stored beside the result (`input_type`), so leaderboards can be split by device later. It
 * never reaches grading or scoring and nothing reads it in the app.
 *
 * The phone side: a round's stage calls resetInputTypes() as it mounts (FeedbackStage); from then on the
 * first pointer press of each kind and any game key (a trusted key outside a text field, no Ctrl / Alt /
 * Cmd) is noted; the submit paths send currentInputType().
 */
export const INPUT_TYPES = ["touch", "mouse", "keyboard"] as const;
export type InputTypePart = (typeof INPUT_TYPES)[number];

let used = new Set<InputTypePart>();
let installed = false;

function typing(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(
      target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"),
    )
  );
}

function install(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener(
    "pointerdown",
    (event) => {
      used.add(event.pointerType === "mouse" ? "mouse" : "touch");
    },
    { capture: true, passive: true },
  );
  window.addEventListener(
    "keydown",
    (event) => {
      if (
        !event.isTrusted ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        typing(event.target)
      )
        return;
      if (["Shift", "Control", "Alt", "Meta", "Tab", "Escape"].includes(event.key)) return;
      used.add("keyboard");
    },
    { capture: true, passive: true },
  );
}

/** A new round's stage is up: start noting afresh. */
export function resetInputTypes(): void {
  install();
  used = new Set();
}

/** What this round was played with so far ("mouse+keyboard"), or undefined when nothing was pressed. */
export function currentInputType(): string | undefined {
  const parts = INPUT_TYPES.filter((t) => used.has(t));
  return parts.length ? parts.join("+") : undefined;
}

/** Server side: a sent value cleaned to known parts in a fixed order, or null. */
export function normaliseInputType(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const parts = new Set(value.split("+"));
  const kept = INPUT_TYPES.filter((t) => parts.has(t));
  return kept.length ? kept.join("+") : null;
}

/** The submit payload's field: `{ inputType }` once anything was pressed, else nothing (older servers ignore it). */
export function inputTypeField(): { inputType?: string } {
  const value = currentInputType();
  return value ? { inputType: value } : {};
}
