"""
Packs the Cards & Board Blender renders (render.py) into the app's images (15 Nov 2026):

  public/cards-board/cards.webp   52 faces then the back, 8 across, each card CARD_W × CARD_H px in a cell padded by PAD
  public/cards-board/tiles.webp   34 Mahjong faces, 6 across, each tile (56 + 6) × (74 + 6) world units at TILE_PX px a unit
  public/cards-board/felt.webp    the card table at 2× its 414 × 772 world
  public/cards-board/mahjong-table.webp  Mahjong's mat and wooden edge at 2× its world

Usage: python3 pack.py <raw dir> <out dir>. The layout numbers here are the ones `realArt.renderer.ts` reads.
"""
import os
import sys

from PIL import Image

RAW, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)

# render.py's card grid.
CW, CH, GAP, COLS = 200, 294, 24, 8
# The packed atlas: the cards at render size, 2 px of clear padding round each so a scaled draw never bleeds.
PAD = 2


def pack_cards():
    raw = Image.open(os.path.join(RAW, "cards-raw.png")).convert("RGBA")
    n = 53
    rows = (n + COLS - 1) // COLS
    cw, ch = CW + 2 * PAD, CH + 2 * PAD
    atlas = Image.new("RGBA", (COLS * cw, rows * ch), (0, 0, 0, 0))
    for k in range(n):
        col, row = k % COLS, k // COLS
        x, y = GAP + col * (CW + GAP), GAP + row * (CH + GAP)
        atlas.paste(raw.crop((x, y, x + CW, y + CH)), (col * cw + PAD, row * ch + PAD))
    atlas.save(os.path.join(OUT, "cards.webp"), "WEBP", quality=80, method=6)


# render.py's tile grid (4 px a world unit there).
TW, TH, TD, TGAP, TCOLS = 224, 296, 24, 40, 6
TILE_PX = 3


def pack_tiles():
    raw = Image.open(os.path.join(RAW, "tiles-raw.png")).convert("RGBA")
    sw, sh = TW + TD, TH + TD
    cw, ch = (56 + 6) * TILE_PX + 2 * PAD, (74 + 6) * TILE_PX + 2 * PAD
    rows = (34 + TCOLS - 1) // TCOLS
    atlas = Image.new("RGBA", (TCOLS * cw, rows * ch), (0, 0, 0, 0))
    for k in range(34):
        col, row = k % TCOLS, k // TCOLS
        x = TGAP + col * (TW + TD + TGAP)
        y = row * (TH + TD + TGAP) + TD + TGAP  # the slab's top edge (the face's top)
        tile = raw.crop((x, y, x + sw, y + sh)).resize(((56 + 6) * TILE_PX, (74 + 6) * TILE_PX), Image.LANCZOS)
        atlas.paste(tile, (col * cw + PAD, row * ch + PAD))
    atlas.save(os.path.join(OUT, "tiles.webp"), "WEBP", quality=82, method=6)


def pack_plain(name, out):
    Image.open(os.path.join(RAW, name)).convert("RGB").save(os.path.join(OUT, out), "WEBP", quality=72, method=6)


what = os.environ.get("ONLY", "cards,tiles,felt,mahjong").split(",")
if "cards" in what:
    pack_cards()
if "tiles" in what:
    pack_tiles()
if "felt" in what:
    pack_plain("felt-raw.png", "felt.webp")
if "mahjong" in what:
    pack_plain("mahjong-table-raw.png", "mahjong-table.webp")
for f in sorted(os.listdir(OUT)):
    print(f, os.path.getsize(os.path.join(OUT, f)) // 1024, "KB")
