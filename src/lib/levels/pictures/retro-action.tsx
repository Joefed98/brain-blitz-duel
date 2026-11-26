/**
 * The Retro and Action games' lever pictures (D5, 23 Nov 2026; the lever-picture slot of the polish plan's section 6.1,
 * src/lib/levels/leverPicture.tsx, which reads every `./pictures/*.tsx` file's `LEVER_PICTURES`). One component a game,
 * each in its own file under `./retro-action/`, drawn from that level's own settings (the tables the sims read), never a
 * hand-made image, so a picture cannot drift from its game. Breaker's is P2's (`./breaker.tsx`), so it is left out here.
 *
 * The entry shape is declared here too (`{ Picture, words }`, the slot's LeverPictureEntry), so this file stands on its
 * own until the slot's file is on main; nothing imports it until then.
 */
import type { ComponentType } from "react";

import type { Level } from "@/lib/levels/levels";

import { BastionPicture, bastionWords } from "./retro-action/bastion";
import { BeatPicture, beatWords } from "./retro-action/beat";
import { BlockfallPicture, blockfallWords } from "./retro-action/blockfall";
import { BurstPicture, burstWords } from "./retro-action/burst";
import { CrossPicture, crossWords } from "./retro-action/cross";
import { HoverPicture, hoverWords } from "./retro-action/hover";
import { SwingPicture, swingWords } from "./retro-action/swing";
import { WavefrontPicture, wavefrontWords } from "./retro-action/wavefront";

/** What the slot passes a picture: the level and how large it draws (`l` a game page's large level, `s` a row's tile). */
export interface RetroActionPictureProps {
  level: Level;
  size: "l" | "s";
}
export interface RetroActionPictureEntry {
  Picture: ComponentType<RetroActionPictureProps>;
  words?: (level: Level) => string;
}

export const LEVER_PICTURES: Partial<Record<string, RetroActionPictureEntry>> = {
  bastion: { Picture: BastionPicture, words: bastionWords },
  beat: { Picture: BeatPicture, words: beatWords },
  blockfall: { Picture: BlockfallPicture, words: blockfallWords },
  burst: { Picture: BurstPicture, words: burstWords },
  cross: { Picture: CrossPicture, words: crossWords },
  hover: { Picture: HoverPicture, words: hoverWords },
  swing: { Picture: SwingPicture, words: swingWords },
  wavefront: { Picture: WavefrontPicture, words: wavefrontWords },
};
