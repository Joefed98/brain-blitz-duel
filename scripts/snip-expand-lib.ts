/** Shared helpers for the Scrumper E8 expansion scripts (snipRev 10). */
import { createHash } from "node:crypto";

/** A stable digest of a whole sim state (every field, sorted keys). */
export function snipStateDigest(state: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, norm((v as Record<string, unknown>)[k])]));
    return v;
  };
  return createHash("sha256").update(JSON.stringify(norm(state))).digest("hex").slice(0, 24);
}
