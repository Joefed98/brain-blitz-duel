// The Joulz art kit for round 2: every scene, its camera and its colours. One material (gloss), one key light
// from the top left. Scenes are defined in ../../directions/source/art.html.
// Art gold is a richer metal than the UI's champagne so it reads as gold under the gloss.
const GOLD = '#EDB43E', GOLD_HI = '#F3DDA6', INK = '#121218', CREAM = '#F4EFE6', NAVY = '#2A3558', BLUE = '#4D8CFF',
  RED = '#E8473F', GREEN = '#3DDC84', ORANGE = '#FF8A3D', VIOLET = '#8E80FF', PINK = '#FF6BD6', TEAL = '#2ED3B7', SILVER = '#C9D3EA', BRONZE = '#D9A066';
const i = (scene, cols, cam = {}) => ({ scene, cols, yaw: 0.45, pitch: 0.1, zoom: 1.32, ground: -1.1, ...cam });
export const ICONS = {
  // tab bar
  home: i(17, [GOLD, CREAM, NAVY, RED], { yaw: 0.5, pitch: -0.18, ground: -0.95 }),
  games: i(7, [GOLD, NAVY, SILVER, RED, BLUE], { yaw: 0.55, pitch: -0.32, zoom: 1.3, ground: -1.05 }),
  shop: i(18, [ORANGE, , NAVY, , , INK], { yaw: 0.4, pitch: -0.08, ground: -0.92 }),
  profile: i(19, [BLUE, , , , '#9CC0FF'], { yaw: 0.3, ground: -0.97 }),
  more: i(20, [GOLD, , , BLUE, GREEN, PINK], { yaw: 0.45, pitch: -0.15, ground: -0.9 }),
  // play modes and Home
  joules: i(0, [GOLD], { zoom: 1.35, ground: -1.15 }),
  rated: i(13, [GOLD, , , BLUE]),
  arena: i(2, [ORANGE, CREAM, INK, RED], { yaw: 0.4, pitch: 0.12 }),
  rooms: i(5, [BLUE, , , ORANGE, '#9CC0FF', '#FFB877'], { yaw: 0.3, zoom: 1.3 }),
  practice: i(3, [GOLD, CREAM, INK, RED], { yaw: 0.5, zoom: 1.3 }),
  daily: i(4, [GREEN, CREAM, '#6A7392', RED, '#DCE1EC'], { yaw: 0.45, pitch: 0.12 }),
  puzzles: i(6, [ORANGE], { yaw: 0.5, pitch: -0.2, zoom: 1.3, ground: -1.05 }),
  arcade: i(7, [GOLD, NAVY, SILVER, RED, BLUE], { yaw: 0.55, pitch: -0.32, zoom: 1.3, ground: -1.05 }),
  coins: i(8, [GOLD, , , , , INK], { yaw: 0.55, ground: -1.05 }),
  gem: i(9, [VIOLET], { yaw: 0.3, pitch: -0.22, zoom: 1.45, ground: -0.75, lookY: -0.1 }),
  quest: i(10, [GOLD, , , RED, BLUE, GOLD_HI], { yaw: 0.35, pitch: 0.08, zoom: 1.3, ground: -0.95, lookY: 0.05 }),
  trophy: i(1, [GOLD, '#3A2E26', , , , GOLD_HI], { yaw: 0.35, pitch: 0.15, zoom: 1.3 }),
  // More
  friends: i(5, [BLUE, , , ORANGE, '#9CC0FF', '#FFB877'], { yaw: 0.3, zoom: 1.3 }),
  leaderboards: i(21, [GOLD, , , SILVER, BRONZE, GOLD_HI], { yaw: 0.45, pitch: -0.15, ground: -0.95, lookY: 0.05 }),
  challenges: i(22, [GREEN, CREAM, SILVER, '#B5835A', '#C9CFDD'], { yaw: 0.4, pitch: 0.05 }),
  plus: i(9, [GOLD], { yaw: 0.3, pitch: -0.22, zoom: 1.45, ground: -0.75, lookY: -0.1 }),
  settings: i(23, [, , SILVER], { yaw: 0.45, pitch: 0.12, zoom: 1.4, ground: -0.95 }),
  support: i(24, [, , , RED], { yaw: 0.4, pitch: 0.2, zoom: 1.4, ground: -0.95 }),
};
const k = (scene, cols, cam) => ({ scene, cols, yaw: 0.6, pitch: -0.5, zoom: 1.1, ground: -0.6, lookY: -0.25, ...cam });
// Key art: one per game shown in the mockups (rendered 640 × 400; tiles crop it).
export const KEYART = {
  pool: k(14, [, '#1E6B57', , RED, , , GOLD, CREAM], { yaw: 0.15, pitch: -0.42, zoom: 1.3, ground: -0.75, lookY: -0.2, ball: [-0.42, 0, 0.1] }),
  tubes: k(15, [ORANGE, NAVY, , BLUE, GREEN, PINK], { yaw: 0.3, pitch: -0.1, zoom: 1.12, ground: -0.97, lookY: -0.05 }),
  gemstone: k(9, [PINK], { yaw: 0.3, pitch: -0.25, zoom: 1.55, ground: -0.75, lookY: -0.1 }),
  blockzone: k(12, [ORANGE, NAVY, , BLUE, GREEN, GOLD], { yaw: 0.6, pitch: -0.62, zoom: 1.12, ground: -0.57, lookY: -0.3 }),
  minefield: k(25, [RED, NAVY, INK, '#3A466E', '#C9D3EA'], { yaw: 0.6, pitch: -0.55, zoom: 1.12, ground: -0.6, lookY: -0.2 }),
  hanoi: k(26, [GREEN, '#7A5638', SILVER, ORANGE, BLUE, PINK], { yaw: 0.2, pitch: -0.25, zoom: 1.35, ground: -0.88, lookY: -0.1 }),
  tilt: k(27, [, '#6B4A33', , BLUE, , GOLD], { yaw: 0.6, pitch: -0.62, zoom: 1.1, ground: -0.6, lookY: -0.3 }),
  curling: k(28, [, '#9BA3B5', , RED], { yaw: 0.4, pitch: -0.4, zoom: 1.5, ground: -0.75, lookY: -0.3 }),
  hero: k(11, [GOLD, NAVY, , , VIOLET, GOLD, BLUE, '#3B4870'], { yaw: 0, pitch: -0.12, zoom: 1.02, ground: -0.93, lookY: -0.02 }),
  board: k(12, [ORANGE, NAVY, , BLUE, GREEN, GOLD], { yaw: 0.6, pitch: -0.62, zoom: 1.12, ground: -0.57, lookY: -0.3 }),
};
