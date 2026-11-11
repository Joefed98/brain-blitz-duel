/** Cron Trigger task (W4b): the tournaments' tick, every 5 minutes (tournamentsTick.server.ts). */
import { defineTask } from "nitro/task";

import { runTournamentsTickTask } from "./tournamentsTick.server";

export default defineTask({
  meta: { name: "tournaments:tick", description: "Starts, calls off, finishes and pays tournaments; sends reminders" },
  run: () => runTournamentsTickTask(),
});
