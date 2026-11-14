// The art kit's scenes: camera and colours per icon. Shared by render.mjs.
export const ICON_SCENES = {
  joules:   { scene: 0,  yaw: 0.45, pitch: 0.1, zoom: 1.35, ground: -1.15, cols: ['#F5B83D'] },
  trophy:   { scene: 1,  yaw: 0.35, pitch: 0.15, zoom: 1.3, ground: -1.1, cols: ['#F2B33A', '#5A4636', , , , '#FFE08A'] },
  arena:    { scene: 2,  yaw: 0.4, pitch: 0.12, zoom: 1.32, ground: -1.1, cols: ['#FF8A3D', '#F4EFE6', '#2E2A26', '#E8473F'] },
  practice: { scene: 3,  yaw: 0.5, pitch: 0.1, zoom: 1.3, ground: -1.1, cols: ['#F5B83D', '#F4EFE6', '#3A3530', '#E8473F'] },
  daily:    { scene: 4,  yaw: 0.45, pitch: 0.12, zoom: 1.32, ground: -1.05, cols: ['#2FC28A', '#F4EFE6', '#6E665D', '#E8473F', '#DCD4C8'] },
  rooms:    { scene: 5,  yaw: 0.3, pitch: 0.1, zoom: 1.3, ground: -1.1, cols: ['#3E8EF7', , , '#F28C38', '#8DBBFF', '#FFB877'] },
  puzzles:  { scene: 6,  yaw: 0.5, pitch: -0.2, zoom: 1.3, ground: -1.05, cols: ['#F47B3B'] },
  arcade:   { scene: 7,  yaw: 0.55, pitch: -0.32, zoom: 1.3, ground: -1.05, cols: ['#F5B83D', '#3B3632', '#C9C2B8', '#E8473F', '#3E8EF7'] },
  coins:    { scene: 8,  yaw: 0.55, pitch: 0.1, zoom: 1.32, ground: -1.05, cols: ['#F2B33A', , , , , '#FFD36B'] },
  gem:      { scene: 9,  yaw: 0.3, pitch: -0.22, zoom: 1.45, ground: -0.75, lookY: -0.1, cols: ['#8E7CFF'] },
  quest:    { scene: 10, yaw: 0.35, pitch: 0.08, zoom: 1.3, ground: -0.95, lookY: 0.05, cols: ['#F2B33A', , , '#E8473F', '#3E8EF7', '#FFD36B'] },
  rated:    { scene: 13, yaw: 0.45, pitch: 0.1, zoom: 1.32, ground: -1.1, cols: ['#F5B83D', , , '#3E8EF7'] },
};
export const KEY_SCENES = {
  hero:  { scene: 11, yaw: 0.0, pitch: -0.12, zoom: 1.02, ground: -0.93, lookY: -0.02, cols: ['#F5B83D', '#6A6157', , , '#8E7CFF', '#F2B33A', '#3E8EF7', '#857A6D'] },
  pool:  { scene: 14, yaw: 0.15, pitch: -0.42, zoom: 1.3, ground: -0.75, lookY: -0.2, ball: [-0.42, 0.0, 0.1], cols: [, '#1F7A5A', , '#E8473F', , , '#F5B83D', '#F4EFE6'] },
  tubes: { scene: 15, yaw: 0.3, pitch: -0.1, zoom: 1.12, ground: -0.97, lookY: -0.05, cols: ['#F47B3B', '#6A6157', , '#3E8EF7', '#2FC28A', '#E8473F'] },
  board: { scene: 12, yaw: 0.6, pitch: -0.62, zoom: 1.12, ground: -0.57, lookY: -0.3, cols: ['#F47B3B', '#6A6157', , '#3E8EF7', '#2FC28A', '#F5B83D'] },
};
