-- Joe, 13 Nov 2026 (docs/cosmetics-review): the three card backs were withdrawn only because they showed nowhere but
-- Full House (practice only); they now draw on Summit's, Thirteen's and Five Hands' face-down cards
-- (20261116800100_card_back_games.sql), so they come back. One line an item, as every restore.
SELECT economy.restore_item('card-back.royal-damask', 'Joe, 13 Nov 2026: shows in live games (Summit, Thirteen, Five Hands)');
SELECT economy.restore_item('card-back.holo-foil', 'Joe, 13 Nov 2026: shows in live games (Summit, Thirteen, Five Hands)');
SELECT economy.restore_item('card-back.neon', 'Joe, 13 Nov 2026: shows in live games (Summit, Thirteen, Five Hands)');
