import json
R='/home/user/brain-blitz-duel/docs/polish-plan-final/'
files=[('word','D1 Word'),('number','D2 Number'),('speed-attention','D3 Speed and Attention'),('pattern-logic','D4 Pattern and Logic'),('retro-action','D5 Retro and Action'),('strategy-sports-cards','D6 Strategy, Sports and Cards & Board')]
def cell(s): return s.replace('|','\\|').replace('\n',' ').strip()
out=[]
out.append('''# Joulz difficulty spec: Easy, Hard and Expert for every game

Fable, 20 Nov 2026 (the design-direction session). This replaces the spec of the same name written earlier that day. Every one of the 83 active games has its own ladder below, with a one-line reason and a proof route. The numbers behind "Today" and "Measured" were read from the code and the research (`levels-research.md`) or measured read-only in this session, and are labelled where they are a trial rather than a documented figure. The same content as data: `difficulty/*.json` (one file per build session).

## The rule

1. **Normal is today's game, exactly.** Rated play and the Daily deal it. Nothing here retunes Normal.
2. **One headline lever per game, visible in the first three seconds.** A player who opens Hard after Normal sees the difference before touching anything: a bigger board, more pieces, more enemies, another lane, a narrower gap, a shorter paddle. The four levels sit on that one lever as a ladder (Easy < Normal < Hard < Expert), with at most two supporting levers (time, aids, tolerance). A step whose only change is invisible (a tighter par, a refitted curve) is not a level.
3. **Steep and even.** Each step is roughly 1.4 to 1.7 times the load of the one before. Targets for an average player: Easy 150–180 with a finish nearly every time; Normal about 100 (today, fixed); Hard 55–75; Expert 25–45. For the elite bot under `HUMAN_LIMITS`: Easy 195+, Hard 150–175, Expert 120–150. These are tuning targets for the build session, not promises; Joe's playtest decides.
4. **Easy is welcoming.** A first-time player finishes or scores well on the first try, gets a first success inside ten seconds, and never loses the run to one slip. Aids live here.
5. **Hard and Expert never add an aid.** Expert takes aids away. Where today's Hard or Expert carries an aid Normal lacks (the card games' Hint button), it goes.
6. **Expert is super hard for an average player and proven reachable at 200 by the best humans under `HUMAN_LIMITS`** (0.25 s to react, 0.15 s to move). Arcade: the oracle or witness reaches 200 under the limits on every dealt seed, or the seed is dropped from that level's deal. Puzzles: the person-style solver (deduction plus one-step trials, never a guess) finishes every Expert board inside its clock.
7. **A new mechanic only where it is the natural way.** Five games get one (listed below); every other ladder is numbers and aids.
8. **Stored rounds keep their worlds.** A level that changes a deal or a rule is gated on the stored `level` field or a new revision stamp on level deals only; where a level table is re-read at replay or grading today, the level's values are stamped on the puzzle.

## What changed against today, in short

- 83 games: **1 kept** as it is (Moon Climb), **48 retuned** (same levers, new numbers) and **34 redesigned** (a different lever). Many Easy levels are kept where they already do the job; each says so.
- The commonest fault found: **Hard looks the same as Normal** in the first seconds (same board, same counts) on about thirty games, and on a handful Hard or Expert reads as *easier* (Chroma Lines' Hard has fewer dots, Skid's Expert fewer holes, Tenfall's Hard opens on smaller targets, Lookout's Expert outscores Hard).
- **New mechanics (5):** Exact plays targets in a row (2 at Hard, 3 at Expert); Double Take mirrors the lower picture at Expert; Labyrinth swaps its hidden exit (partly a guess) for gold keys to fetch; Tempo's lane count becomes the ladder (3 / 4–5 / 5 / 6); Iron Wall gains a fourth lane from Hard.

## Decisions for Joe

1. **Counterweight, Brimful, Checkout and Kakuro: a new Hard.** On 15 Nov you chose to keep the older game as their Hard. Measured now, that Hard looks like Normal in the first seconds and scores like it (Counterweight average 94 against 95; Checkout 52 against 50), and a quarter of old-Hard Kakuro boards cannot be finished without a guess. **Recommendation: replace it with the visible step in each game's row.** If you say no, those four Hards stay and only Easy and Expert change.
2. **Iron Wall: Expert becomes four lanes** (9 tanks a wave), on bastionRev 3's aim settings. That replaces the 15 Nov ruling that Expert is bastionRev 3's game unchanged. **Recommendation: yes; the fourth lane is your own example of a natural mechanic.**
3. **200 must be reachable, and on some games it is not today, at any level.** Under the human limits the scoring itself caps the best possible run: Flash at about 130 (a 250 ms tap pays 115), Bonk at about 160 (the quick window closes at 267 ms), Home Run's perfect streak (the exact tick) at 0 % of Hard and Expert innings, Matchmaker's extras (perfect memory still misses about 11 first looks), Tenfall's Easy at 196, and no Hard or Expert Nucleus board (and 7 of 12 Expert Forage boards) holds 200 points of words. Five Hands has no 200 proof at any level. **Recommendation: fix each on the level deals only** (a scoring stamp or a deal rule that Easy, Hard and Expert carry; Normal untouched), as each game's row says. Whether Normal's own curve should follow later is a separate scoring decision (Flash `tapRev 8`, Bonk `whackRev 5`, Pull! `clayRev 11`).
4. **Proofs to build.** No oracle or deal builder applies `HUMAN_LIMITS` today; they are frame-exact. Breaker, Rally, Meteor and Pinball have no oracle at all; the Logic person-style solver counts trials but has no clock; the Attention "200 at every level" run knows the answer. Each row names what to write. **Recommendation: every difficulty session's first job is its proof tool, before any number is tuned.**
5. **Minefield's Expert goes back to 10 × 16** (36 mines): today's 12 × 18 draws squares at about 31 px on a phone, under the 36 px floor.

## Every game at a glance

What the player sees in the first seconds at each level.

| Game | Group | The lever | Easy | Hard | Expert |
|---|---|---|---|---|---|''')
allg=[]
for f,label in files:
    for g in json.load(open(R+f'difficulty/{f}.json')): g['_s']=label; allg.append(g)
for g in allg:
    out.append(f"| {g['name']} | {g['group']} | {cell(g['lever'])} | {cell(g['glance']['easy'])} | {cell(g['glance']['hard'])} | {cell(g['glance']['expert'])} |")
for f,label in files:
    gs=[g for g in allg if g['_s']==label]
    out.append(f"\n## {label.split(' ',1)[1]} (session {label.split(' ',1)[0]})\n")
    for g in gs:
        ch={'keep':'kept as today','retune':'retuned','redesign':'redesigned'}[g['change']]
        out.append(f"### {g['name']} (`{g['id']}`, {g['group']})\n")
        out.append(f"**Lever: {cell(g['lever'])}.** {ch.capitalize()}." + (f" **New mechanic:** {cell(g['newMechanic'])}" if g.get('newMechanic') else ''))
        out.append('')
        out.append('| | Easy | Normal (today, fixed) | Hard | Expert |')
        out.append('|---|---|---|---|---|')
        out.append(f"| **Proposed** | {cell(g['easy'])} | {cell(g['today']['normal'])} | {cell(g['hard'])} | {cell(g['expert'])} |")
        out.append(f"| First seconds | {cell(g['glance']['easy'])} | | {cell(g['glance']['hard'])} | {cell(g['glance']['expert'])} |")
        out.append(f"| Today | {cell(g['today']['easy'])} | | {cell(g['today']['hard'])} | {cell(g['today']['expert'])} |")
        out.append('')
        out.append(f"- **Why this curve:** {g['why'].strip()}")
        out.append(f"- **Proof:** {g['proof'].strip()}")
        out.append(f"- **Measured today:** {g['measured'].strip()}")
        out.append(f"- **Stamp:** {g['stamp'].strip()}")
        out.append(f"- **Files:** {', '.join('`'+x+'`' for x in g['files'])}")
        out.append(f"- **Risk:** {g['risk'].strip()}")
        out.append('')
open(R+'difficulty-spec.md','w').write('\n'.join(out)+'\n')
print(len(out),'lines',sum(len(x) for x in out)//1000,'KB')
