import { devDisplayAllowed } from "@/lib/devDisplay";
import { ORBIT_TOTAL } from "./orbit";

/**
 * Dev-only Orbit start planet from `?planet=N` (1–40). Requires the accepted dev
 * key and the practice page; rooms never honour it. Such runs are never graded,
 * stored or saveable as demos.
 */
export function orbitDevPlanet(): number | null {
  if (typeof window === "undefined" || window.location.pathname !== "/practice" || !devDisplayAllowed()) return null;
  const raw = new URLSearchParams(window.location.search).get("planet");
  if (!raw || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 2 && n <= ORBIT_TOTAL ? n : null;
}
