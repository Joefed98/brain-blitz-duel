/**
 * Whether this server takes intro-demo saves. A development server always does (Joe records demos there); a
 * production build only when the server's own INTRO_DEMO_SAVES is "1", whatever the phone says.
 */
export function demoSavesOpen(prod: boolean, flag: string | undefined): boolean {
  return !prod || flag === "1";
}
