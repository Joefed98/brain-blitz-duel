/** Cron Trigger task (W4a): the leaderboards' refresh, every 5 minutes (the same as pg_cron's `leaderboards-refresh`). */
import { defineTask } from "nitro/task";

import { runLeaderboardRefreshTask } from "./refreshTask.server";

export default defineTask({
  meta: { name: "leaderboards:refresh", description: "Leaderboards: refresh the rating boards and the Daily boards" },
  run: () => runLeaderboardRefreshTask(),
});
