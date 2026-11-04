/*
 * Dev-server capture (4 Nov 2026), loaded into every Node process of a Full suite shard through NODE_OPTIONS
 * (--require, full-suite.yml) and active only in a `vite dev` server: the checks start their servers with their output
 * discarded, so when one dies mid-check (out of memory, or anything else) nothing of it was left. This keeps the
 * server's last 400 output lines and a memory sample every 2 s (rss, heap used, heap total, heap limit) in
 * ci-results/dev-server/vite-<pid>.log, rewritten every 2 s, so the file holds the server's last moments even when it
 * is killed. Node's own diagnostic report (--report-on-fatalerror, same folder) adds the heap statistics of a fatal
 * error such as "JavaScript heap out of memory". It observes only: nothing a check runs or judges changes.
 */
"use strict";

const argv = process.argv.join(" ");
// The vite process itself, not the npx / npm wrapper that starts it.
const launcher = /(^|[\\/])(npx|npm)(\.c?js)?$/.test(process.argv[1] || "");
if (!launcher && /\bvite\b/.test(argv) && /\bdev\b/.test(argv) && process.env.DUELZ_DEV_SERVER_LOG_DIR) {
  const fs = require("node:fs");
  const path = require("node:path");
  const v8 = require("node:v8");
  const dir = process.env.DUELZ_DEV_SERVER_LOG_DIR;
  const file = path.join(dir, `vite-${process.pid}.log`);
  const MAX_LINES = 400;
  const lines = [];
  const started = Date.now();
  const push = (line) => {
    lines.push(line);
    if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
  };
  const mb = (n) => Math.round(n / 1048576);
  const stamp = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
  const memory = () => {
    const m = process.memoryUsage();
    const limit = v8.getHeapStatistics().heap_size_limit;
    return `rss ${mb(m.rss)} MB, heap ${mb(m.heapUsed)}/${mb(m.heapTotal)} MB (limit ${mb(limit)} MB)`;
  };
  let lastMemory = "";
  const flush = () => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file, `${argv}\nlast memory: ${lastMemory}\n\n${lines.join("\n")}\n`);
    } catch {
      /* the capture never gets in the server's way */
    }
  };
  for (const stream of ["stdout", "stderr"]) {
    const original = process[stream].write.bind(process[stream]);
    process[stream].write = (chunk, ...rest) => {
      try {
        for (const line of String(chunk).split("\n")) if (line.trim()) push(`[${stamp()} ${stream}] ${line}`);
      } catch {
        /* ignore */
      }
      return original(chunk, ...rest);
    };
  }
  const timer = setInterval(() => {
    lastMemory = memory();
    push(`[${stamp()} memory] ${lastMemory}`);
    flush();
  }, 2000);
  timer.unref();
  process.on("exit", (code) => {
    push(`[${stamp()} exit] code ${code}; ${memory()}`);
    flush();
  });
}
