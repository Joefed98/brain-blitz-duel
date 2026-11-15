/**
 * The ten Retro games whose answer reveal draws a run summary (retroSummary.ts). A light module of its own, so the
 * reveal can tell whether to reserve the summary's space without loading the sims (the summary loads on demand).
 */
export const RETRO_SUMMARY_TYPES = ["hover", "breaker", "rally", "wavefront", "burst", "beat", "snake", "cross", "pinball", "blockfall"] as const;

/** The games whose summary includes the run's final frame (the wall, the field, the well). */
export const RETRO_SUMMARY_PICTURES = ["breaker", "snake", "blockfall"] as const;

export function hasRetroSummary(type: string): boolean {
  return (RETRO_SUMMARY_TYPES as readonly string[]).includes(type);
}

export function retroSummaryHasPicture(type: string): boolean {
  return (RETRO_SUMMARY_PICTURES as readonly string[]).includes(type);
}
