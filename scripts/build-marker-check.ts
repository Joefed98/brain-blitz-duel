/**
 * build-marker-check (28 Oct 2026): Profile → Settings → About shows which code is live.
 *
 *   1. buildLabel turns vite.config.ts's build id ("<commit>-<base-36 build time>") into "<8-char commit> · <UK time>",
 *      "no commit" when the build had no git, "dev" outside a build.
 *   2. The settings sheet draws the phone's build and, when the deployed server's id differs, the server's.
 *
 *   bun scripts/build-marker-check.ts
 */
import { readFileSync } from "node:fs";

import { DEV_BUILD_ID, buildLabel } from "../src/lib/appVersion";

let failed = 0;
const eq = (got: unknown, want: unknown, what: string) => {
  if (got === want) return;
  failed++;
  console.log(`FAIL ${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

// 28 Oct 2026 02:30 UTC is 02:30 in London (GMT since 25 Oct); 15 Oct 2026 12:00 UTC is 13:00 BST.
const winter = Date.UTC(2026, 9, 28, 2, 30).toString(36);
const summer = Date.UTC(2026, 9, 15, 12, 0).toString(36);
eq(buildLabel(`81ed1b5af2-${winter}`), "81ed1b5a · 28 Oct 02:30", "a commit build in GMT");
eq(buildLabel(`81ed1b5af2-${summer}`), "81ed1b5a · 15 Oct 13:00", "a commit build in BST");
eq(buildLabel(`build-${winter}`), "no commit · 28 Oct 02:30", "a build without git");
eq(buildLabel(DEV_BUILD_ID), "dev", "outside a build");
eq(buildLabel(""), "dev", "an empty id");
eq(buildLabel("81ed1b5af2"), "81ed1b5a", "an id with no build time");

const sheet = readFileSync(new URL("../src/components/app/SettingsSheet.tsx", import.meta.url), "utf8");
eq(sheet.includes("data-build-marker") && sheet.includes("buildLabel(APP_BUILD_ID)"), true, "the sheet shows the phone's build");
eq(sheet.includes("data-server-build-marker") && sheet.includes("appVersionFn"), true, "the sheet shows a differing server build");

if (failed) {
  console.log(`FAIL: ${failed} problem(s)`);
  process.exit(1);
}
console.log("PASS: the build marker reads the commit and UK build time");
