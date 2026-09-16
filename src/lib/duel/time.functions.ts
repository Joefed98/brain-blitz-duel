import { createServerFn } from "@tanstack/react-start";

/**
 * The shared clock reference. Every phone measures its own offset against this,
 * so a round deadline means the same instant on all of them.
 */
export const serverTimeFn = createServerFn({ method: "GET" }).handler(async () => ({
  now: Date.now(),
}));
