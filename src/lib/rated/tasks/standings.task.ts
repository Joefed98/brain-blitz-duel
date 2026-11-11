/** Cron Trigger task (W3a): the rated standings (ranks, shares, the caps' 3-day grace, tiers), hourly at :23. */
import { defineTask } from "nitro/task";

import { runStandingsTask } from "./ratedTasks.server";

export default defineTask({
  meta: { name: "rated:standings", description: "Rated standings: ranks, shares, caps and tiers" },
  run: () => runStandingsTask(),
});
