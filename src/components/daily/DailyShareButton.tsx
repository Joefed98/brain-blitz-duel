import { ShareResultButton } from "@/components/share/ShareResultButton";
import { APP_NAME } from "@/lib/brand";
import type { DailyKind } from "@/lib/duel/daily";
import { dailyShareLine, dailyShareLink } from "@/lib/share/dailyShare";
import { sendShareEvent, type ShareRecorder } from "@/lib/share/shareRef";

/**
 * A daily's Share (the results and today's board): "I scored 612 on today's Daily Puzzle – can you
 * beat it? <link>". Each tap is counted with its source (share_events, source daily).
 */
export function DailyShareButton({
  kind,
  total,
  className,
  record = sendShareEvent,
}: {
  kind: DailyKind;
  total: number;
  className?: string;
  record?: ShareRecorder;
}) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <ShareResultButton
      className={className}
      linkPrefix=""
      input={{
        title: `${APP_NAME} daily`,
        lines: [dailyShareLine(kind, total)],
        link: dailyShareLink(origin, kind),
      }}
      onTap={(method) => record({ event: "share_tap", source: "daily", dailyKind: kind, method })}
    />
  );
}
