-- Joe's verdicts on the redrawn cosmetics (15 Nov 2026, docs/design/cosmetics-redraws/GALLERY.md): every item he
-- approved draws its new art (its switch in src/config/, a code change), and each one that the cosmetics review had
-- withdrawn comes back: sold and given again as before the withdrawal (economy.restore_item, logged in
-- economy.admin_log, which also gives it to everyone it was owed to while withdrawn). One line an item. Additive only:
-- nothing is deleted, no price or ownership changes.

SELECT economy.restore_item('card-art.bolt-stripes', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('card-art.grid', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('card-art.waves', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('card-art.hexes', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('card-art.dots', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('card-art.sunburst', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('card-art.tier.spark', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('card-art.tier.charge', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('card-art.tier.volt', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('card-art.tier.surge', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('card-art.tier.storm', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('card-art.lava', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('frame.bronze', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('frame.silver', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('frame.obsidian', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('name-colour.chrome', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('avatar-finish.carbon', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('avatar-finish.chrome', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('avatar-finish.holographic', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('avatar-finish.neon-glow', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('reaction.clutch', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('reaction.captains-calls', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('reaction.neon-signs', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('tile-style.circuit-trace', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.crazy-golf.watermelon', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.crazy-golf.disco', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.crazy-golf.neon-glow', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.crazy-golf.plasma', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.cue-ball.pixel-pool', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.cue-ball.galaxy-set', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.cue-ball.neon-8-ball', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.cue-ball.neon-ball-set', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.curl-champ.glacier', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.curl-champ.aurora', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.curl-champ.neon-stones', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.full-house.midnight-felt', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.full-house.crimson-velvet', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('game-skin.full-house.neon-felt', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('world-theme.apex.neon-night', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('world-theme.crazy-golf.neon-course', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');
SELECT economy.restore_item('world-theme.curl-champ.neon-rink', 'Joe, 15 Nov 2026: redrawn and approved (docs/design/cosmetics-redraws/GALLERY.md)');

-- Sunburst is shown as Sunrise (Joe, 15 Nov 2026: its redraw is a sunrise over cloud). Display name only; the id stays.
UPDATE public.catalogue_items SET name = 'Sunrise' WHERE id = 'card-art.sunburst';
