// The live games (src/lib/duel/catalogue.ts less RETIRED_TYPES) as of 15 Nov 2026, with their category and, for
// arcade games, their group (src/lib/duel/arcadeGroups.ts). Regenerate games.data.mjs with games-list.ts.
import { GAMES_DATA } from './games.data.mjs';
export const GAMES = GAMES_DATA;
export const CATEGORY_HUE = { word: '#4D8CFF', number: '#3DDC84', speed: '#FF8A3D', attention: '#FF6BD6', pattern: '#B26BFF', logic: '#2ED3B7', arcade: '#FF4D4D' };
export const GROUP_HUE = { retro: '#36E2F5', sports: '#4CC24A', cards: '#FF5C93', action: '#FF4D4D', strategy: '#8E80FF' };
export const hueOf = (g) => (g.group ? GROUP_HUE[g.group] : CATEGORY_HUE[g.cat]);
export const ORDER = ['word', 'number', 'speed', 'attention', 'pattern', 'logic', 'retro', 'sports', 'cards', 'action', 'strategy'];
