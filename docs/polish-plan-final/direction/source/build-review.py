import json, html
R='/home/user/brain-blitz-duel/docs/polish-plan-final/'
E=html.escape
from PIL import Image as _I
def img(path,cap,cls=''):
    w,h=_I.open(R+f'direction/{path}.webp').size
    return f'<figure class="shot {cls}"><img loading="lazy" width="{w}" height="{h}" src="direction/{path}.webp" alt="{E(cap)}"><figcaption>{E(cap)}</figcaption></figure>'
def strip(items,cls=''):
    return f'<div class="strip {cls}">'+''.join(img(p,c,k) for p,c,k in items)+'</div>'
G=[('wordhunt','Forage · Word'),('sudoku','Box Six · Logic'),('pipes','Pipeline · Pattern'),('matchup','Gemstone · Strategy'),('breaker','Breaker · Retro'),('freekick','Top Bins · Sports'),('tripeaks','Summit · Cards')]
DIRS=[('floodlit','1','Floodlit','Same games, lights on.','Every near-black stage becomes its category’s deep colour, colours a quarter stronger, chrome turned to satin colour.','Works on all 83 games, smallest build, sits naturally in the frame.','Pieces stay dark-bodied, so the puzzles change least where they need it most.'),
('neon','2','Neon Arena','Keep the dark, make every piece glow.','Saturation up, glow on anything coloured, a faint floor grid, chrome tinted neon.','The most “esports”. Superb on Retro and on Pipeline.','Still dark, and glow is another kind of shiny. Tiring on reading puzzles.'),
('twotone','3','Two-Tone Worlds','Each world floods with a bold two-colour gradient.','The stage becomes the colour: blue to violet, teal to blue, violet to pink.','The most colourful of the four.','Fights the frame, boards lose contrast, reads casual.'),
('spotlight','4','Spotlight','A bright table in a dark arena.','Floodlit’s lit stage, plus light matte pieces on the board puzzles. Worlds, sports and cards get Floodlit’s treatment (they have no dark pieces to flip).','The biggest gain where the complaint is: black tiles, chrome pipes, brushed metal. It is chess.com’s formula, and the one Joulz’s own card and sports games already use.','The largest art job: each puzzle family’s piece set is re-rendered.')]
dec=[
 ('look','Page look',[('E','E · Esports, refined'),('F','F · Esports, colour-charged'),('A','A · Bright Spark')],'E','Today’s style kept; structure, size and words improved. F if E reads too quiet. A is a different product.'),
 ('games','Game art direction',[('1','1 · Floodlit'),('2','2 · Neon Arena'),('3','3 · Two-Tone Worlds'),('4','4 · Spotlight')],'4','Spotlight, with Retro kept dark on Neon’s glow. Floodlit is the same plan without the new piece sets and can ship first.'),
 ('nav','Navigation',[('N1','N1 · Five tabs, Home’s hero is the play button'),('N2','N2 · Centre Play button')],'N1','Home · Games · Compete · Shop · You. The floating Play bar goes; More becomes You.'),
 ('first','A new phone’s first open goes straight into a first game',[('yes','Yes'),('no','No')],'yes','Ascend on Easy: the first tap is the game’s first tap. Then a win screen, then Home.'),
 ('gamespage','Games page on a phone',[('G1','G1 · Category shelves'),('G2','G2 · Three-across grid')],'G1','Larger tiles and every category on the first screen. The grid stays as each category’s “All” page.'),
 ('levels','The level picker lives on each game’s page only',[('yes','Yes'),('no','No')],'yes','It leaves the catalogue, and the “Difficulty levels” explainer goes.'),
 ('intro','Round intro: demo, one-line goal and Ready',[('yes','Yes'),('no','No')],'yes','How and Score move behind “?”. Rooms and the Daily keep the Ready tap.'),
 ('ratings','Ratings tiles leave Home',[('yes','Yes'),('keep','Keep them on Home')],'yes','The hero shows your rating; all three live on You. This reverses the 14 Nov choice.'),
 ('terms','Beta terms cut to about 60 words and a link',[('yes','Yes, subject to the adviser'),('no','No')],'yes','On the Daily the page shows first and the terms come at the first Play tap.'),
 ('hard4','A new Hard for Counterweight, Brimful, Checkout and Kakuro',[('yes','Yes'),('no','Keep the older game as Hard')],'yes','The older game as Hard is harder than Normal (a good player drops 24 to 87 points). It just does not look different in the first seconds, so each gets a step you can see. This reverses the 15 Nov choice.'),
 ('ironwall','Iron Wall’s Expert becomes four lanes',[('yes','Yes'),('no','Keep Expert as it is')],'yes','The fourth lane arrives at Hard (8 tanks a wave), Expert has 9.'),
 ('reach200','Fix scoring on level deals so 200 is reachable under the human limits',[('yes','Yes'),('no','No')],'yes','Flash, Bonk, Home Run, Matchmaker, Tenfall’s Easy, Nucleus, Forage, Five Hands. Normal untouched.'),
 ('proofs','Every difficulty session builds its proof tool first',[('yes','Yes'),('no','No')],'yes','Some proof tools apply the human limits today (the level tuning tool, the Home Run and Top Bins proof, nine level checks). Most 200 proofs are still frame-exact, and four Retro games have no oracle at all.'),
 ('mines','Minefield’s Expert goes back to 10 × 16 (40 mines)',[('yes','Yes'),('no','No')],'yes','Today’s 12 × 18 draws squares at about 31 px on a phone.'),
 ('bestvalue','Drop “best value” from the coin packs',[('yes','Yes, drop it'),('no','Keep it')],'yes','The style guide’s own rule is no pressure labels.'),
 ('avatars','Leave the avatars’ backing disc and their art as they are',[('yes','Yes, leave them'),('no','Remove the disc')],'yes','The new header and VS screens make the disc a non-issue.'),
 ('homelayout','Home layout',[('H1','H1 · Hero'),('H2','H2 · Match day'),('H3','H3 · Deck')],'H1','H1 works for every player today. H2 is the one to move to when rated play is open to everyone.'),
 ('competelayout','Compete layout',[('C1','C1 · Ladder'),('C2','C2 · Fixtures'),('C3','C3 · Season')],'C1','C1 is never empty, even with tournaments off. C2 and C3 suit later, as tournaments and seasons open.'),
 ('youlayout','You layout',[('Y1','Y1 · Rows'),('Y2','Y2 · Card first'),('Y3','Y3 · Career')],'Y2','The page is about identity, and the card is the identity.'),
 ('levelpick','Level picker on a game’s page',[('L1','L1 · Ladder (all four levers at once)'),('L2','L2 · Preview (one level large)')],'L1','L1 shows every step and your best on each at a glance. L2 shows one level bigger. The step-up card on the reveal (L3) comes with either.'),
 ('wordtop','Nucleus and Forage on Expert: how 200 is proved',[('score','Change the scoring on Expert deals so a real top player can reach 200'),('witness','Accept a typed-out perfect run as the proof')],'score','Measured: the modelled best player tops out at 160 to 191 on Expert, and at 184 on Nucleus’s Normal. Your rule is 200 reachable by the best humans, so I would change the points line on level deals (a new stamp; Normal untouched).'),
 ('breakerball','Breaker: a lost ball costs more on Hard and Expert',[('yes','Yes: a lost ball costs a life or a time penalty on Hard and Expert deals'),('no','No: keep rows and paddle width only')],'yes','Measured with a bot that feels paddle width: Hard sits only 14 under Normal, because a lost ball costs just a 3-second relaunch. A cost for losing the ball is the step a player would feel.'),
 ('gem8','Gemstone: an eighth gem for Expert',[('yes','Yes: the ladder is 5, 6, 7, 8 colours'),('no','No: 7 colours with bigger goals')],'yes','Measured: ice at any count leaves Expert level with Hard. Colours are the only setting that moves an average player (5, 6, 7 colours score 163, 95, 72). An eighth gem needs sim code and one new gem drawn.'),
 ('accent','Accent colourway',[('champagne','Champagne (today’s)'),('ion','Ion (electric cyan)'),('ember','Ember (magenta to orange)')],'champagne','Gold stays the one action colour in all three.'),
]
allg=[]
for f in ['word','number','speed-attention','pattern-logic','retro-action','strategy-sports-cards']:
    allg+=json.load(open(R+f'difficulty/{f}.json'))
order=['Word','Number','Speed','Attention','Pattern','Logic','Retro','Action','Strategy','Sports','Cards & Board']
def lab_of(v):
    v=(v or '').strip().lower()
    return 'documented' if v.startswith('documented') else 'measured' if v.startswith('measured') else 'not measured'
def levels():
    out=[]
    bars=lambda n: '<span class="lm l%d"><i></i><i></i><i></i><i></i></span>'%n
    for grp in order:
        gs=[g for g in allg if g['group']==grp]
        gid=grp.lower().replace(' & ','-').replace(' ','-')
        out.append(f'<h3 class="fam" id="fam-{gid}">{E(grp)} <span>{len(gs)}</span></h3>')
        for g in gs:
            ch={'keep':'kept','retune':'retuned','redesign':'redesigned'}[g['change']]
            new=f'<p><b>New mechanic:</b> {E(g["newMechanic"])}</p>' if g.get('newMechanic') else ''
            ev=g.get('evidence') or {}
            v=(g.get('verdict') or 'unproven')
            vk=v.split(':')[0].strip().lower(); vk=vk if vk in ('holds','adjusted','unproven') else 'unproven'
            vt={'holds':'checked: holds','adjusted':'checked: changed','unproven':'still to prove'}[vk]
            newtag='<i class="tag newmech">new mechanic</i>' if g.get('newMechanic') else ''
            cell=lambda cls,n,name,txt,lv: f'<div class="{cls}"><em>{bars(n)}{name}</em>{E(txt)}'+(f'<small class="ev {lab_of(ev.get(lv)).replace(" ","-")}">{lab_of(ev.get(lv))}</small>' if lv else '')+'</div>'
            out.append(f'''<article class="lv" data-v="{vk}" data-new="{1 if g.get("newMechanic") else 0}" data-name="{E(g["name"].lower())} {E(g["lever"].lower())}"><header><b>{E(g["name"])}</b><span class="lever">{E(g["lever"])}</span><i class="tag {g["change"]}">{ch}</i>{newtag}<i class="tag v-{vk}">{vt}</i></header>
<div class="ladder">{cell("e",1,"Easy",g["glance"]["easy"],"easy")}{cell("n",2,"Normal · today",g["today"]["normal"],None)}{cell("h",3,"Hard",g["glance"]["hard"],"hard")}{cell("x",4,"Expert",g["glance"]["expert"],"expert")}</div>
<details><summary>Why, and what the check found</summary><p>{E(g["why"])}</p>{new}<p><b>Fact-check:</b> {E(v)}</p></details></article>''')
    return '\n'.join(out)
def famnav():
    return '<div class="chips">'+''.join(f'<a href="#fam-{grp.lower().replace(" & ","-").replace(" ","-")}">{E(grp)}</a>' for grp in order)+'</div>'
def threeway():
    import os
    out=[]
    for g,n,note in [('pipes','Pipeline',''),('flow','Chroma Lines','The old capture is mid-game, so its lines are drawn. Today’s play capture is the start of a round, so today’s lines are shown from the reveal’s solution (a small capture, enlarged).'),('gravity','Topsy-Turvy',''),('numline','Ballpark','The 82f2f648 play screen would not capture, so “old” is the earlier 6 Nov capture of the same look, enlarged from a small picture.')]:
        items=[]
        for k,lab in (('old','Old'),('now','Today'),('nowlines','Today, lines drawn'),('spotlight','Spotlight'),('drawn','Spotlight, drawn')):
            if os.path.exists(R+f'direction/games/{g}-{k}.webp'): items.append((f'games/{g}-{k}',f'{n} · {lab}','now' if k=='now' else ''))
        out.append(f'<h4>{E(n)}</h4>'+(f'<p class="muted">{E(note)}</p>' if note else '')+strip(items))
    return '\n'.join(out)
def factcounts():
    lab={'measured':0,'documented':0,'not measured':0}; ver={'holds':0,'adjusted':0,'unproven':0}
    for g in allg:
        for l in ('easy','hard','expert'): lab[lab_of((g.get('evidence') or {}).get(l))]+=1
        v=(g.get('verdict') or 'unproven').split(':')[0].strip().lower(); ver[v if v in ver else 'unproven']+=1
    return lab,ver
def adjusted():
    out=[]
    for g in allg:
        v=g.get('verdict') or ''
        if v.lower().startswith('adjusted'): out.append(f'<li><b>{E(g["name"])}:</b> {E(v.split(":",1)[1].strip() if ":" in v else v)}</li>')
    return '\n'.join(out)
ANS={
 'look':('changed','E, with my rating front and centre on Home.'),
 'games':('agreed','Spotlight, with Retro on Neon’s glow and the light-on-dark games keeping a deep board. “Your drawn versions look really good.”'),
 'nav':('agreed','N1: Home · Games · Compete · Shop · You.'),
 'first':('changed','Straight into a game, yes. Which game: Joe picks from three candidates (still open, below).'),
 'gamespage':('changed','G1 shelves (bigger tiles) by default, plus one switch to “All”: every game in the three-across grid, grouped by category. The page remembers the last view.'),
 'levels':('agreed','Yes.'),
 'intro':('agreed','Yes.'),
 'ratings':('changed','The three tiles go, but my main rating is in the banner and my other two ratings show as small chips under it; tapping one opens Compete.'),
 'terms':('agreed','Yes, subject to the adviser.'),
 'hard4':('agreed','Yes.'),
 'ironwall':('agreed','Yes.'),
 'reach200':('agreed','Yes, and on Normal too: the seven approved scoring fixes are built under new stamps, with Normal’s caps for Flash, Bonk and Pull!.'),
 'proofs':('agreed','Yes.'),
 'mines':('agreed','Yes: 40 mines, per the spec.'),
 'bestvalue':('agreed','Yes.'),
 'avatars':('agreed','Yes.'),
 'homelayout':('changed','H1 and H2 combined, nothing shown twice: H1’s top line (avatar, name, streak, coins; no rating), then H2’s player banner (rating large, “+22 this week”, tier and bar, gold Find a match), then H1’s middle (the two Dailies, Play friends), then H2’s Jump back in. Not rated yet: “Play now” over the game of the day. Open but unplaced: “Play 5 placement matches to get your rating”.'),
 'competelayout':('changed','C1’s layout, reordered: rating, tier and Find a match first; then tournaments (C2’s live event card and upcoming fixtures); then leaderboards lower down as tabs, with the Daily top 100 as one tab and nothing more prominent.'),
 'youlayout':('changed','Y2, with Y3’s three ring gauges in place of the three stat tiles and Y3’s trophy shelf as one row under the card.'),
 'levelpick':('changed','L1 and L2 combined: the page opens on my current level shown large; all four levels sit underneath as a compact row to tap, each with its small picture, my best and my star; it remembers the last level I played on each game; Challenges and How to play are two small buttons.'),
 'wordtop':('agreed','Change the scoring.'),
 'breakerball':('agreed','Yes.'),
 'gem8':('agreed','Yes.'),
 'accent':('agreed','Champagne.'),
}
def decisions():
    out=[]
    for i,(k,q,opts,rec,note) in enumerate(dec,1):
        st,txt=ANS[k]
        out.append(f'<div class="done {st}"><div class="dq"><b>{i}.</b> {E(q)}<i class="tag {"v-holds" if st=="agreed" else "v-adjusted"}">{"agreed" if st=="agreed" else "changed"}</i></div><p class="da">{E(txt)}</p><p class="dn">{E(note)}</p></div>')
    return '\n'.join(out)
OPEN=[
 ('firstgame','The first game on a new phone',[('ascend','Ascend, Easy: tap 1 to 16 in order; nothing to explain, over in about 20 seconds (average player 171)'),('flood','Colour Flood, Easy: tap a colour and the board floods; one rule, the highest Easy average measured (195)'),('tubes','Polypotions, Easy: pour to sort the colours; most people have seen the idea (average 180)')],'ascend','All three are understood without reading and are a likely win inside a minute. My pick is Ascend: its first tap is the game’s first tap.'),
 ('lookpipes','Pipeline’s look',[('spot','Spotlight'),('today','Today’s'),('old','The old look (82f2f648)')],'spot','Shown three ways above. Old means the earlier plan’s E1.4, built by A2.'),
 ('lookflow','Chroma Lines’ look',[('spot','Spotlight (the deep board kept, the stage lit)'),('today','Today’s'),('old','The old look (82f2f648)')],'old','The old neon lines read best of the three to me. Old means the earlier plan’s E1.3, built by A2.'),
 ('lookgravity','Topsy-Turvy’s look',[('spot','Spotlight'),('today','Today’s'),('old','The old look (82f2f648)')],'spot','Old means the earlier plan’s E1.2, built by A2.'),
 ('looknumline','Ballpark’s look',[('spot','Spotlight'),('today','Today’s'),('old','The old look')],'old','The old lit card and plain white tape are clearer than either newer version. Old means the earlier plan’s E1.5, built by A1.'),
]
def opendecisions():
    out=[]
    for i,(k,q,opts,rec,note) in enumerate(OPEN,1):
        o=''.join(f'<label class="opt{" rec" if v==rec else ""}"><input type="radio" name="d-{k}" id="d-{k}-{v}" value="{E(lab)}"{" checked" if v==rec else ""}><span>{E(lab)}{" <small>my pick</small>" if v==rec else ""}</span></label>' for v,lab in opts)
        out.append(f'<fieldset class="dec" data-q="{E(q)}"><legend><b>{chr(64+i)}.</b> {E(q)}</legend><p>{E(note)}</p><div class="opts">{o}</div></fieldset>')
    return '\n'.join(out)
def olddecisions():
    out=[]
    for i,(k,q,opts,rec,note) in enumerate(dec,1):
        o=''.join(f'<label class="opt{" rec" if v==rec else ""}"><input type="radio" name="d-{k}" id="d-{k}-{v}" value="{E(lab)}"{" checked" if v==rec else ""}><span>{E(lab)}{" <small>recommended</small>" if v==rec else ""}</span></label>' for v,lab in opts)
        out.append(f'<fieldset class="dec" data-q="{E(q)}"><legend><b>{i}.</b> {E(q)}</legend><p>{E(note)}</p><div class="opts">{o}</div></fieldset>')
    return '\n'.join(out)
import os as _os
MOREFAM=[]
for g,n,note in [('numhunt','Ascend · Speed','Spotlight'),('strikeout','Strikeout · Word','Spotlight'),('target','Exact · Number','Spotlight'),('symscan','Eagle Eye · Attention','Spotlight'),('balance','Counterweight · Number','Spotlight'),('tubes','Polypotions · Logic','Spotlight'),('bastion','Iron Wall · Action','lit stage'),('flow','Chroma Lines · Pattern','lit stage only'),('hover','Hover · Retro','stays neon')]:
    if _os.path.exists(R+f'direction/games/{g}-spotlight.webp'):
        MOREFAM+=[(f'games/{g}-now',n.split(' · ')[0]+' today','now'),(f'games/{g}-spotlight',n+' · '+note,'')]
dirsec=[]
for key,num,name,idea,what,pro,con in DIRS:
    rec=' <span class="recbadge">Recommended</span>' if key=='spotlight' else ''
    dirsec.append(f'''<article class="dir" id="dir-{key}"><h3><span class="num">{num}</span>{E(name)}{rec}</h3><p class="idea">{E(idea)}</p><p>{E(what)}</p>
{strip([(f"games/{g}-{key}",n,'') for g,n in G])}
<p class="pc"><b>For:</b> {E(pro)}</p><p class="pc"><b>Against:</b> {E(con)}</p></article>''')
compare=[]
for g,n in [('wordhunt','Forage'),('pipes','Pipeline'),('matchup','Gemstone'),('tripeaks','Summit')]:
    compare.append(f'<h4>{E(n)}: today, then directions 1 to 4</h4>'+strip([(f'games/{g}-now','Today','now')]+[(f'games/{g}-{k}',f'{num} · {nm}','') for k,num,nm,*_ in DIRS]))
def pair(title,note,items):
    return f'<article class="pg"><h3>{E(title)}</h3><p>{E(note)}</p>{strip(items)}</article>'
pages=[
 pair('Home','One hero and one gold button. Dailies side by side, each with a visible Play. Create and Join on Home. No floating bar, nothing pops in.',[('pages/home-now-phone','Today','now'),('pages/home-e-phone','E · Esports, refined',''),('pages/home-f-phone','F · Colour-charged',''),('pages/home-a-phone','A · Bright Spark','')]),
 pair('Games','One control, the game of the day, then a shelf per category with larger tiles. The level switch and the explainer leave this page.',[('pages/games-now-phone','Today','now'),('pages/games-e-phone','E · shelves (G1)',''),('pages/games-e2-phone','E · grid (G2)',''),('pages/games-a-phone','A · Bright Spark','')]),
 pair('A game’s page','A one-line goal, the four levels as steps, one large Play. Forty words at most.',[('pages/gamepage-now-phone','Today','now'),('pages/gamepage-e-phone','E',''),('pages/gamepage-a-phone','A','')]),
 pair('VS','Full-bleed: each half lit in its player’s colour, the card drawn large, the first game and the stakes at the foot.',[('pages/vs-now-phone','Today','now'),('pages/vs-e-phone','E',''),('pages/vs-f-phone','F',''),('pages/vs-a-phone','A','')]),
 pair('Rated result','The win reads as a win, and there is a way home. (The built title stays “You win”, without the exclamation mark.)',[('pages/result-now-phone','Today','now'),('pages/result-e-phone','E',''),('pages/result-a-phone','A','')]),
 pair('You (Profile and More in one)','The card, the rating, three stats, then rows for Friends, Challenges, Badges and Settings.',[('pages/profile-now-phone','Today: Profile','now'),('pages/more-now-phone','Today: More','now'),('pages/profile-e-phone','E',''),('pages/profile-a-phone','A','')]),
 pair('Shop','The bundle as a hero with its items large, the still filling each card’s top half. No pressure labels.',[('pages/shop-now-phone','Today','now'),('pages/shop-e-phone','E',''),('pages/shop-f-phone','F',''),('pages/shop-a-phone','A','')]),
]
desk=[
 pair('Desktop Home','The hero across two columns, three feature cards, six tiles, an aside that is never empty.',[('pages/home-now-desktop','Today','now wide'),('pages/home-e-desktop','E','wide'),('pages/home-f-desktop','F','wide'),('pages/home-a-desktop','A','wide')]),
 pair('Desktop Games','The hero across the top, shelves of seven tiles.',[('pages/games-now-desktop','Today','now wide'),('pages/games-e-desktop','E','wide'),('pages/games-a-desktop','A','wide')]),
 pair('Desktop VS','The two halves side by side on a slanted gold seam.',[('pages/vs-now-desktop','Today','now wide'),('pages/vs-e-desktop','E','wide'),('pages/vs-a-desktop','A','wide')]),
 pair('Desktop You','The card, rating and stats on the left; rows, recent matches and the showcase on the right.',[('pages/profile-now-desktop','Today','now wide'),('pages/profile-e-desktop','E','wide'),('pages/profile-a-desktop','A','wide')]),
 pair('Desktop Shop','The bundle across the top, four items a row, coins and the wishlist in the aside.',[('pages/shop-now-desktop','Today','now wide'),('pages/shop-e-desktop','E','wide'),('pages/shop-a-desktop','A','wide')]),
 pair('Desktop rated result','The title, the rating card beside the game rows, the three actions in a row.',[('pages/result-now-desktop','Today','now wide'),('pages/result-e-desktop','E','wide'),('pages/result-a-desktop','A','wide')]),
 pair('Desktop game: the Cabinet','The identical world in the middle, score and run on the left, goal and controls on the right. The skeleton is already built, behind a switch that is off. Layout study; the panels are painted in the esports style when built.',[('pages/play-a-desktop','The Cabinet on Breaker','wide')]),
 pair('Desktop game, in the esports look','The same Cabinet layout painted in the page style: run and score on the left, goal, next challenges and controls on the right, the world untouched in the middle.',[('pages/play-e-desktop','E','wide')]),
]
page=f'''<title>Joulz Design Direction</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..900&display=swap">
<style>
/* Layout: one phone-width column of sections; pictures in sideways strips; choices as tappable rows that copy out as text.
   A single dark look on purpose: the page wears Joulz's own navy and champagne so the screenshots sit in their own world. */
:root {{ color-scheme: dark;
  --bg:#04060C; --panel:#0D152B; --panel2:#17233F; --line:#223058; --text:#EEF2FF; --text2:#B5C6DD; --text3:#8F9BBF;
  --gold:#E2C07A; --gold-ink:#06080F; --cyan:#22E4FF; --green:#3EDB72; --amber:#FFB35C; --red:#FF6B7E; --blue:#6FA2FF;
  --font:"Archivo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }}
*{{box-sizing:border-box}} [hidden]{{display:none!important}}
body{{background:var(--bg);color:var(--text);font:400 16px/1.55 var(--font);margin:0}}
.wrap{{max-width:980px;margin:0 auto;padding-block:20px 80px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}}
h1{{font:900 34px/1.05 var(--font);font-stretch:118%;margin:10px 0 8px;text-wrap:balance}}
h1 b{{color:var(--gold)}}
h2{{font:900 25px/1.1 var(--font);font-stretch:112%;margin:54px 0 10px;padding-top:18px;border-top:2px solid var(--line);text-wrap:balance}}
h3{{font:800 20px/1.2 var(--font);margin:26px 0 6px;text-wrap:balance}}
h4{{font:700 15px/1.3 var(--font);color:var(--text2);margin:20px 0 6px}}
p{{margin:0 0 10px;max-width:68ch}} .lede{{color:var(--text2);font-size:17px}}
a{{color:var(--cyan)}} code{{font:500 13px var(--mono);color:var(--text2);overflow-wrap:anywhere}}
.eyebrow{{font:800 12px var(--font);letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}}
nav.toc{{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 4px}}
nav.toc a{{text-decoration:none;color:var(--text);background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:9px 13px;font:700 14px var(--font)}}
.short{{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin:18px 0}}
.short ul{{margin:0;padding-left:18px}} .short li{{margin:7px 0}}
.strip{{display:flex;gap:12px;overflow-x:auto;padding:6px 2px 14px;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}}
.shot{{flex:none;margin:0;width:228px;scroll-snap-align:start}} .shot.wide{{width:min(86vw,640px)}} .shot.board{{width:min(92vw,900px)}} .fcs{{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin:14px 0}} .fc{{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px}} .fc .q{{font:800 16px/1.3 var(--font);margin-bottom:8px}} .fc p{{margin:0 0 8px;color:var(--text2);font-size:15px}} .fc p.v{{margin:0;color:var(--gold)}} .fc p.v b{{color:var(--gold)}} .done{{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:8px 0}} .done .dq{{font:800 16px/1.3 var(--font);display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}} .done .dq .tag{{margin-left:auto}} .done .da{{margin:8px 0 0;color:var(--text)}} .done.changed{{border-color:var(--blue)}} .done .dn{{margin:6px 0 0;color:var(--text3);font-size:14px}} ul.adds{{padding-left:18px}} ul.adds li{{margin:8px 0;color:var(--text2)}} ul.adds b{{color:var(--text)}} ul.adj{{margin:8px 0 4px;padding-left:18px}} ul.adj li{{margin:8px 0;color:var(--text2)}} ul.adj b{{color:var(--text)}}
.shot img{{display:block;width:100%;height:auto;border-radius:14px;border:1px solid var(--line);background:#000;cursor:zoom-in}}
.shot.now img{{border-color:#4A5E9E}} .shot figcaption{{font:700 13px var(--font);color:var(--text2);margin-top:6px}}
.shot.now figcaption{{color:var(--text3)}}
.dir{{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:4px 16px 12px;margin:18px 0}}
.dir h3{{display:flex;align-items:center;gap:10px;flex-wrap:wrap}}
.num{{display:inline-flex;width:30px;height:30px;border-radius:8px;background:var(--panel2);align-items:center;justify-content:center;font:900 16px var(--font);color:var(--gold)}}
.idea{{font:800 17px var(--font);color:var(--text)}} .pc{{color:var(--text2);font-size:15px;margin:4px 0}}
.recbadge,.opt small{{font:800 11px var(--font);letter-spacing:.08em;text-transform:uppercase;background:var(--gold);color:var(--gold-ink);border-radius:6px;padding:3px 7px}}
.rec-box{{border:2px solid var(--gold);border-radius:16px;padding:14px 16px;margin:18px 0;background:linear-gradient(135deg,#1A2038,#0B1022)}}
.pg{{margin:22px 0}}
table{{border-collapse:collapse;width:100%;font-size:15px}} .tbl{{overflow-x:auto;margin:10px 0 16px}}
th,td{{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}} th{{color:var(--text3);font:800 12px var(--font);letter-spacing:.08em;text-transform:uppercase}}
td b{{color:var(--gold)}} .tnum{{font-variant-numeric:tabular-nums}}
.fam{{margin-top:28px;display:flex;align-items:baseline;gap:8px}} .fam span{{font:800 13px var(--font);color:var(--text3)}}
article.lv{{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin:10px 0;padding:12px 0 8px}}
article.lv header{{padding:0 14px 10px;display:flex;gap:6px 8px;align-items:baseline;flex-wrap:wrap}} article.lv header b{{font:800 17px var(--font)}}
article.lv details{{margin:4px 14px 2px}} article.lv details summary{{cursor:pointer;color:var(--text3);font:700 13px var(--font);padding:6px 0}} article.lv details p{{color:var(--text2);font-size:14px;margin:6px 0}} article.lv details p b{{color:var(--gold)}}
.lm{{display:inline-flex;align-items:flex-end;gap:2px;height:11px;margin-right:6px;vertical-align:-1px}} .lm i{{width:3px;border-radius:1px;background:#2A3A6B}} .lm i:nth-child(1){{height:4px}} .lm i:nth-child(2){{height:6px}} .lm i:nth-child(3){{height:9px}} .lm i:nth-child(4){{height:11px}}
.lm.l1 i:nth-child(-n+1){{background:var(--green)}} .lm.l2 i:nth-child(-n+2){{background:var(--blue)}} .lm.l3 i:nth-child(-n+3){{background:var(--amber)}} .lm.l4 i:nth-child(-n+4){{background:var(--red)}}
.tag.v-holds{{color:var(--green);box-shadow:inset 0 0 0 1px currentColor;background:none}} .tag.v-adjusted{{color:var(--blue);box-shadow:inset 0 0 0 1px currentColor;background:none}} .tag.v-unproven{{color:var(--amber);box-shadow:inset 0 0 0 1px currentColor;background:none}} .tag.newmech{{background:var(--gold);color:var(--gold-ink)}}
.chips{{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}} .chips a,.chips button{{text-decoration:none;color:var(--text);background:var(--panel2);border:1px solid var(--line);border-radius:999px;padding:7px 12px;font:700 13px var(--font);cursor:pointer}} .chips button[aria-pressed=true]{{background:var(--gold);color:var(--gold-ink);border-color:var(--gold)}}
details.lv{{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin:8px 0}}
details.lv summary{{list-style:none;cursor:pointer;padding:12px 14px;display:flex;gap:8px 10px;align-items:baseline;flex-wrap:wrap}}
details.lv summary::-webkit-details-marker{{display:none}}
details.lv summary b{{font:800 16px var(--font)}} .lever{{color:var(--text2);font-size:14px;flex:1;min-width:140px}}
.tag{{font:800 11px var(--font);font-style:normal;letter-spacing:.06em;text-transform:uppercase;border-radius:6px;padding:3px 7px;background:var(--panel2);color:var(--text2)}}
.tag.redesign{{color:var(--amber)}} .tag.keep{{color:var(--green)}}
.ladder{{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:0 14px 4px}}
.ladder div{{background:var(--panel2);border-radius:10px;padding:9px 10px;font-size:14px;line-height:1.35;border-top:3px solid var(--line);min-width:0;overflow-wrap:anywhere}}
.ladder em{{display:block;font:800 11px var(--font);font-style:normal;letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px}}
.ladder .e{{border-color:var(--green)}} .ladder .e em{{color:var(--green)}} .ladder .n{{border-color:var(--blue)}} .ladder .n em{{color:var(--blue)}}
.ladder .h{{border-color:var(--amber)}} .ladder .h em{{color:var(--amber)}} .ladder .x{{border-color:var(--red)}} .ladder .x em{{color:var(--red)}}
.ev{{display:block;margin-top:6px;font:800 10.5px var(--font);letter-spacing:.08em;text-transform:uppercase;color:var(--text3)}} .ev.measured{{color:var(--green)}} .ev.documented{{color:var(--blue)}}
.why,.newm{{padding:0 14px;color:var(--text2);font-size:14px}} .newm b{{color:var(--gold)}}
#lvfind{{width:100%;height:48px;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:var(--text);font:600 16px var(--font);padding:0 14px;margin:10px 0}}
fieldset.dec{{border:1px solid var(--line);border-radius:14px;background:var(--panel);margin:12px 0;padding:10px 14px 12px;min-width:0}}
fieldset.dec legend{{font:800 16px var(--font);padding:0 6px}} fieldset.dec legend b{{color:var(--gold)}}
fieldset.dec p{{color:var(--text2);font-size:14px;margin:2px 0 8px}}
.opts{{display:flex;flex-direction:column;gap:8px}}
.opt{{display:flex;align-items:center;gap:10px;min-height:46px;padding:8px 12px;border-radius:10px;background:var(--panel2);border:1px solid var(--line);cursor:pointer;font:700 15px var(--font)}}
.opt input{{width:20px;height:20px;accent-color:var(--gold);flex:none}} .opt:has(input:checked){{border-color:var(--gold)}}
.opt span{{display:flex;gap:8px;align-items:center;flex-wrap:wrap}}
.copybar{{margin-top:16px}}
button.gold{{width:100%;height:56px;border:0;border-radius:12px;background:linear-gradient(165deg,#FBEDC4,#E6C67E 34%,#D2AC5E 68%,#EED79C);color:var(--gold-ink);font:800 18px var(--font);box-shadow:0 4px 0 #A8843E,0 10px 24px rgba(0,0,0,.5);cursor:pointer}}
button.gold:focus-visible,.opt:focus-within,nav.toc a:focus-visible,summary:focus-visible{{outline:2px solid var(--cyan);outline-offset:2px}}
#answers{{width:100%;min-height:150px;margin-top:10px;border-radius:12px;border:1px solid var(--line);background:var(--panel);color:var(--text);font:500 13px/1.5 var(--mono);padding:10px}}
.files li{{margin:6px 0}} .muted{{color:var(--text3);font-size:14px}}
#zoom{{position:fixed;inset:0;background:rgba(2,3,8,.94);display:flex;align-items:center;justify-content:center;z-index:50;padding:env(safe-area-inset-top,0px) 8px env(safe-area-inset-bottom,0px);cursor:zoom-out}}
#zoom img{{max-width:100%;max-height:100%;border-radius:12px}}
@media (max-width:640px){{ .ladder{{grid-template-columns:1fr 1fr}} h1{{font-size:29px}} .shot{{width:200px}} }}
@media (prefers-reduced-motion:no-preference){{ html{{scroll-behavior:smooth}} }}
</style>
<div class="wrap">
<div class="eyebrow">Joulz · design direction · 20 Nov 2026</div>
<h1>Vivid games in a <b>sleek frame</b></h1>
<p class="lede">The pages keep today’s esports look and get a better structure. The games get brighter. Everything here is a plan and mockups: nothing is built. Tap any picture to enlarge it. Your choices at the bottom copy out as text to paste back to me.</p>
<nav class="toc"><a href="#games">Game art</a><a href="#pages">Pages</a><a href="#mixed">Your mixes</a><a href="#threeway">Three ways</a><a href="#flow">Flow</a><a href="#levels">Difficulty</a><a href="#check">Fact-check</a><a href="#decide">Decided</a><a href="#open">Your picks</a><a href="#template">Reveal template</a><a href="#files">Files</a></nav>

<div class="short"><div class="eyebrow">The short version</div><ul>
<li><b>Games:</b> I recommend direction 4, <b>Spotlight</b>: a lit stage in each category’s deep colour and light matte pieces on the board puzzles. Retro stays dark and glows.</li>
<li><b>Pages:</b> today’s style, refined (look E). One hero and one gold button a page, larger type and tiles, far fewer words.</li>
<li><b>Flow:</b> a new phone’s first tap is inside a game. Tabs become Home · Games · Compete · Shop · You.</li>
<li><b>Difficulty:</b> every game gets one lever you can see in the first seconds, as a four-step ladder. Normal never changes.</li>
<li><b>Levels in the app:</b> one level mark everywhere (a colour and one to four bars), a ladder on each game’s page that shows what changes, and a “next step up” card after a star.</li>
<li><b>Your three built items:</b> Apex’s steering and the desktop Cabinet skeleton still fit as built. The reveal template came off this branch on 21 Nov and is P2’s first job (below).</li>
</ul></div>

<h2 id="games">Games: four art directions</h2>
<p>Each direction is shown on the same seven real screenshots, with today’s header left untouched so you can see how the game sits in the frame. These are quick studies made by re-treating the real picture. The build draws each game properly.</p>
<h4>Today</h4>
{strip([(f"games/{g}-now",n,'now') for g,n in G])}
{''.join(dirsec)}
<div class="rec-box"><div class="eyebrow">My recommendation</div><p><b>Direction 4, Spotlight.</b> The games you like least are the ones with dark pieces on a dark board. The ones that already read well (the card games, Top Bins) have light pieces on a coloured surface, and so does chess.com. Spotlight brings the puzzles into line with them and leaves the frame alone.</p><p>Two exceptions are part of it. Retro keeps its dark screen and takes direction 2’s glow, because neon on black is what Retro is. Games about light on dark (Lamplighter, Lightbender, Chroma Lines) keep a deep-coloured board.</p><p>If you want a smaller first step, pick direction 1. Spotlight is Floodlit plus the new piece sets, so nothing is wasted.</p></div>
<h3>Spotlight, drawn rather than filtered</h3>
<p>Five games with the pieces redrawn in the direction, under today’s real header. This is closer to what a build session would produce.</p>
{strip([('games/wordhunt-now','Forage today','now'),('games/wordhunt-drawn','Forage, drawn',''),('games/sudoku-now','Box Six today','now'),('games/sudoku-drawn','Box Six, drawn',''),('games/target-now','Exact today','now'),('games/target-drawn','Exact, drawn',''),('games/flow-now','Chroma Lines today','now'),('games/flow-drawn','Chroma Lines, drawn',''),('games/matchup-now','Gemstone today','now'),('games/matchup-drawn','Gemstone, drawn','')])}
<h3 id="morefam">Spotlight on more families</h3>
<p>The recommended direction on seven more real screenshots, each beside today, so nine of the eleven families are now shown. Ascend’s discs go ivory on warm wood, Strikeout’s tiles and keys go light, Exact’s number tiles go ivory with the gold target kept, Polypotions sits on a lit teal stage. Iron Wall is a world, so it only gets its colours lifted. Two show the exceptions: Chroma Lines keeps its deep board and only gets the lit stage, and Hover, being Retro, stays dark and glows. These are filters on the real picture, so edges are rough; the build redraws each game.</p>
{strip(MOREFAM)}
<h3>One game across all four</h3>
{''.join(compare)}

<h2 id="pages">Pages: today’s style, refined</h2>
<p>Three looks on the same new layouts. <b>E “Esports, refined”</b> is today’s navy, champagne gold and angled cuts, with feature cards taking colour as an edge light. <b>F “colour-charged”</b> lets the feature cards carry full colour. <b>A “Bright Spark”</b> is the bolder redesign I made before your correction. I recommend E.</p>
<h3 id="kit">The look on one board</h3>
<p>The whole kit the build sessions work from: the navy frame, the one gold action, Archivo, the cut corner for heroes only, the family colours, the level marks, tiles, nameplates and the lit game stage. Six rules sit at the bottom.</p>
{strip([('pages/kit-board','The look on one board','board')])}
{''.join(pages)}
<h3 id="room">A game in play, the intro and the room</h3>
<p>The frame round a game: its name, the level mark, the round, your score and place, and the timer as a gold bar. The two frames are real screenshots under the new header (Box Six in Spotlight, Breaker kept neon). Then the short intro (15 words, one gold button), the lobby, the reveal and the final screen.</p>
{strip([('pages/frame-spotlight-phone','In play · Box Six, Spotlight',''),('pages/frame-neon-phone','In play · Breaker, neon',''),('pages/intro-e-phone','Round intro',''),('pages/reveal-e-phone','Reveal',''),('pages/lobby-e-phone','Room lobby',''),('pages/podium-e-phone','Final screen','')])}
<h3 id="navy">The navy change, on the real app</h3>
<p>These are real screenshots of today’s app, each beside the same screen with only the eight navy token values changed. Nothing else is touched. The difference is small on purpose: panels sit a little bluer and separate from the page a little better. It reads as today’s style, so I have kept it in the plan. If you can’t see a gain worth having, say so and it drops out at no other cost.</p>
{strip([('pages/home-now-phone','Home · today','now'),('pages/home-navy-phone','Home · navy values',''),('pages/games-now-phone','Games · today','now'),('pages/games-navy-phone','Games · navy values',''),('pages/shop-now-phone','Shop · today','now'),('pages/shop-navy-phone','Shop · navy values','')])}
{strip([('pages/home-now-desktop','Home on a computer · today','now wide'),('pages/home-navy-desktop','Home on a computer · navy values','wide')])}

<h3 id="more">More layouts: Home, Compete and You</h3>
<p>Extra designs with different structures, colours and features, all inside the esports style. Three colourways appear: <b>champagne</b> (today’s), <b>Ion</b> (navy with electric cyan) and <b>Ember</b> (carbon with a magenta-to-orange accent). Gold stays the one action colour in all of them.</p>
<h4>Home</h4>
<p><b>H1 Hero</b> is one hero and one gold button. <b>H2 Match day</b> opens on a live strip and your player banner, with today as a timeline. <b>H3 Deck</b> is a console-style grid of mode tiles. I recommend H1 for launch because it works for every player; H2 has the best competitive feel and is the one to move to when rated play is open to everyone.</p>
{strip([('pages/home-e-phone','H1 · Hero · champagne',''),('pages/home2-e-phone','H2 · Match day · champagne',''),('pages/home2-g-phone','H2 · Match day · Ion',''),('pages/home3-e-phone','H3 · Deck · champagne',''),('pages/home3-h-phone','H3 · Deck · Ember','')])}
<h4>Compete (a new page: your rating, tournaments and leaderboards in one place)</h4>
<p><b>C1 Ladder</b> puts your tier and rating first, then the boards. <b>C2 Fixtures</b> leads with what is live and today’s events. <b>C3 Season</b> shows the tier ladder with you on it and the rivals either side. I recommend C1: it is never empty, even with tournaments off. C2 and C3 suit later, as tournaments and seasons open.</p>
{strip([('pages/compete1-e-phone','C1 · Ladder · champagne',''),('pages/compete1-g-phone','C1 · Ladder · Ion',''),('pages/compete2-e-phone','C2 · Fixtures · champagne',''),('pages/compete2-h-phone','C2 · Fixtures · Ember',''),('pages/compete3-e-phone','C3 · Season · champagne',''),('pages/compete3-g-phone','C3 · Season · Ion','')])}
<h4>The Daily and a tournament</h4>
<p>Two pages inside Compete, in the same kit: the Daily with today’s six games on show and your week as a row of stars, and a live Arena with your points and place first and one gold button.</p>
{strip([('pages/daily-e-phone','Daily',''),('pages/event-e-phone','A tournament, live','')])}
<h4>The rest of the pages</h4>
<p>The Season pass, Customise, a leaderboard, Friends and Settings in the same kit. One gold button on each, at most.</p>
{strip([('pages/pass-e-phone','Pass',''),('pages/customise-e-phone','Customise',''),('pages/leaderboard-e-phone','Leaderboard',''),('pages/friends-e-phone','Friends',''),('pages/settings-e-phone','Settings','')])}
<h4>You</h4>
<p><b>Y1 Rows</b> is the card, the rating, three stats and rows. <b>Y2 Card first</b> makes the player card the page, with your strongest categories and recent form. <b>Y3 Career</b> is ring gauges and a trophy shelf. I recommend Y2: the page is about identity, and the card is the identity.</p>
{strip([('pages/profile-e-phone','Y1 · Rows · champagne',''),('pages/profile2-e-phone','Y2 · Card first · champagne',''),('pages/profile2-h-phone','Y2 · Card first · Ember',''),('pages/profile3-e-phone','Y3 · Career · champagne',''),('pages/profile3-g-phone','Y3 · Career · Ion','')])}

<h3>Two open layout choices</h3>
{strip([('pages/home-e-phone','N1 · five tabs, the hero plays',''),('pages/home-e2-phone','N2 · centre Play button',''),('pages/games-e-phone','G1 · shelves',''),('pages/games-e2-phone','G2 · three-across grid','')])}
<h3>On a computer</h3>
{''.join(desk)}

<h2 id="mixed">Your mixes, drawn</h2>
<p>Each screen you mixed on 20 Nov, drawn beside the originals it came from.</p>
<h3>Home: H1 and H2 combined</h3>
<p>H1’s top line, H2’s player banner with the rating large, your other two ratings as chips under it, the two Dailies, Play friends, then Jump back in. Nothing is shown twice. The banner has three states of one height.</p>
{strip([('pages/home-e-phone','H1 · original',''),('pages/home2-e-phone','H2 · original',''),('pages/home-mixed-phone','Your mix · placed',''),('pages/home-mixed-unplaced-phone','Your mix · open, unplaced',''),('pages/home-mixed-open-phone','Your mix · rated play not on','')])}
{strip([('pages/home-e-desktop','Desktop Home · original','wide'),('pages/home-mixed-desktop','Desktop Home · your mix, with the fuller rail','wide')])}
<h3>Compete: C1, reordered</h3>
<p>Rating, tier and Find a match first. Then tournaments: the live event as a card, then the fixtures. Leaderboards sit lower as tabs, with the Daily top 100 as one of them.</p>
{strip([('pages/compete1-e-phone','C1 · original',''),('pages/compete2-e-phone','C2 · original',''),('pages/compete-mixed-phone','Your mix','')])}
<h3>You: Y2 with Y3’s gauges and trophy shelf</h3>
{strip([('pages/profile2-e-phone','Y2 · original',''),('pages/profile3-e-phone','Y3 · original',''),('pages/you-mixed-phone','Your mix','')])}
<h3>A game’s page: L1 and L2 combined</h3>
<p>The page opens on your current level, shown large. The four levels sit under it as a compact row, each with its small picture, your best and your star. Challenges and How to play are two small buttons.</p>
{strip([('pages/levels1-e-phone','L1 · original',''),('pages/levels2-e-phone','L2 · original',''),('pages/gamepage-mixed-phone','Your mix','')])}
<h3>Games: shelves, with a switch to All</h3>
{strip([('pages/games-e-phone','G1 · original',''),('pages/games-e2-phone','G2 · original',''),('pages/games-mixed-phone','Your mix · Shelves (default)',''),('pages/games-mixed-all-phone','Your mix · All','')])}

<h2 id="threeway">Four games, three ways</h2>
<p>On 20 Nov you asked for the old look of Pipeline, Chroma Lines, Topsy-Turvy and Ballpark, and my plan re-rendered them in Spotlight instead. Here is each one as it was at 82f2f648, as it is today, and in Spotlight, and you picked the old look for all four on 20 Nov (Pipeline with the bigger pipes). The Spotlight versions are filters on today’s picture, so their edges are rough.</p>
{threeway()}

<h2 id="flow">Flow: a first game in seconds</h2>
<p>Today a new player sees Home, a loading screen and a full intro before the first tap inside a game. In the plan the splash leads straight to a first game, and the first tap is the game’s first tap.</p>
<h3 id="flowboard">The whole app on one sheet</h3>
<p>Four journeys (a new phone, a practice game, a ranked match, a friends’ room) and the pages around them, all drawn in one kit. The number under each arrow is the taps it takes. Tap the sheet to enlarge it.</p>
{strip([('pages/flow-board','The whole app on one sheet','board')])}
{strip([('pages/first1-e-phone','1 · The bolt charges',''),('pages/first2-e-phone','2 · The first game: tap 1, 2, 3…',''),('pages/first3-e-phone','3 · A first win, then Home',''),('pages/intro-now-phone','Today’s intro, for contrast','now')])}
<p class="muted">Frame 2 is a flow sketch. The game itself is drawn in the art direction you pick.</p>
<div class="tbl"><table><tr><th>Journey</th><th>Today</th><th>Plan</th></tr>
<tr><td>Taps before the first tap inside a game (new phone)</td><td class="tnum">2</td><td class="tnum"><b>0</b></td></tr>
<tr><td>Home to a game</td><td class="tnum">2</td><td class="tnum"><b>1</b></td></tr>
<tr><td>Join a friend’s room with a code</td><td class="tnum">3</td><td class="tnum"><b>1</b></td></tr>
<tr><td>Round intro, words to read</td><td class="tnum">59 average</td><td class="tnum"><b>15</b></td></tr>
<tr><td>A game’s page, words</td><td class="tnum">90–130</td><td class="tnum"><b>40</b></td></tr>
<tr><td>Help sheet, words</td><td class="tnum">252 average</td><td class="tnum"><b>120</b></td></tr>
<tr><td>Ways home from the rated result and the Daily result</td><td class="tnum">none</td><td><b>a Home button</b></td></tr>
<tr><td>Tabs with nothing to do for most players</td><td>Tournaments</td><td><b>none</b></td></tr></table></div>
<p>Tabs: <b>Home · Games · Compete · Shop · You.</b> Compete holds your rating, tournaments, leaderboards and the Daily top 100, so it is never empty. You is Profile and More in one. The floating Play bar goes, because Home’s hero does its job.</p>

<h2 id="levels">Difficulty: one lever you can see</h2>
<p>Every game gets one headline lever a player sees in the first three seconds, and Easy, Normal, Hard and Expert sit on it as one ladder. Normal is today’s game and never changes. Hard and Expert never add an aid. Expert is proven reachable at 200 by the best humans.</p>
<p class="muted">Of 83 games: {sum(g['change']=='keep' for g in allg)} kept, {sum(g['change']=='retune' for g in allg)} retuned, {sum(g['change']=='redesign' for g in allg)} redesigned, 5 with one new mechanic. The commonest fault today is that Hard looks the same as Normal. Tap a game for its ladder; the full numbers, proofs and files are in the spec.</p>
<h3 id="lvui">How the levels look in the app</h3>
<p>One <b>level mark</b> everywhere: a colour and one to four bars, so it never relies on colour alone. It sits on the game’s page, in the header during play, on the reveal and in room settings.</p>
<p><b>L1 Ladder</b> lists the four levels on the game’s page, each with a small picture of what changes and your best. <b>L2 Preview</b> shows one level large with the lever as a row of numbers. <b>L3 Step up</b> is the card on the reveal after a star: Normal beside Hard, and one line saying what is new. I recommend L1 with L3.</p>
{strip([('pages/levels1-e-phone','L1 · Ladder (Breaker)',''),('pages/levels2-e-phone','L2 · Preview (Box Six)',''),('pages/levels3-e-phone','L3 · Step up, on the reveal','')])}
{strip([('pages/levels-e-desktop','L1 on a computer: the four levels side by side','wide')])}
<h3 id="pictures">You can see the step before you play</h3>
<p>Eight ladders drawn as pictures of what the screen shows as the round opens: Breaker’s wall and paddle, Box Six’s given numbers, Ascend’s discs, Meteor’s rocks and walls, Top Bins’ wall and wind, Iron Wall’s lanes and tanks, Tempo’s lanes, Mahjong’s stack. They are drawn from the level numbers in the spec, and they are the small pictures the ladder on a game’s page would use.</p>
{strip([('pages/pictures-board','Eight ladders as pictures','board')])}
<h3 id="ladders">What each step up looks like</h3>
<p>Twelve of the 83 ladders on one sheet: one from each family, and the five new mechanics. The gold line under each name is the game’s one lever. The small label on each level says whether its numbers were measured in this pass, come from the repo’s documents, or are not measured yet.</p>
{strip([('pages/ladders-sheet','Twelve ladders','board')])}
<h3>Every game</h3>
<input id="lvfind" type="search" placeholder="Find a game" aria-label="Find a game">
<div class="chips" id="lvfilter"><button type="button" data-f="all" aria-pressed="true">All 83</button><button type="button" data-f="adjusted" aria-pressed="false">Changed by the check</button><button type="button" data-f="unproven" aria-pressed="false">Still to prove</button><button type="button" data-f="holds" aria-pressed="false">Holds</button><button type="button" data-f="new" aria-pressed="false">New mechanic</button></div>
{famnav()}
<div id="lvlist">
{levels()}
</div>

<h2 id="check">Fact-check</h2>
<p>Before anything is built I checked my own work with the repo’s tools. In short: two of my four big claims held, one was half right and one was wrong as I wrote it. The plan and the spec are corrected.</p>
<div class="fcs"><div class="fc"><div class="q">Counterweight, Brimful, Checkout and Kakuro: the old game as Hard looks and scores like Normal</div><p>96 deals a game, the same deals at both levels. The first board is the same on all four. But a good player drops 24, 87, 37 and 61 points, and an average player 70 on Counterweight.</p><p class="v"><b>Half right.</b> It looks like Normal. It does not score like Normal.</p></div><div class="fc"><div class="q">Iron Wall’s Expert needs the fourth lane</div><p>60 seeds a level. Hard and Expert put the same tanks on the same lanes at the same moments, every time. An average player scores 104 and 84. A faster pace alone changes neither the look nor the gap. The lane itself can’t be measured until it is built.</p><p class="v"><b>The reason holds.</b></p></div><div class="fc"><div class="q">No proof tool applies the human limits today</div><p>Several do: the level tuning tool, the Home Run and Top Bins proof, and nine level checks.</p><p class="v"><b>Wrong as written.</b> True only for most deal builders’ 200 proofs.</p></div><div class="fc"><div class="q">Flash and Bonk cap a perfect human at about 130 and 160</div><p>Flash at exactly 0.25 s a flash: 130 at all four levels. Bonk at the limits: 156 (153 on Expert). 100 deals a level.</p><p class="v"><b>Holds.</b> It is the scoring curve, not the level.</p></div></div>
<p>Every level of every game now says what it rests on. Of the 249 Easy, Hard and Expert rows: <b>{factcounts()[0]["measured"]}</b> measured in this pass, <b>{factcounts()[0]["documented"]}</b> taken from the repo’s documents (today’s level, kept), <b>{factcounts()[0]["not measured"]}</b> not measured yet (they need a board size, a bank or a mechanic that doesn’t exist until it is built). By game: <b>{factcounts()[1]["holds"]}</b> hold as proposed, <b>{factcounts()[1]["adjusted"]}</b> were changed because a measurement contradicted them, <b>{factcounts()[1]["unproven"]}</b> have a risky part that stays unproven until its session builds the proof.</p>
<details class="lv"><summary><b>The rows I changed</b><span class="lever">what the measurement showed</span></summary><ul class="adj">
{adjusted()}
</ul></details>
<p class="muted">Also re-checked: all 203 rows of the assertion list against the files (3 line numbers corrected), every plan row against the prompts (each built by exactly one), and the standing rules in all 14 prompts (identical).</p>

<h2 id="decide">Decided, 20 Nov 2026</h2>
<p>Your answers are recorded here and in the plan’s section 2.1. Seventeen are as I recommended; seven you changed or mixed, and the mixed screens are drawn above. Under each answer is my original note; three of those notes were stale and are corrected (the four Number games’ Hard, the proof tools, Minefield’s mines).</p>
{decisions()}
<h3>Your additions</h3>
<ul class="adds">
<li><b>Three stamps come back, in D5:</b> Moon Climb’s smaller ninja (ricoRev 5), Fission’s smaller atoms (burstRev 14), Wavefront’s wider formation (wavRev 16), with their assertion rows and demo re-records.</li>
<li><b>The seven approved scoring fixes are built on Normal too</b>, each under a new stamp, in the session that owns the game, with Normal’s caps for Flash, Bonk and Pull!. I6 and I9 stay “leave it”.</li>
<li><b>The desktop rail</b> also gets Badges, Notifications, Leaderboards and the Daily (drawn on the desktop Home above).</li>
<li><b>Keyboard controls in every game on a computer</b>, shown on the intro. Eighteen of the 83 games have no keys today; P4 maps them and P2 shows the key line.</li>
<li><b>Grappler and Curl Champ:</b> D5 and D6 each propose a working lever to you before building those two.</li>
<li><b>Pipeline, Chroma Lines, Topsy-Turvy and Ballpark</b> are shown three ways above: old, today, Spotlight. Your picks are below: the old look for all four.</li>
</ul>
<h3 id="open">Your five picks and the check line, 20 Nov 2026</h3>
<div class="done agreed"><div class="dq"><b>A.</b> The first game on a new phone<i class="tag v-holds">picked</i></div><p class="da">Ascend on Easy.</p></div>
<div class="done changed"><div class="dq"><b>B.</b> Pipeline’s look<i class="tag v-adjusted">picked</i></div><p class="da">The old look, with the bigger pipes.</p><p class="dn">The old pipes and lit network, drawn at today’s tile and pipe size. Built by A2 as the earlier plan’s E1.4.</p></div>
<div class="done changed"><div class="dq"><b>C.</b> Chroma Lines’ look<i class="tag v-adjusted">picked</i></div><p class="da">The old look. “I don’t like the new circles; the old ones are much better.”</p><p class="dn">Built by A2 as the earlier plan’s E1.3, old dots included.</p></div>
<div class="done changed"><div class="dq"><b>D.</b> Topsy-Turvy’s look<i class="tag v-adjusted">picked</i></div><p class="da">The old look. “I don’t like the new circle designs.”</p><p class="dn">Built by A2 as the earlier plan’s E1.2.</p></div>
<div class="done changed"><div class="dq"><b>E.</b> Ballpark’s look<i class="tag v-adjusted">picked</i></div><p class="da">The old look.</p><p class="dn">Built by A1 as the earlier plan’s E1.5.</p></div>
<div class="done changed"><div class="dq"><b>F.</b> The reveal template’s one check line<i class="tag v-adjusted">no longer applies</i></div><p class="da">Approved on 20 Nov; withdrawn with the template on 21 Nov.</p><p class="dn">The line is back to main’s text. P2 shows it to you again when it builds the template.</p></div>
<p>All four restores keep today’s rules, levels, effects and every data attribute, and the boards sit on the new lit stage.</p>
<h3 id="template">The reveal template, 21 Nov 2026</h3>
<div class="done changed"><div class="dq"><b>G.</b> The reveal template<i class="tag v-adjusted">decided</i></div><p class="da">Off this branch. P2 builds it as its first job.</p><p class="dn">Its files are back to main’s text, the skyline check line included. The three Grappler check lines are not applied. Apex’s steering and the Cabinet skeleton are untouched.</p></div>
<p>Why: on phones the template’s stage was a fixed box that could not scroll, so the run picture was cut off. Six practice reveals at 375 × 667:</p>
{strip([('pages/reveal-cut-375x667','The first version at 375 × 667: each run picture stops at the box','board')])}
<div class="tbl"><table><tr><th>Game</th><th>Hidden at 375 × 667</th><th>Hidden at 390 × 844</th></tr>
<tr><td>Crazy Golf</td><td>531 px</td><td>443 px</td></tr>
<tr><td>Iron Wall</td><td>269 px</td><td>141 px</td></tr>
<tr><td>Free Cell</td><td>245 px</td><td>129 px</td></tr>
<tr><td>Grappler</td><td>182 px</td><td>50 px</td></tr>
<tr><td>Orbit</td><td>178 px</td><td>67 px</td></tr>
<tr><td>Moon Climb</td><td>169 px</td><td>23 px</td></tr>
<tr><td>Apex</td><td>129 px</td><td>none</td></tr>
<tr><td>High Rise</td><td>31 px</td><td>none</td></tr>
<tr><td>Roofbound</td><td>30 px</td><td>none</td></tr>
<tr><td>Meteor, Hover, Gemstone, Tilt, Coral Pop</td><td>none</td><td>none</td></tr></table></div>
<p>P2’s fix list:</p>
<ul class="adds">
<li><b>(a)</b> The stage never cuts a run picture at any phone size: the picture fits the box, or the slot scrolls. All 14 games above measured in a real browser at 375 × 667 and 390 × 844, with none hidden.</li>
<li><b>(b)</b> The reveal150 entry in celebrations-off.json re-recorded, with your approval in that session.</li>
<li><b>(c)</b> The Crazy Golf reveal screen taps “Your run” first, with your approval.</li>
<li><b>(d)</b> The room screens named “with the run summary” or “the overhaul’s picture” still look at the picture.</li>
<li><b>(e)</b> The swing-overhaul-check and skyline-overhaul-check lines shown to you there, with the real measured widths.</li>
</ul>
<p>A1, A2 and A3 build their reveal rows (G2 to G7) only after P2’s template has merged. The rest of their art does not wait.</p>
<h3>Still to come to you</h3>
<ul class="adds"><li><b>Grappler and Curl Champ:</b> D5 and D6 each bring you a working lever, with numbers, before building those two.</li><li><b>Keys for five pointer games</b> (Ascend, Bonk, Pull!, Flash, Cue Ball): P4 proposes them.</li><li><b>The reveal template’s check lines:</b> P2 brings you the Grappler and High Rise check lines, the reveal150 re-record and the Crazy Golf screen’s tap, each for your approval.</li></ul>
<div class="copybar" hidden><button class="gold" id="copy" type="button">Copy my answers</button></div>
<textarea id="answers" readonly aria-label="Your answers as text" hidden></textarea>
<p class="muted" id="copied" hidden>Copied. Paste it into the chat.</p>

<h2 id="files">What was written, and where</h2>
<ul class="files">
<li><b>The plan</b>: <code>docs/polish-plan-final.md</code> (the direction, every page and game, the flow map, the sessions).</li>
<li><b>The difficulty spec</b>: <code>docs/polish-plan-final/difficulty-spec.md</code> and its data in <code>difficulty/</code>.</li>
<li><b>Check assertions the plan would change</b>, with exact lines: <code>docs/polish-plan-final/assertions.md</code>. You approve each one in the session that builds it.</li>
<li><b>Fourteen build prompts</b>, paste-ready, each with the standing rules: <code>docs/polish-plan-final/prompts/</code>.</li>
<li><b>Today’s pages and flows, read from the code</b>: <code>direction/pages-flow-today.md</code>.</li>
<li><b>The earlier plan</b>, kept because its rows are carried by id: <code>earlier-plan.md</code>.</li>
</ul>
<h3>Your three built items</h3>
<div class="tbl"><table><tr><th>Item</th><th>Still fits?</th></tr>
<tr><td>Apex’s steering fix</td><td><b>Yes, unchanged.</b> A plain bug fix.</td></tr>
<tr><td>The reveal template</td><td><b>Not as built.</b> It cut run pictures off on phones, so it came off this branch on 21 Nov. P2 builds it as its first job, with the fix list above.</td></tr>
<tr><td>The desktop Cabinet skeleton</td><td><b>Yes.</b> Still the desktop answer for arcade games. It stays switched off until the desktop session fills it.</td></tr></table></div>
</div>
<div id="zoom" hidden><img alt=""></div>
<script>
(function(){{
  var zoom=document.getElementById('zoom'), zi=zoom.querySelector('img');
  document.addEventListener('click',function(e){{
    var t=e.target;
    if(t.tagName==='IMG'&&t.closest('.shot')){{zi.src=t.src;zi.alt=t.alt;zoom.hidden=false;}}
    else if(t===zoom||t===zi){{zoom.hidden=true;}}
  }});
  document.addEventListener('keydown',function(e){{if(e.key==='Escape')zoom.hidden=true;}});
  var find=document.getElementById('lvfind');
  find.addEventListener('input',function(){{
    var q=find.value.trim().toLowerCase();
    applyLv();
  }});
  var lvf='all';
  function applyLv(){{
    var q=find.value.trim().toLowerCase();
    document.querySelectorAll('#lvlist article.lv').forEach(function(d){{
      var okq=q===''||d.getAttribute('data-name').indexOf(q)>=0;
      var okf=lvf==='all'||(lvf==='new'?d.getAttribute('data-new')==='1':d.getAttribute('data-v')===lvf);
      d.hidden=!(okq&&okf);
    }});
    document.querySelectorAll('#lvlist .fam').forEach(function(h){{h.hidden=q!==''||lvf!=='all';}});
  }}
  document.querySelectorAll('#lvfilter button').forEach(function(b){{b.addEventListener('click',function(){{
    lvf=b.getAttribute('data-f');
    document.querySelectorAll('#lvfilter button').forEach(function(x){{x.setAttribute('aria-pressed',x===b?'true':'false');}});
    applyLv();
  }});}});
  var KEY='joulz-direction-answers';
  try{{var saved=JSON.parse(localStorage.getItem(KEY)||'{{}}');Object.keys(saved).forEach(function(id){{var el=document.getElementById(id);if(el)el.checked=true;}});}}catch(e){{}}
  document.querySelectorAll('.dec input').forEach(function(i){{i.addEventListener('change',function(){{
    try{{var s={{}};document.querySelectorAll('.dec input:checked').forEach(function(c){{s[c.id]=1;}});localStorage.setItem(KEY,JSON.stringify(s));}}catch(e){{}}
  }});}});
  document.getElementById('copy').addEventListener('click',function(){{
    var lines=['My answers on the Joulz design direction:'];
    document.querySelectorAll('.dec').forEach(function(f,i){{var c=f.querySelector('input:checked');lines.push((i+1)+'. '+f.dataset.q+': '+(c?c.value:'no answer'));}});
    var text=lines.join('\\n'), box=document.getElementById('answers'), note=document.getElementById('copied');
    box.value=text;box.hidden=false;
    function done(){{note.hidden=false;}}
    function fallback(){{box.focus();box.select();note.textContent='Select the text above and copy it.';note.hidden=false;}}
    if(navigator.clipboard&&navigator.clipboard.writeText){{navigator.clipboard.writeText(text).then(done,fallback);}}else{{fallback();}}
  }});
}})();
</script>
'''
open(R+'review.html','w').write(page)
print(len(page)//1000,'KB')
