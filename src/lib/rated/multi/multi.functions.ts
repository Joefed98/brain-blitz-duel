/**
 * The phone's calls for rated 4- and 8-player matches (wave 3, session W3d). Both read the switches on the server:
 * the picker shows only the sizes switched on (`ratedMultiSizesFn`), and a queue request for a size that is off is
 * refused (`joinRatedMultiQueueFn`, multi.server.ts `joinMultiQueue`), whatever the phone sends.
 */
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ratedMultiSizesFn = createServerFn({ method: "GET" }).handler(async () => {
  const { multiSizesOn } = await import("./multi.server");
  return { sizes: multiSizesOn() };
});

export const joinRatedMultiQueueFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { size: number; choice?: string }) => input)
  .handler(async ({ data, context }) => {
    const { joinMultiQueue } = await import("./multi.server");
    return joinMultiQueue({ playerId: context.userId, size: data?.size, choice: data?.choice });
  });
