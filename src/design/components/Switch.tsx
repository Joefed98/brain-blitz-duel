/**
 * The on/off knob drawn at the right of a switch row (the row itself is the role="switch" button, so
 * the whole row toggles). Decorative: hidden from screen readers.
 */
export function SwitchKnob({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" data-jz="switch" className="jz-switch" data-on={on ? "" : undefined}>
      <span />
    </span>
  );
}
