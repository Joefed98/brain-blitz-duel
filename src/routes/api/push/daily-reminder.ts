/**
 * POST /api/push/daily-reminder (wave 2 train B, session B2; docs/push-notifications.md): the evening Daily streak
 * reminder, run by GitHub's push-reminder workflow (twice each evening, so one run lands in 19:00–20:59 UK time
 * whether it's GMT or BST; a run outside the window does nothing, and each player is reminded at most once a UK day).
 * Needs `Authorization: Bearer <PUSH_CRON_SECRET>`. Answers counts only, never who.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/push/daily-reminder")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { cronAuthorised } = await import("@/lib/push/cronAuth.server");
        if (!(await cronAuthorised(request.headers.get("authorization")))) return new Response("Unauthorized", { status: 401 });
        const { adminDb } = await import("@/lib/data/db.server");
        const { runDailyStreakReminders } = await import("@/lib/push/notify.server");
        const run = await runDailyStreakReminders(await adminDb());
        return Response.json(run);
      },
    },
  },
});
