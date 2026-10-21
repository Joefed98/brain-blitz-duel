import { ShareResultButton } from "@/components/share/ShareResultButton";
import { APP_NAME } from "@/lib/brand";
import type { DailyKind } from "@/lib/duel/daily";
import { dailyShareLine, dailyShareLink } from "@/lib/share/dailyShare";

/** A daily's Share (the results and today's board): "I scored 612 on today's Daily Puzzle – can you beat it? <link>". */
export function DailyShareButton({
  kind,
  total,
  className,
}: {
  kind: DailyKind;
  total: number;
  className?: string;
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
    />
  );
}
