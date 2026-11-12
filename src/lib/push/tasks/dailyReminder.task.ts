/** Cron Trigger task (B2): the Daily streak reminder, hourly at :41, acting 19:00–20:59 UK (pushTasks.server.ts). */
import { defineTask } from "nitro/task";

import { runDailyReminderTask } from "./pushTasks.server";

export default defineTask({
  meta: { name: "push:daily-reminder", description: "The evening Daily streak reminder" },
  run: () => runDailyReminderTask(),
});
