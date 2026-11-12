/** Cron Trigger task (W3b): removes Practice deals older than 15 days (mm_purge_practice_deals), daily at 04:37 UTC. */
import { defineTask } from "nitro/task";

import { runPracticeDealsPurge } from "./matchmakingTasks.server";

export default defineTask({
  meta: { name: "rated:practice-deals-purge", description: "Matchmaking: remove Practice deals older than 15 days" },
  run: () => runPracticeDealsPurge(),
});
