"""Writes docs/design/game-concepts/<category>.md from the notes below (run after the renders)."""
import os
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.dirname(HERE)

NAMES = {
 "logic": [("sudoku", "Box Six"), ("tower", "Hanoi"), ("tubes", "Polypotions"), ("safe", "Safe Cracker"), ("nonogram", "Mosaic"),
           ("flood", "Colour Flood"), ("minesweeper", "Minefield"), ("tents", "Tents and Trees"), ("shikaku", "Shikaku"),
           ("lightup", "Lamplighter"), ("trail", "Trail"), ("fences", "Loopline"), ("fillomino", "Regions"), ("bridges", "Island Link")],
 "number": [("balance", "Counterweight"), ("target", "Exact"), ("equation", "Operator"), ("numpyramid", "Integer Pyramid"),
            ("measure", "Brimful"), ("checkout", "Checkout"), ("numline", "Ballpark"), ("kakuro", "Kakuro")],
 "pattern": [("unblock", "Gridlock"), ("blockparty", "Tessellate"), ("pipes", "Pipeline"), ("flow", "Chroma Lines"),
             ("iceslide", "Skid"), ("push", "Heave"), ("laser", "Lightbender"), ("gravity", "Topsy-Turvy")],
}

NOTES = {
 "sudoku": {"A": "Today's dark tiles and gold digits as lacquered tiles with glowing gold numerals; the white box lines become polished silver strips; the teal selection is tinted glass.",
            "B": "The same board leaned in under a single pool of light: deeper black lacquer, brighter gold, a glowing teal edge.",
            "C": "Flagship idea, \"gold leaf on black marble\": Nero marble tiles whose pale veins echo today's white grid, raised gold-leaf numerals, a silver frame and teal glass for the selection."},
 "tower":  {"A": "Today's wooden posts and bright rounded rings as turned oak and glossy lacquered rings, the gold post's base a real gold plate.",
            "B": "Rings with a candy-glass glow and a stronger key light, so the stacks read like jewels on a stage."},
 "tubes":  {"A": "Today's flasks as real thin-walled test tubes with coloured liquid layers, each keeping its colour-blind symbol; the picked flask has today's gold ring.",
            "B": "Brighter, glowing liquids and clearer glass with a deeper surround: the same flasks as a lit lab display.",
            "C": "Flagship idea, \"the apothecary\": cork-stoppered vials in a walnut rack with brass rails, tinctures that glow from within, the same colours, symbols and gold selection."},
 "safe":   {"A": "Today's clue card, gold number drums and teal arrows as a brushed-steel safe door with rivets, real gold drums showing the next and last digit, and a gold TRY bar.",
            "B": "Darker steel and a spotlit dial bank; the drums and teal arrows glow more."},
 "nonogram": {"A": "Today's teal filled squares as glazed ceramic tiles with a hand-made ripple on dark cells; clues stay white.",
              "B": "The teal tiles become lit glass, as if light comes through the picture."},
 "flood":  {"A": "Today's five colours as glazed tiles, the flooded region raised a step so its edge reads; the pickers are glossy glass marbles.",
            "B": "Deeper, glowing glazes and lit marbles under a tighter light."},
 "minesweeper": {"A": "Today's grey raised plates as brushed-steel plates, revealed squares sunk dark with today's number colours, iron mines on red, cloth flags on pins.",
                 "B": "The same field leaned in, numbers glowing, with the hits burning red."},
 "tents":  {"A": "Today's green grid, tree icons and gold tents in relief: layered pine shapes, canvas tents with a door, wooden clue tags.",
            "B": "Night camp: the tents glow warm from inside on darker turf."},
 "shikaku": {"A": "Today's gold rectangles as gold-tinted glass slabs with polished gold rims over dark cells; numbers stay white.",
             "B": "The slabs glow from within, the board leaned in."},
 "lightup": {"A": "Today's black walls and gold lamps: raised black blocks, brass lamps with real light, thin gold beams along the lit rows and columns.",
             "B": "Lower ambient light so the lamps and beams carry the scene."},
 "trail":  {"A": "Today's stone number tiles, cream path discs and wooden path as carved stone, ceramic discs and a polished wooden rail; the head disc keeps today's teal ring.",
            "B": "The path becomes a glowing amber line, the board leaned in."},
 "fences": {"A": "Today's dots and gold lines as silver pegs and gold wire; numbers stay white once met, grey before.",
            "B": "The wire becomes a glowing gold line under a spotlight."},
 "fillomino": {"A": "Today's tinted regions as coloured glaze on the tiles, clashes in red, gold and white numerals, the teal selected key.",
               "B": "Brighter tints and glowing numerals, leaned in."},
 "bridges": {"A": "Today's island discs as black enamel in silver bezels (gold when complete) joined by polished gold rods.",
             "B": "The gold rods and full islands glow; the board is spotlit."},
 "balance": {"A": "Today's wooden room, gold notched beam and numbered weights as walnut panelling, a brass beam with numbered tags, iron weights on chains, bronze weights in the tray.",
             "B": "A warm lamp over the pivot and a darker room; the brass catches more light."},
 "checkout": {"A": "Today's purple cabinet, numbered wooden ring and red/blue board as a real sisal board with wire spiders, a dart in the lit treble, bulbs round the cabinet, today's chips and X1/X2/X3 buttons.",
              "B": "The cabinet glows deeper purple and the hit segment and buttons glow."},
 "equation": {"A": "Today's teal number tiles, dashed gap and gold result on a dark panel, with stone number tiles below and the gold NEXT bar.",
              "B": "The teal tiles and gap outline glow, the panel spotlit."},
 "kakuro":  {"A": "Today's clue cells with diagonal splits, gold digits and the red broken run, as dark tiles with glowing gold numerals.",
             "B": "Brighter gold and red, leaned in."},
 "measure": {"A": "Today's two jugs as glass jars with tick marks and a gold target line, the blue water as real water.",
             "B": "The water glows and the glass catches a stronger light."},
 "numline": {"A": "Today's big glowing number card, line and markers as a lit glass card, a chrome rail and pins with today's labels.",
             "B": "A stronger glow on the number and the teal marker."},
 "numpyramid": {"A": "Today's stone blocks, tan placed blocks and wooden tray tiles as cut stone, sandstone and wood.",
                "B": "The placed blocks warm with light, the pyramid leaned in."},
 "target":  {"A": "Today's big gold target, steps panel and number tiles as a cast-gold 714, dark glass tiles, the chosen tile in gold.",
             "B": "The gold glows harder against a darker panel."},
 "unblock": {"A": "Today's top-down cars as glossy painted cars with cabins, glass and lights on asphalt; the gold car and exit stay gold.",
             "B": "Night drive: headlights and tail lights glow and the gold car shines."},
 "blockparty": {"A": "Today's gold pegs and coloured pieces as polished gold balls and lacquered blocks.",
                "B": "The pieces glow like coloured glass, the board leaned in."},
 "pipes":   {"A": "Today's grey pipe tiles as brushed steel, the connected run as glowing blue water, the red source valve.",
             "B": "The water glows brighter against the darker steel."},
 "flow":    {"A": "Today's neon lines and coloured dots as glowing coloured tubes and glossy beads; walls hatched steel.",
             "B": "Full neon: the lines glow strongly."},
 "iceslide": {"A": "Today's pale ice board, dark blocks, blue ball and gold exit as frosted ice, granite blocks and a glossy steel ball.",
              "B": "The ice lit from within with cold light."},
 "push":    {"A": "Today's brick walls, sand floor, crates and hazard marks as real brick, sandstone, wooden crates and taped targets; the gold player token.",
             "B": "Two warm wall lamps light the room."},
 "laser":   {"A": "Today's copper bricks, mirrors, gems, bombs and gold beam as real brick, silvered mirrors, cut gems (lit when hit) and a glowing beam.",
             "B": "Lower light so the beam and lit gem carry the scene."},
 "gravity": {"A": "Today's grey blocks and coloured balls with symbols as stone blocks and glass marbles, holes as rimmed cups.",
             "B": "The marbles and hole rims glow."},
}

TITLES = {"A": "A · Today, upgraded", "B": "B · Bolder", "C": "C · Flagship idea"}

def main():
    for cat, games in NAMES.items():
        lines = [f"# {cat.capitalize()}: game concepts", "",
                 "Phase 2, step 4: concept pictures only; nothing here is in the app. Each game keeps today's layout, colours and pieces,",
                 "made premium (Joe, 15 Nov 2026): **A, today upgraded** (the main one) and **B, bolder**; Polypotions and Box Six add a",
                 "**C** flagship idea. Rendered in Blender (Cycles) at 390 × 844 proportions, mid-play; the dark band at the top is a",
                 "placeholder for the header. Today's screenshot (from the game reviews) is first in each row. Sources: [source/](source/).", ""]
        for gid, name in games:
            looks = [l for l in "ABC" if os.path.exists(os.path.join(OUT, cat, f"{gid}-{l}.webp"))]
            lines.append(f"## {name}")
            lines.append("")
            cells = [f'<img src="../game-reviews/img/{cat}/{gid}-2-mid.webp" width="180" alt="{name} today">']
            cells += [f'<img src="{cat}/{gid}-{l}.webp" width="180" alt="{name} {TITLES[l]}">' for l in looks]
            lines.append("| Today | " + " | ".join(TITLES[l] for l in looks) + " |")
            lines.append("|" + "---|" * (len(looks) + 1))
            lines.append("| " + " | ".join(cells) + " |")
            lines.append("")
            for l in looks:
                lines.append(f"- **{TITLES[l]}**: {NOTES[gid][l]}")
            lines.append("")
        open(os.path.join(OUT, f"{cat}.md"), "w").write("\n".join(lines))
        print("wrote", cat)

if __name__ == "__main__":
    main()
