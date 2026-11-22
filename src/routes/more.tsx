import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * More (phase 2 step 1, 14 Nov 2026) folded into You on 21 Nov 2026 (P1, the polish plan's section 3.2: tabs Home ·
 * Games · Compete · Shop · You). Profile, Friends, Challenges, Badges and Settings are You's (the Profile page,
 * /profile); Leaderboards and the Daily are reached from Compete and Home. The route stays so old links and stored
 * back-state land on You.
 */
export const Route = createFileRoute("/more")({
  beforeLoad: () => {
    throw redirect({ to: "/profile", replace: true });
  },
  component: () => null,
});
