/**
 * The app's own vite config for the audit screenshots (scripts/audit/audit-capture.ts), with HMR and file watching off,
 * so edits made in the working tree while a long capture runs never reload a page mid-round. Run from the repo root:
 *   NODE_OPTIONS=--max-old-space-size=6144 npx vite dev --config scripts/audit/vite.audit.config.ts --port 5191 --host 127.0.0.1 --strictPort
 */
import { mergeConfig, type UserConfig } from "vite";

import base from "../../vite.config";

export default async (env: { command: "build" | "serve"; mode: string }) => {
  const resolved = (typeof base === "function" ? await (base as (e: typeof env) => UserConfig | Promise<UserConfig>)(env) : await base) as UserConfig;
  return mergeConfig(resolved, { server: { hmr: false, watch: null } } satisfies UserConfig);
};
