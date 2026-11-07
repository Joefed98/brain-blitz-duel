import { Icon } from "@/design/components";

/**
 * The small clock on a score the server hasn't confirmed yet (offline practice): the Joulz `timer`, at its old
 * size (14 px by default, set inline over the smallest allowed icon, as the icon swap does for small slots).
 */
export function PendingClock({ className = "of-clock", px = 14 }: { className?: string; px?: 14 | 24 }) {
  return (
    <Icon
      name="timer"
      size={px === 24 ? 24 : 18}
      label="Pending"
      data-pending-clock
      className={className}
      {...(px === 24 ? {} : { style: { width: px, height: px } })}
    />
  );
}
