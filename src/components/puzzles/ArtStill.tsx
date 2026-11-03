import type { ArcadeGame } from "@/lib/arcade/engine";
import { CardStill } from "./CardStill";

/**
 * An arcade intro still drawn by the game's own renderer (3 Nov 2026, Joe's audit: Wavefront's shapes and Jaywalk's
 * abstract panel read as placeholders). The game's own art draws a fixed seed's world a few seconds in (no input),
 * scaled into the still. Display only: the sim runs here only to make the picture, never for a round.
 */
export function ArtStill<S, I>({
  game,
  worldW,
  worldH,
  seed = 7,
  ticks = 0,
  input,
  caption,
  shownW = 210,
}: {
  game: ArcadeGame<S, I>;
  worldW: number;
  worldH: number;
  seed?: number;
  /** Ticks stepped with the idle input before the picture is drawn. */
  ticks?: number;
  input: I;
  caption: string;
  shownW?: number;
}) {
  return (
    <CardStill
      width={worldW}
      height={worldH}
      shownW={shownW}
      caption={caption}
      draw={(ctx, size) => {
        let state = game.init(seed);
        for (let t = 0; t < ticks && !game.isOver(state); t++) state = game.step(state, input);
        ctx.save();
        ctx.scale(size.width / worldW, size.height / worldH);
        game.draw(ctx, state, { width: worldW, height: worldH });
        ctx.restore();
      }}
    />
  );
}
