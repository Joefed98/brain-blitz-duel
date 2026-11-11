/**
 * Friends: the server functions the screens call (wave 2 B1; docs/friends.md). A thin shell over friends.server.ts on
 * the service-role client; the caller is always the signed-in auth user (requireSupabaseAuth), never an id the phone
 * names for itself.
 *
 *   friendsOverviewFn()                                   the Friends list
 *   friendsWaitingFn()                                    the badge's count
 *   friendProfileFn({ playerId })                         a player's profile as the caller sees it
 *   friendSearchFn({ query })                             adults only; never an under-18 account
 *   friendRequestFn({ playerId })                         a request to a player found by search
 *   friendLinkRequestFn({ token })                        a request through an invite link (everyone)
 *   friendRespondFn({ requestId, accept })               accept or decline
 *   friendRemoveFn / friendBlockFn / friendUnblockFn({ playerId })
 *   friendReportFn({ playerId, reason })                 wave 1's report flow, from a profile
 *   friendInviteFn({ playerId })                          invite a friend to the caller's open lobby
 *   friendChallengeFn({ playerId, code })                send the caller's own challenge to a friend
 *   friendLinkFn({ reset })                               the caller's invite link
 *   friendLinkOwnerFn({ token })                          whose link it is (guests too)
 *   friendShowOnlineFn({ show })                          "Show when I'm online" (null: the default)
 *   friendBeatFn({ activity })                            the app's heartbeat
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function setup() {
  const { adminDb } = await import("@/lib/data/db.server");
  return { client: await adminDb(), friends: await import("./friends.server") };
}

export const friendsOverviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { client, friends } = await setup();
    return friends.overview(client, context.userId);
  });

export const friendsWaitingFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    const { client, friends } = await setup();
    return friends.waitingCount(client, context.userId);
  });

export const friendProfileFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playerId: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.profile(client, context.userId, data?.playerId);
  });

export const friendSearchFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.search(client, context.userId, data?.query);
  });

export const friendRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playerId: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.requestById(client, context.userId, data?.playerId);
  });

export const friendLinkRequestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.requestByLink(client, context.userId, data?.token);
  });

export const friendRespondFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { requestId: string; accept: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.respond(client, context.userId, data?.requestId, data?.accept);
  });

export const friendRemoveFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playerId: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.remove(client, context.userId, data?.playerId);
  });

export const friendBlockFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playerId: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.block(client, context.userId, data?.playerId);
  });

export const friendUnblockFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playerId: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.unblock(client, context.userId, data?.playerId);
  });

export const friendReportFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playerId: string; reason: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.report(client, context.userId, data?.playerId, data?.reason);
  });

export const friendInviteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playerId: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.inviteFriendToRoom(client, context.userId, data?.playerId);
  });

export const friendChallengeFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { playerId: string; code: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.sendChallenge(client, context.userId, data?.playerId, data?.code);
  });

export const friendLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reset?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.myLink(client, context.userId, data?.reset === true);
  });

export const friendLinkOwnerFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.linkOwner(client, context.userId, data?.token);
  });

export const friendShowOnlineFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { show: boolean | null }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.setShowOnline(client, context.userId, data?.show ?? null);
  });

export const friendBeatFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { activity: "app" | "practice" }) => input)
  .handler(async ({ data, context }) => {
    const { client, friends } = await setup();
    return friends.beat(client, context.userId, data?.activity);
  });
