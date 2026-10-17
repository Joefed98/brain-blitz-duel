-- Player colours and icons (17 Oct 2026; presentation and room data only). NOT YET APPLIED:
-- the app works without it (phones show slot colours and initials, the lobby hides the picker),
-- so publishing first is safe; apply it when ready and colours and icons start being stored.
--
--   colour  index into PLAYER_COLOURS (src/lib/duel/playerLook.ts), 0–9; NULL for rows seated
--           before this migration (phones resolve those from the player slot, identically).
--   icon    an id from PLAYER_ICON_IDS, or NULL for the player's initial.
--
-- Written only by the server functions (createRoomFn / joinRoomFn assign a free colour on join,
-- setPlayerLookFn changes it in the lobby, rematchFn stores slot colours before Play again).
-- Row-level security is unchanged: clients keep SELECT on their own rooms and no write access
-- (the restrictive "No client writes to players" policy and the revoked grants still apply).
-- restart_duel_room (Play again) never touches either column, so everyone keeps their colour.

ALTER TABLE public.duel_players
  ADD COLUMN IF NOT EXISTS colour smallint
    CONSTRAINT duel_players_colour_range CHECK (colour IS NULL OR colour BETWEEN 0 AND 9),
  ADD COLUMN IF NOT EXISTS icon text
    CONSTRAINT duel_players_icon_id CHECK (icon IS NULL OR icon ~ '^[a-z]{1,16}$');

-- Never two players in a room with the same colour (left players included: they keep theirs
-- until Play again removes them, and a room never has more rows than its ten slots).
CREATE UNIQUE INDEX IF NOT EXISTS duel_players_duel_colour_key
  ON public.duel_players (duel_id, colour)
  WHERE colour IS NOT NULL;
