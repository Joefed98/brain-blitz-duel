/** The intro art matches its sources (scripts/settings-art.ts --check). */
const proc = Bun.spawnSync(["bun", "scripts/settings-art.ts", "--check"], { stdout: "inherit", stderr: "inherit" });
if (proc.exitCode !== 0) {
  console.log("FAIL: settings art differs from its sources");
  process.exit(1);
}
console.log("PASS: settings-art-check");
