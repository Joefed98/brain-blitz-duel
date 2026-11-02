/** Every game driver the screenshot tool knows, by PuzzleType id. Games not listed get the driverless capture. */
import type { Driver } from "../driver";
import { LOGIC_DRIVERS } from "./logic";
import { WORD_DRIVERS } from "./word";
import { ATTENTION_DRIVERS } from "./attention";
import { CARD_DRIVERS } from "./cards";
import { GRID_DRIVERS } from "./grid";

// Pattern (#44)
import { driver as unblock } from "./unblock";
import { driver as blockparty } from "./blockparty";
import { driver as iceslide } from "./iceslide";
import { driver as gravity } from "./gravity";
import { driver as tiles } from "./tiles";
import { driver as rings } from "./rings";
import { driver as laser } from "./laser";
import { driver as flow } from "./flow";
import { driver as pipes } from "./pipes";
import { driver as push } from "./push";
// Number (#49)
import { driver as target } from "./target";
import { driver as equation } from "./equation";
import { driver as balance } from "./balance";
import { driver as numpyramid } from "./numpyramid";
import { driver as trail } from "./trail";
import { driver as measure } from "./measure";
import { driver as checkout } from "./checkout";
import { driver as numline } from "./numline";
import { driver as tendrop } from "./tendrop";
// Depth to 200 (D3)
import { driver as maze } from "./maze";
// Cards & Board (30 Oct 2026)
import { mahjongDriver, minesweeperDriver } from "./cardsBoard";
import { ricochetDriver } from "./ricochet";
import { bastionDriver } from "./bastion";
// Gemstone (Nov 2026): real swaps for the mid-play frame (the six goals part-way).
import { matchupDriver } from "./matchup";

export const DRIVERS: Record<string, Driver> = {
  ...LOGIC_DRIVERS,
  ...WORD_DRIVERS,
  ...ATTENTION_DRIVERS,
  ...CARD_DRIVERS,
  ...GRID_DRIVERS,
  unblock,
  blockparty,
  iceslide,
  gravity,
  tiles,
  rings,
  laser,
  flow,
  pipes,
  push,
  target,
  equation,
  balance,
  numpyramid,
  trail,
  measure,
  checkout,
  numline,
  tendrop,
  maze,
  minesweeper: minesweeperDriver,
  bastion: bastionDriver,
  mahjong: mahjongDriver,
  ricochet: ricochetDriver,
  matchup: matchupDriver,
};
