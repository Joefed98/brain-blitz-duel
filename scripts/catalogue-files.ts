/**
 * The item catalogue's files, in order (A1's docs/art/wave-2/catalogue.json, then wave 4's docs/art/wave-4/catalogue.json:
 * W4c's Championship frame and W4d's seven Season 1 frames). Each item's `png` / `html` path is relative to its own
 * file's folder; `dir` says which. The database's sort order follows this order (wave 2's 110, then wave 4's).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export const CATALOGUE_FILES = ["docs/art/wave-2/catalogue.json", "docs/art/wave-4/catalogue.json"] as const;

/** Every catalogue item in order, with `dir` (the folder its png / html paths are relative to). */
export function catalogueItems<T extends object>(root = "."): (T & { dir: string })[] {
  return CATALOGUE_FILES.flatMap((file) => {
    const items = (JSON.parse(readFileSync(join(root, file), "utf8")) as { items: T[] }).items;
    return items.map((item) => ({ ...item, dir: dirname(file) }));
  });
}
