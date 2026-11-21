# Writes (or rewrites) the "overall result" paragraph of the plan's section 8.1 from difficulty/*.json.
import json, glob, re
R='/home/user/brain-blitz-duel/docs/'
lab={'measured':0,'documented':0,'not measured':0}; ver={'holds':0,'adjusted':0,'unproven':0}; lim=0
for f in sorted(glob.glob(R+'polish-plan-final/difficulty/*.json')):
    for g in json.load(open(f,encoding='utf8')):
        for l in ('easy','hard','expert'):
            e=g['evidence'][l].strip().lower()
            lab['measured' if e.startswith('measured') else 'documented' if e.startswith('documented') else 'not measured']+=1
        ver[g['verdict'].split(':')[0].strip().lower()]+=1
        if g['limitsToday'].strip().lower().startswith('nothing'): lim+=1
para=f"""<!-- overall-result -->
**The overall result.** Of the 249 Easy, Hard and Expert rows, {lab['measured']} were measured in this pass, {lab['documented']} come from the repo's documents (today's level, kept) and {lab['not measured']} are not measured yet, because they need a board size, a bank or a mechanic that does not exist until it is built. By game: {ver['holds']} hold as proposed, {ver['adjusted']} were changed because a measurement contradicted them, and {ver['unproven']} keep a risky part unproven until their session builds the proof. Three things showed across the board:

1. **The commonest fault was a step too small to matter**, and the fix was a bigger move of the same lever: Blockzone's Hard from twice to four times Normal's pace, High Rise's blocks from 150 and 110 px to 110 and 50, Rally's Hard paddle from 88 to 72 px, Minefield's Expert from 36 to 40 mines, Tally's and Matchmaker's clocks.
2. **The repo's bots and kits cannot feel some of the levers a player sees**: a paddle's width (Breaker, Rally), the shortest word that counts (Nucleus, Forage), and any board size the code cannot deal yet (Interlock, Slider, Cryptogrid, Trail, Gridlock's 9 × 9). Those steps stay unproven until the session writes a player that can feel them, or people confirm them. A row marked measured is not a row marked proven: the verdict line says which.
3. **200 under the human limits is rare today.** In the arcade families the elite bot under the limits reaches 200 on Expert in only a few games, and in several it does not reach 200 on Normal either, which is a ceiling of the bot or of the scoring (Flash 130, Bonk 156), not of the level. Nothing applies the limits to {lim} of the 83 games at all. So each difficulty session's first job is its proof under the limits, before any number is tuned.
<!-- /overall-result -->
"""
p=R+'polish-plan-final.md'; s=open(p,encoding='utf8').read()
ch={'keep':0,'retune':0,'redesign':0}
for f in sorted(glob.glob(R+'polish-plan-final/difficulty/*.json')):
    for g in json.load(open(f,encoding='utf8')): ch[g['change']]+=1
s=re.sub(r'Normal untouched, \d+ games? kept, \d+ retuned, \d+ redesigned,', f"Normal untouched, {ch['keep']} kept, {ch['retune']} retuned, {ch['redesign']} redesigned,", s)
if '<!-- overall-result -->' in s:
    s=re.sub(r'<!-- overall-result -->.*?<!-- /overall-result -->\n',para,s,flags=re.S)
else:
    a="Each of the 83 rows in the spec now carries an **Evidence** line"
    assert a in s
    s=s.replace(a,para+"\n"+a,1)
open(p,'w',encoding='utf8').write(s)
print(lab,ver,lim)
