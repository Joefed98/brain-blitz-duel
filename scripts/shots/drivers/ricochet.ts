/**
 * Ricochet (ricoRev 2, the ninja wall-climb): the mid-play frame after about 9 s of real taps on the stage, a leap
 * every half second or so and a double jump on every third leap, so the frame shows a climb under way.
 */
import { STAGE, type Driver } from "../driver";

export const ricochetDriver: Driver = {
  board: `${STAGE} canvas`,
  partial: async ({ page, wait }) => {
    const box = await page.locator(`${STAGE} canvas`).first().boundingBox();
    if (!box) throw new Error("no Ricochet canvas");
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    for (let i = 0; i < 18; i++) {
      await page.mouse.click(at.x, at.y);
      if (i % 3 === 2) {
        await wait(180);
        await page.mouse.click(at.x, at.y);
      }
      await wait(i % 3 === 2 ? 300 : 470);
    }
  },
};
