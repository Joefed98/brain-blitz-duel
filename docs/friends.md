# Friends

Wave 2, train B, session B1 (11 Nov 2026). Players add friends, see when they're about and jump into a game together,
safely for under-18s. Mockups: `docs/art/wave-2/screens/friends-1-list.png` … `friends-4-options.png`. No gameplay,
scoring, stamp, timing or room-flow change beyond Invite to room.

## Files

| Piece | File |
| --- | --- |
| Migration: tables, RLS, the server functions, `room_reports.duel_id` nullable | `supabase/migrations/20261111230000_friends.sql` |
| Migration: four analytics events | `supabase/migrations/20261111230100_analytics_friend_events.sql` |
| Data layer (one call per function) | `src/lib/data/friends.server.ts` |
| Server rules, limits, analytics | `src/lib/friends/friends.server.ts` |
| Server functions | `src/lib/friends/friends.functions.ts` |
| Shared numbers and words (cap, tokens, status lines) | `src/lib/friends/friends.ts` |
| Phone calls, badge, pending invite, heartbeat | `src/lib/friends/friendsApi.ts`, `src/components/friends/FriendsPresence.tsx` |
| A challenge made for a friend | `src/lib/friends/challengeFriend.ts`, `src/routes/challenge.tsx` (`?friend=`) |
| Screens | `src/routes/friends.tsx`, `src/components/friends/FriendsScreens.tsx`, `src/polish-layout/friends.css` |
| Entry point | Profile's Friends button (`src/components/identity/ProfileCard.tsx`) with the waiting badge |
| Chat policy (friends type) | `src/lib/safety/chatPolicy.ts` |
| Checks | `scripts/friends-check.ts` (PostgreSQL, ~5 s), `scripts/friends-ui-check.tsx` (happy-dom, ~3 s); the screens in theme-check and no-wrap-check (`FRIENDS_SCREENS`) |

## Rules

- **Accounts only.** Every table refers to `public.profiles`; a guest tapping Friends gets the save-your-progress
  sheet, and `/friends` shows them the "needs an account" gate. An account's removal (`accounts.forget_user`) takes
  every friends row with it (ON DELETE CASCADE); an account waiting for deletion is hidden at once.
- **Search** (`friends_search`): only adults (18+ on the UK calendar day) search, by a prefix of the username,
  ignoring capitals, 10 results. It never returns an under-18 account, the caller, an account waiting for deletion or
  anyone blocked either way. A request "via search" is refused (as not found) unless both players are adults.
- **Invite links**: everyone has one (`/friends?invite=<12 letters>`, on `APP_URL`), under-18s included, and anyone
  with an account may use one. A guest who opens a link sees whose it is and goes through sign-up; the token is kept
  on the device (`duelz-friend-invite:v1`, a week) and the request is sent when they land on Friends with an account.
  Reset link makes a new token; the old one stops working at once. No QR codes (decided 10 Nov).
- **Requests** arrive under Requests with Accept and Decline. A decline is never told: the sender still reads
  "Request sent", and a repeat from them within 30 days is answered "sent" and stores nothing. A request to someone who
  has already asked you makes you friends. The badge on Profile's Friends counts requests waiting (in-app only).
- **Remove** is silent. **Block** removes the friendship and any pending request, and from then on neither player can
  request, invite, challenge, find the other in search, open the other's profile (the blocked side) or see status. The
  blocked player is told "sent" if they try and never learns of the block. Unblock lifts it without making friends.
- **Report** from a friend's profile uses wave 1's reasons, thank-you and `public.file_room_report` (no room, so
  `room_reports.duel_id` is null): the same counting, automatic mute and review list (docs/moderation.md).
  `moderation.report_queue` gains two columns at the end: `sources` (chat message, room name or profile) and
  `from_profile` (how many of the player's reports came from a profile).
- **Status** (`friends.status_of`): in a lobby (its code and seats, with Join on the list), in a game, playing
  Practice, online (a heartbeat in the past 150 s; the app beats once a minute while visible, accounts only), or last
  seen. "Show when I'm online" is on by default for adults and off for under-18s (null in `friend_settings` = the
  default, worked out on the day); off, friends see no status at all.
- **A friend's profile**: the player card (A1's `getPublicCard`), Challenge (the existing friend challenge flow: the
  challenge is sent to the friend when its creator has played it), Invite to room when the viewer is in a lobby (the
  server finds the room; never a code from the phone), and the head-to-head from finished room games (each Play
  again's archived game and the room's latest) and finished friend challenges both played, won by the higher total,
  level a draw, plus the game whose rounds you won most against them. No rating, trophies or strongest categories until
  their waves.
- **Chat**: no private messages. `chatPolicy(context, player, { friends: true })` answers "type" (under-18s included)
  when everyone else in the chat is the player's friend (`areFriends` in friends.server.ts); the "friends" context is
  a chat of friends only. Strangers' contexts are unchanged.

## Limits

| What | Limit |
| --- | --- |
| Friend requests sent (search or link) | 20 an hour (refused on a database error) |
| Searches | 60 per 10 minutes |
| Invite link resets | 5 a day |
| Room invites and challenges sent to friends | 30 an hour; the same room invite within 2 minutes recorded once; a challenge once per friend |
| Accept, decline, remove, block, unblock, the setting | 120 per 10 minutes |
| Reads (list, profile, badge, link owner, own link) | 600 per 10 minutes |
| Heartbeat | 30 per 10 minutes |
| Reports | wave 1's 20 per 10 minutes |
| Friends | 200 each (checked for both players on accept) |

## Events for phone notifications (B2)

`public.friend_events` (server only): `recipient_id`, `actor_id`, `kind`, `payload`, `created_at`. Written by the SQL
functions in the same transaction as the change:

| kind | When | payload |
| --- | --- | --- |
| `friend_request_received` | a new request is stored (never for a blocked or declined-within-30-days sender) | `requestId` |
| `friend_request_accepted` | a request is accepted (or two players ask each other) | `requestId` |
| `friend_challenge_received` | a friend sends you their own open challenge | `code` |
| `room_invite_received` | a friend invites you to their open lobby | `code`, `roomId` |

The Friends list also reads the last two for its Invites section (room invites from the past 30 minutes to lobbies
still waiting; challenges still open and not yet played). B2 owns sending, delivery state and any retention.

## Analytics

Through `recordEvents` (src/lib/data/events.server.ts): `friend_request_sent` (props.via search|link, only when a
request is stored), `friend_added` (props.via), `friend_removed`, `friend_blocked`. Never a name or the other
player's id.

## The Friendly badge

C2's catalogue has Friendly ("Add 5 friends", Common, no coins) as earnable but awarded here. `awardFriendly` in
`src/lib/friends/friends.server.ts` calls C2's `awardBadge` (`public.badge_award`) for each player in a newly made
friendship who now has 5 or more friends (`public.friends_count`), on an accepted request and on a mutual request,
and once more when a player with 5 or more opens their Friends list (a catch-up if an award ever failed). badge_award
awards a badge once (a repeat answers "owned"), so the badge and its `badge_earned` event are never doubled; the
stored detail carries the count it was earned at. `badge_facts` is not touched. friends-check's "friendly badge"
section proves: none at 4, earned at the fifth (either side), never twice (a sixth friend, the list opened, removed
and re-added), no coins.

## Cards (Joe's phone check, 11 Nov 2026)

Joe's rule: a player's card, avatar and frame show wherever they appear.

- **Rows** (friends, requests, invites, challenges, search results): the player's mini card (`MiniCard`,
  `@/design/identity`: the two ends of their card art and frame side by side, so the frame closes round the square,
  with their avatar in its colour). A row whose card couldn't be read keeps the colour and initial.
- **A friend's profile**: their full `PlayerCard` (card art, frame, name colour, avatar, title, badges, player number);
  an invite link's landing shows its owner's card. Blocked players show no card (the blocked list and a blocked
  player's profile carry none); guests get no friends answers at all, so no cards.
- **Why the profile showed the default card before**: getPublicCard wasn't refused. Its answer is A1's flat shape
  (`avatarId`, `colour`, `cardArt`, `frame`…), but `a1Binding.ts` passed it on unread (`as never`) and the profile read
  `card.loadout`, which didn't exist, so it drew the default card art and frame with no avatar, and never passed the
  title or badges. `normalisePublicCard` (`src/lib/identity/backend.ts`) now reads that shape for any later caller.
- **One call**: the server adds each listed player's look (`look` on `FriendCard`, `FriendLook` in friends.ts) to the
  overview, profile, search and link-owner answers through `cardLooksFor` (friends.server.ts): A1's
  `publicCardsFor` and C2's `cardBadgesFor`, 100 ids a read, in parallel. A list of 200 friends is 2 + 2 reads, never
  one a friend (friends-check "cards" counts them).
- **"Show when I'm online"**: the description wraps in the space left of the switch with a 16 px gap
  (`.fr-setting-row`). no-wrap-check draws the Friends list and a friend's profile (`FRIENDS_SCREENS` in
  scripts/theme-screens.ts, the harness's `friends` mode) and now fails on any switch row whose text runs under its
  switch or is cut off, on every skinned screen.
