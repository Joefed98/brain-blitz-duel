import json
import os
R=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..')+os.sep
files=[('word','D1 Word'),('number','D2 Number'),('speed-attention','D3 Speed and Attention'),('pattern-logic','D4 Pattern and Logic'),('retro-action','D5 Retro and Action'),('strategy-sports-cards','D6 Strategy, Sports and Cards & Board')]
def cell(s): return s.replace('|','\\|').replace('\n',' ').strip()
def lab_of(v):
    v=(v or '').strip().lower()
    return 'documented' if v.startswith('documented') else 'measured' if v.startswith('measured') else 'not measured'
def basis(g):
    e=g.get('evidence') or {}
    short={'documented':'documented','measured':'measured','not measured':'not measured'}
    return ' / '.join(short[lab_of(e.get(k))] for k in ('easy','hard','expert'))
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

1. **Counterweight, Brimful, Checkout and Kakuro: a Hard you can see.** On 15 Nov you chose to keep the older game as their Hard. Measured on 20 Nov (96 deals a game, the same seeds at both levels, the repo's four kits through the server's own grade): that Hard's first board is the same as Normal's on all four, so nothing shows in the first seconds. It is not the same difficulty, though, and my first version was wrong to say it "scores like Normal": the good kit drops 24 (Counterweight), 87 (Brimful), 37 (Checkout) and 61 (Kakuro) points, and Counterweight's average kit drops 70. The person-like solver finishes 81 of 96 old-Hard Kakuro boards (my "a quarter cannot be finished" was also wrong: it is 15 of 96). **Recommendation, unchanged in substance: keep the older game's difficulty where it is good and put a visible step on top, as each game's row says.**
2. **Iron Wall: Expert becomes four lanes** (9 tanks a wave), on bastionRev 3's aim settings. That replaces the 15 Nov ruling that Expert is bastionRev 3's game unchanged. Measured on 20 Nov (60 room seeds a level): today's Hard and Expert put the same tanks on the same lanes at the same moments on 60 of 60 seeds, so the first five seconds look alike; the average bot scores 104 and 84, the elite bot under the human limits 161 and 146. A faster pace alone, tried in memory, changes neither the look nor the gap (average 91, elite 148). The fourth lane itself is not measured: it needs sim code. **Recommendation: yes; a lane is a step a player sees at once, and the fourth lane is your own example of a natural mechanic.**
3. **200 must be reachable, and on some games it is not today, at any level.** Under the human limits the scoring itself caps the best possible run: Flash at exactly 130 on every level (measured 20 Nov: a 250 ms tap pays 115 plus 15 for steadiness), Bonk at 156 (153 on Expert) (the quick window closes at 267 ms), Home Run's perfect streak (the exact tick) at 0 % of Hard and Expert innings, Matchmaker's extras (perfect memory still misses about 11 first looks), Tenfall's Easy at 196, and no Hard or Expert Nucleus board (and 7 of 12 Expert Forage boards) holds 200 points of words. Five Hands has no 200 proof at any level. **Recommendation: fix each on the level deals only** (a scoring stamp or a deal rule that Easy, Hard and Expert carry; Normal untouched), as each game's row says. Whether Normal's own curve should follow later is a separate scoring decision (Flash `tapRev 8`, Bonk `whackRev 5`, Pull! `clayRev 11`).
4. **Proofs to build.** My first version said no tool applies `HUMAN_LIMITS` today. That was wrong. `scripts/level-tune.ts --human-limits` measures under them, `scripts/home-run-top-bins-expert-proof.ts` proves under them, and the level checks for the Speed games, Apex, Gemstone, Ball Tracker, Coral Pop, Home Run and Top Bins assert results under them; the Logic levels assert a person-style solver finishes every Expert board. What is true is narrower: most deal and bank builders prove 200 with a frame-exact oracle; most checks under the limits assert "scores well", not "reaches 200"; nothing applies the limits to any Word game; Breaker, Rally, Meteor and Pinball have no oracle at all; the Logic person-style solver has no clock. Each game's row now says what applies the limits to it today. **Recommendation, unchanged: every difficulty session's first job is its proof under the limits, before any number is tuned.**
5. **Minefield's Expert goes back to 10 × 16** (40 mines, dealt from a proved bank): today's 12 × 18 draws squares at about 31 px on a phone, under the 36 px floor. The first version said 36 mines; measured, 36 left the average player only 17 points below Hard, and 40 gives 93 against Hard's 129 with the elite still reaching 200.

## Every game at a glance

What the player sees in the first seconds at each level.

| Game | Group | The lever | Easy | Hard | Expert | Basis (E / H / X) |
|---|---|---|---|---|---|---|''')
allg=[]
for f,label in files:
    for g in json.load(open(R+f'difficulty/{f}.json')): g['_s']=label; allg.append(g)
for g in allg:
    out.append(f"| {g['name']} | {g['group']} | {cell(g['lever'])} | {cell(g['glance']['easy'])} | {cell(g['glance']['hard'])} | {cell(g['glance']['expert'])} | {basis(g)} |")
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
        e=g.get('evidence') or {}
        out.append(f"| **Evidence** | {cell(e.get('easy','not measured'))} | | {cell(e.get('hard','not measured'))} | {cell(e.get('expert','not measured'))} |")
        out.append('')
        out.append(f"- **Why this curve:** {g['why'].strip()}")
        if g.get('verdict'): out.append(f"- **Fact-check verdict:** {g['verdict'].strip()}")
        if g.get('limitsToday'): out.append(f"- **Human limits today:** {g['limitsToday'].strip()}")
        out.append(f"- **Proof:** {g['proof'].strip()}")
        out.append(f"- **Measured today:** {g['measured'].strip()}")
        out.append(f"- **Stamp:** {g['stamp'].strip()}")
        out.append(f"- **Files:** {', '.join('`'+x+'`' for x in g['files'])}")
        out.append(f"- **Risk:** {g['risk'].strip()}")
        out.append('')
_c={k:[g['name'] for g in allg if g['change']==k] for k in ('keep','retune','redesign')}
_txt='\n'.join(out)+'\n'
_old="- 83 games: **1 kept** as it is (Moon Climb), **48 retuned** (same levers, new numbers) and **34 redesigned** (a different lever)."
assert _old in _txt
_txt=_txt.replace(_old,f"- 83 games: **{len(_c['keep'])} kept** as they are ({', '.join(_c['keep'])}), **{len(_c['retune'])} retuned** (same levers, new numbers) and **{len(_c['redesign'])} redesigned** (a different lever). These counts moved during the fact-check of 20 Nov as rows were corrected.")
open(R+'difficulty-spec.md','w').write(_txt)
print(len(out),'lines',sum(len(x) for x in out)//1000,'KB')
