import { Icon, Panel, Row } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";

import { CategoryBoards } from "./LeaderboardScreens";

/**
 * Profile's leaderboards (wave 4, session W4a; docs/leaderboards.md): the way into the rating boards and the Daily top
 * 100, and, for an account, the category boards ("Top Logic players") in the stats area.
 */
export function ProfileBoards({ onOpen }: { onOpen: (to: "/leaderboards" | "/daily-board") => void }) {
  const account = useAccount();
  return (
    <section aria-label="Leaderboards" data-profile-boards className="ap-section">
      <div className="ap-section-head">
        <h2 className="ap-section-title">Leaderboards</h2>
      </div>
      <Panel>
        <Row
          as="button"
          data-open-leaderboards
          leading={<Icon name="leaderboard" size={22} tone="text-3" />}
          title="Leaderboards"
          onClick={() => onOpen("/leaderboards")}
        >
          <Icon name="chevron-right" size={20} tone="text-3" />
        </Row>
        <Row
          as="button"
          data-open-daily-board
          leading={<Icon name="calendar" size={22} tone="text-3" />}
          title="Daily top 100"
          onClick={() => onOpen("/daily-board")}
        >
          <Icon name="chevron-right" size={20} tone="text-3" />
        </Row>
      </Panel>
      {account.kind === "account" ? <CategoryBoards isAccount /> : null}
    </section>
  );
}
