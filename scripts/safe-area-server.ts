/**
 * The Vite dev server behind safe-area-harness.tsx, shared by safe-area-screens-check and
 * onboarding-check: the app's real CSS and components with only the network edge stubbed
 * (server functions, the room API, Supabase, the room/chat hooks and the router call
 * `window.__harness`). It serves the harness page at /safe-area.html?mode=home|practice|room.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Plugin } from "vite";

const STUBBED = [
  /\/src\/lib\/.*\.functions\.ts$/,
  /\/src\/lib\/duel\/api\.ts$/,
  /\/src\/lib\/duel\/useDuel\.ts$/,
  /\/src\/lib\/duel\/useRoomChat\.ts$/,
  /\/src\/integrations\/supabase\/client\.ts$/,
];
const ROUTER_STUB = `
export const createFileRoute = () => (options) => ({
  options,
  useParams: () => ({ code: "SAFE" }),
  useSearch: () => ({}),
});
export const useNavigate = () => () => undefined;
export const useRouter = () => ({ navigate: () => undefined, invalidate: () => undefined });
export const Link = ({ children }) => children;
`;
const START_STUB = `
const builder = () => new Proxy(() => undefined, { get: () => builder, apply: () => builder() });
export const createServerFn = builder;
export const createMiddleware = builder;
export const useServerFn = (fn) => fn;
`;

function stubSource(file: string): string {
  const text = readFileSync(file, "utf8");
  const names = new Set<string>();
  const lines = [`const H = () => window.__harness;`];
  for (const m of text.matchAll(/^export\s+(?:async\s+)?(function|const|let|class)\s+(\w+)/gm)) {
    const [, kind, name] = m as unknown as [string, string, string];
    if (names.has(name)) continue;
    names.add(name);
    if (kind === "class") lines.push(`export class ${name} extends Error {}`);
    else if (name === "supabase")
      lines.push(
        `export const supabase = new Proxy({}, { get: (_t, k) => H().call(${JSON.stringify(file)}, "supabase", [])[k] });`,
      );
    else
      lines.push(
        `export function ${name}(...args) { return H().call(${JSON.stringify(file)}, ${JSON.stringify(name)}, args)(...args); }`,
      );
  }
  return lines.join("\n");
}

function harnessEdge(): Plugin {
  return {
    name: "safe-area-edge",
    enforce: "pre",
    async resolveId(source, importer) {
      if (source === "@tanstack/react-router") return "\0stub-router";
      if (source === "@tanstack/react-start") return "\0stub-start";
      if (source.startsWith("\0")) return null;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (resolved && STUBBED.some((re) => re.test(resolved.id.split("?")[0]!)))
        return `\0stub:${resolved.id.split("?")[0]}`;
      return null;
    },
    load(id) {
      if (id === "\0stub-router") return ROUTER_STUB;
      if (id === "\0stub-start") return START_STUB;
      if (id.startsWith("\0stub:")) return stubSource(id.slice("\0stub:".length));
      return null;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/safe-area.html")) return next();
        // The app's own viewport meta (src/routes/__root.tsx), so env(safe-area-inset-*) applies.
        const html = await server.transformIndexHtml(
          req.url,
          `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="/scripts/safe-area-harness.tsx"></script></body></html>`,
        );
        res.setHeader("content-type", "text/html");
        res.end(html);
      });
    },
  };
}

/** Starts the harness server on a free port; `close` stops it. */
export async function startSafeAreaServer(opts: { cacheDir: string; buildId: string }): Promise<{ origin: string; close: () => Promise<void> }> {
  const { createServer } = await import("vite");
  const react = (await import("@vitejs/plugin-react")).default;
  const tailwind = (await import("@tailwindcss/vite")).default;
  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: "error",
    plugins: [harnessEdge(), react(), tailwind()],
    resolve: { alias: { "@": resolve("src") } },
    define: { __DUELZ_BUILD_ID__: JSON.stringify(opts.buildId) },
    server: { host: "127.0.0.1", port: 0, hmr: false },
    optimizeDeps: { entries: ["scripts/safe-area-harness.tsx"] },
    cacheDir: opts.cacheDir,
  });
  await server.listen();
  const address = server.httpServer!.address();
  const origin = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  return { origin, close: () => server.close() };
}
