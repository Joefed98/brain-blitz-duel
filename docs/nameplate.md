# The nameplate: one way to draw a player in a row

Joe's rule (11 Nov 2026): a player's card, avatar and frame show wherever they appear. Use this for every list that
draws a player in a row: leaderboards (W4a), tournament boards (W4b) and brackets (W4c). Friends' small square tiles
stay on `MiniCard`.

## Server: one read per page

```ts
import { nameplatesFor } from "@/lib/identity/nameplates.server";

const cards = await nameplatesFor(client, rows.map((r) => r.playerId)); // Map<playerId, NameplateCard>
```

- Call it inside the list's own server function. The cards then ride on that function's answer, so there is one call
  per page.
- It is built on the Friends follow-up's batched `publicCardsFor` (A1's public cards) and C2's `cardBadgesFor` (badges
  and title). Reads go 100 ids at a time, in parallel. Don't add reads of your own.
- Only accounts come back. A guest, an unknown id or an account waiting for deletion is left out.
- If the badge read fails, the cards come back without badges. If the card read throws, catch it and send the rows
  without cards (colour and initial).
- Never send player ids to the phone. Attach the card to the row and drop the id, as `leaderboards.server.ts`
  `attachCards` does.
- Decide who is hidden on the server, before attaching. A hidden row carries no name, colour, card or tier.

## Phone: `NameplatePlayer`, then the strip

```ts
type NameplatePlayer =
  | { kind: "card"; name: string; card: NameplateCard; playerNumber?: number | null; tier?: string | null }
  | { kind: "plain"; name: string; colour: number | null }   // a guest, or no card: colour and initial
  | { kind: "hidden"; deleted?: boolean };                   // "Hidden player" / "Deleted player"
```

Map your row to a `NameplatePlayer` in one function, as the leaderboards' `rowNameplate` (`BoardList.tsx`) does:

- **Hidden:** under-18s by default, adults who opted out, accounts waiting for deletion. Use `{ kind: "hidden" }`.
- **Deleted accounts:** `{ kind: "hidden", deleted: true }`.
- Everyone sees their own row by name.

```tsx
import { NameplateSheet, NameplateStrip, nameplateOpens, useNameplateSheet } from "@/design/identity";

const [open, openRow, close] = useNameplateSheet<Row>();

<li>
  <Place … />
  {nameplateOpens(player) ? (
    <button type="button" onClick={() => openRow(row)} aria-label={`${name}. Open card`} data-open-card>
      <NameplateStrip player={player} label={name} /> <Score … />
    </button>
  ) : (
    <span><NameplateStrip player={player} /> <Score … /></span>
  )}
</li>

<NameplateSheet player={open && toNameplate(open)} onClose={close}>1st · 3,104</NameplateSheet>
```

- `NameplateStrip({ player, label? })` draws the name area only:
  - **card:** the card art as a band, the frame, the avatar, the name in its name colour, W3a's tier emblem (the
    Top 500's own emblem for `top500`) and up to three badges;
  - **plain:** the colour and initial, then the name;
  - **hidden:** a plain neutral disc (no initial or colour) and "Hidden player" or "Deleted player". It ignores any
    name it might have been given.
- The strip is never a button. The row decides what a tap does.
- Places, scores and times go outside the strip, on the plain row: cosmetics never sit behind them.
- `label` replaces the written name, e.g. "Nova (you)".
- `nameplateOpens(player)` is true only for `kind: "card"`. Hidden and plain players open nothing.
- `NameplateSheet({ player, onClose, children? })` is the tap-to-open full card: A2's `PlayerCard` with title and
  badges, then `children` as one line under it. It draws nothing for a player who may not be opened.
- `useNameplateSheet<T>()` returns `[open, openRow, close]` and keeps one card open at a time.
- `nameplateLook(card)` turns a card into A2's `CardLook`, for drawing a full `PlayerCard` yourself, such as the
  leaderboards' top-3 podium.

## Checks

- leaderboards-ui-check section 7 proves the strip's three kinds and that hidden players get nothing to open. It also
  proves the server side reads only through `publicCardsFor` and `cardBadgesFor`.
- Put new screens in theme-check and no-wrap-check. The strip's art is marked `data-skin-off`, as a game's own art is.
- Ellipsised names are marked `data-ellipsis`.

## Rooms (13 Nov 2026, one identity everywhere)

Rooms draw every player with the same pieces and no other: `NameplateStrip` on rows, the full `PlayerCard` (through
`NameplateSheet`, or `NameplateFullCard` inside a sheet that holds more) when a row is tapped and on the podium, and
`MiniCard` in chat and small lists.

- **One read per room.** `roomCardsFn({ roomId })` (`src/lib/identity/roomCards.functions.ts`) answers every seat's card
  for a caller seated in that room: one seats read, then `platesFor(…, { audience: "room" })` (one `publicCardsFor`,
  one `cardBadgesFor`, one profiles read, W3a's tiers), whatever the room's size. The answer is keyed by seat
  (`duel_players.id`), never by account id. The phone asks once per room and again only when the seats change
  (`useRoomCards`, keyed by `roomCardsKey`).
- **One helper for ids.** `cardIdOf(seat)` in `roomCards.server.ts` is the only place the cards path reads a seat's
  player id (Security's switch to public ids happens there).
- **Inside the room** everyone is a direct opponent: an under-18 shows with their card, an account waiting for
  deletion and every guest on their room colour and initial (or icon). Nobody is "Hidden player" inside their own room.
- **Outside the room** (boards, standings, brackets, the Daily top 100) the list audience applies: hidden under-18s,
  opted-out adults and accounts waiting for deletion are "Hidden player" on a plain neutral disc.
- **Phone:** `RoomCardsHost` wraps the room route; the room screen publishes its cards (`usePublishRoomCards`); screens
  draw through `RoomPlayerName` (a row's strip, a button opening the card), `useRoomNameplate` (a strip inside a row that
  is already a button), `PodiumCards` (the podium's and the two-player final's full cards) and `RoomMiniCard` (chat,
  awards, the reveal's "who's in"). Outside a room (a friend challenge's podium) they draw the room look as before.
- **Taps:** a row that is not already a button opens the card from anywhere on it (`.room-row`). The round leaderboard
  and podium rows already open their round detail, so the card opens from "Open {name}'s card" in it. A lobby name opens
  the player's card with the report reasons under it (`ReportSheet` `player`), so reporting stays two taps.
- identity-everywhere-check proves the one batched read on a real database, the in-room and outside rules, the screens in
  happy-dom and the static rules; the screens are in theme-check and no-wrap-check at every size (`ROOM_IDENTITY_SCREENS`).
