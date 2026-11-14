// Structure wireframes of the references each mockup answers. Redrawn as labelled boxes (no third-party pixels,
// no personal photos): the layout is the point.
const css = `*{box-sizing:border-box;margin:0}body{background:#141210;font-family:Archivo,sans-serif}
.f{background:#2B2926;position:relative;overflow:hidden;color:#CFC9C0}
.b{position:absolute;background:#3D3A36;border-radius:8px;display:flex;align-items:center;justify-content:center;text-align:center;font:600 13px/17px Archivo,sans-serif;color:#CFC9C0;padding:4px}
.g{background:#5E9B3F;color:#fff;font-weight:800}
.lab{position:absolute;left:0;right:0;top:0;height:40px;background:#1B1917;color:#fff;font:800 14px Archivo,sans-serif;display:flex;align-items:center;padding:0 14px}`;
const box = (x, y, w, h, t, cls = '') => `<div class="b ${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px">${t}</div>`;
const page = (w, h, label, inner, font) => `<!doctype html><meta charset="utf-8"><style>@font-face{font-family:Archivo;src:url(${font}) format('woff2');font-weight:100 900}${css}</style>
<div id="frame" class="f" style="width:${w}px;height:${h}px"><div class="lab">${label}</div>${inner}</div>`;

export const REFS = {
  'home-phone': [390, 844, 'Reference: chess.com Home (phone)', () => [
    box(16, 56, 40, 40, 'You'), box(64, 62, 50, 28, 'Streak'), box(278, 62, 40, 28, 'Gem'), box(326, 62, 48, 28, 'Friends'),
    box(16, 108, 270, 140, 'Hero card: Puzzles<br>illustration, progress, Solve!'), box(296, 108, 94, 140, 'Next card<br>(peeks)'),
    box(16, 266, 200, 22, 'Recommended Match'), box(16, 296, 358, 76, 'Opponent row: picture, name, rating, Friend tag, Challenge'),
    box(16, 392, 120, 22, 'Stats'), box(16, 422, 105, 92, 'Rating tile'), box(129, 422, 105, 92, 'Rating tile'), box(242, 422, 105, 92, 'Rating tile'), box(355, 422, 35, 92, ''),
    box(16, 534, 120, 22, 'Friends'), box(16, 564, 140, 120, 'Friend card'), box(166, 564, 140, 120, 'Friend card'), box(316, 564, 74, 120, ''),
    box(16, 698, 358, 52, 'Play (sticky)', 'g'), box(0, 762, 390, 82, 'Tabs: Home · Puzzles · Learn · Watch · More'),
  ]],
  'play-phone': [390, 844, 'Reference: chess.com Play (phone)', () => [
    box(16, 56, 358, 40, 'Back · Play'), box(130, 104, 130, 100, 'One illustration<br>(hand and pawn)'),
    box(16, 220, 358, 52, 'Time selector ▾ (opens Choose Time sheet)'), box(16, 284, 358, 52, 'Start Game', 'g'),
    box(16, 350, 358, 48, 'Tournaments (icon)'), box(16, 406, 358, 48, 'Play a Friend (icon)'), box(16, 462, 358, 48, 'Play Bots (icon)'), box(16, 518, 358, 48, 'Play Coach (icon)'),
    box(140, 580, 110, 30, 'More ▾'), box(0, 762, 390, 82, 'Tabs'),
  ]],
  'game-phone': [390, 844, 'Reference: 8 Ball Pool (game screen)', () => [
    box(16, 56, 358, 54, 'Top strip: players, avatars, ball groups, stake in the middle'),
    box(16, 120, 24, 520, 'Power'), box(48, 120, 296, 520, 'The table: dominant, edge to edge'), box(350, 120, 24, 520, 'Balls'),
    box(110, 340, 170, 46, '“You Win!” over the table'), box(190, 660, 184, 46, 'Quiet award toast'), box(16, 660, 60, 46, 'Menu'),
  ]],
  'home-desktop': [1440, 900, 'Reference: chess.com Home (desktop structure)', () => [
    box(0, 40, 200, 860, 'Left rail with labels:<br>Play · Puzzles · Learn · Watch · News · Social · More<br><br>Sign-in / profile at the bottom'),
    box(230, 70, 760, 220, 'Hero row: Play, Daily, Puzzles cards with illustrations'), box(230, 310, 760, 140, 'Recommended match / Continue'),
    box(230, 470, 760, 180, 'Rating tiles and stats'), box(230, 670, 760, 200, 'Feed / lessons'),
    box(1020, 70, 390, 360, 'Right column: friends, streak, challenges'), box(1020, 450, 390, 420, 'Right column: events, clubs'),
  ]],
  'play-desktop': [1440, 900, 'Reference: chess.com Play (desktop structure)', () => [
    box(0, 40, 200, 860, 'Left rail'), box(230, 60, 780, 820, 'The board, large, with players above and below'),
    box(1040, 60, 370, 70, 'Time selector ▾'), box(1040, 146, 370, 64, 'Play', 'g'),
    box(1040, 230, 370, 56, 'Mode: Tournaments'), box(1040, 296, 370, 56, 'Mode: Play a Friend'), box(1040, 362, 370, 56, 'Mode: Bots'), box(1040, 428, 370, 56, 'Mode: Coach'),
    box(1040, 504, 370, 360, 'Games in progress / history'),
  ]],
  'game-desktop': [1440, 900, 'Reference: 8 Ball Pool and chess.com game (desktop structure)', () => [
    box(0, 40, 76, 860, 'Slim rail'), box(110, 60, 900, 60, 'Players and stake above the play area'), box(110, 130, 900, 560, 'Play area, dominant; win moment drawn over it'),
    box(110, 700, 900, 60, 'Ball groups'), box(110, 800, 360, 70, 'Quiet award toast'), box(1040, 60, 370, 810, 'Match panel: score, rating change, Next match'),
  ]],
};
export const refPage = (k, font) => { const [w, h, l, f] = REFS[k]; return page(w, h, l, f().join(''), font); };
