/** Cron Trigger task (B2): B1's friend events not yet sent, every 5 minutes (pushTasks.server.ts). */
import { defineTask } from "nitro/task";

import { runFriendSweepTask } from "./pushTasks.server";

export default defineTask({
  meta: { name: "push:friend-sweep", description: "Send phone notifications for friend events not yet sent" },
  run: () => runFriendSweepTask(),
});
