import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * The Play page (phase 2 step 3, 14 Nov 2026) folded into Home on 21 Nov 2026 (P1, the polish plan's section 3.2): the
 * player banner (Find a match, or Play now on the game of the day), the two Dailies and Play friends are Home's, and
 * the floating Play bar that opened this page is gone. The route stays so old links land on Home.
 */
export const Route = createFileRoute("/play")({
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
  component: () => null,
});
