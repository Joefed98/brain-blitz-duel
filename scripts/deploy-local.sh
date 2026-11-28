#!/usr/bin/env bash
# Local production deploy (DRAFT, 27 Nov 2026; for while GitHub Actions is locked). It mirrors the production job
# of .github/workflows/deploy-cloudflare.yml step for step; docs/local-deploy.md has the setup, the step table and
# what is left out. Runs on macOS (bash 3.2 or later) and in WSL2 Ubuntu on Windows.
#
#   bash scripts/deploy-local.sh <secrets file>             everything, asks "DEPLOY" before touching production
#   bash scripts/deploy-local.sh <secrets file> --rehearse  every step up to production, plus the migrations'
#                                                            live dry run: nothing applied, nothing deployed
#
# The secrets file sits outside the repo and holds KEY=value lines (no quotes, no export). It is read, never
# sourced, and no value is ever printed. It stops at the first failure: the database is touched only after the
# build and every guard pass, and the deploy runs only after the migrations succeed.

set -euo pipefail
set +x
umask 077

# Pinned exactly as in the workflow.
BUN_VERSION="1.4.2"
NODE_MAJOR="22"
WRANGLER_VERSION="4.153.0"
WORKER_NAME="joulz"
COMPAT_DATE="2026-10-15"
export WRANGLER_SEND_METRICS="false"

step() { printf '\n== %s\n' "$*"; }
fail() { printf '\nFAILED: %s\nNothing past this point ran.\n' "$*" >&2; exit 1; }

# ------------------------------------------------------------------ arguments and the repo
SECRETS_FILE="${1:-}"
MODE="${2:-}"
[ -n "$SECRETS_FILE" ] || fail "usage: bash scripts/deploy-local.sh <secrets file> [--rehearse]"
case "$MODE" in ""|--rehearse) ;; *) fail "unknown option: $MODE";; esac
[ -f "$SECRETS_FILE" ] || fail "no secrets file at $SECRETS_FILE"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "run this from inside the brain-blitz-duel checkout"
cd "$ROOT"
[ -f .github/workflows/deploy-cloudflare.yml ] && [ -f scripts/migrate.ts ] || fail "$ROOT is not the brain-blitz-duel repo"

SECRETS_ABS="$(cd "$(dirname "$SECRETS_FILE")" && pwd)/$(basename "$SECRETS_FILE")"
case "$SECRETS_ABS/" in "$ROOT"/*) fail "the secrets file is inside the repo; keep it outside $ROOT";; esac
perm="$(stat -c %a "$SECRETS_ABS" 2>/dev/null || stat -f %Lp "$SECRETS_ABS")"  # GNU first (BSD stat has no -c)
case "$perm" in 600|400) ;; *) fail "the secrets file is readable by others (mode $perm); run: chmod 600 \"$SECRETS_ABS\"";; esac

TMP="$(mktemp -d "${TMPDIR:-/tmp}/joulz-deploy.XXXXXX")"
LOCK_BACKUP="$TMP/bun.lock.orig"
cleanup() {
  # bun.lock is restored whatever happened (the install step rewrites it for a moment).
  if [ -f "$LOCK_BACKUP" ]; then cp "$LOCK_BACKUP" "$ROOT/bun.lock"; fi
  rm -rf "$TMP"
}
trap cleanup EXIT

step "The checkout is main, clean and up to date"
git fetch --quiet origin main || fail "git fetch origin main failed"
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || fail "check out main first (git checkout main)"
[ -z "$(git status --porcelain)" ] || fail "the working tree has changes; deploy only a clean main (git status)"
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || fail "main is not origin/main; run: git pull --ff-only"
SHA="$(git rev-parse HEAD)"
echo "Deploying ${SHA:0:10}: $(git log -1 --format=%s)"

step "Tools: bun $BUN_VERSION, node $NODE_MAJOR, npx, PostgreSQL"
[ "$(bun --version 2>/dev/null)" = "$BUN_VERSION" ] || fail "bun $BUN_VERSION is needed (found: $(bun --version 2>/dev/null || echo none)); see docs/local-deploy.md"
node_v="$(node --version 2>/dev/null || true)"
case "$node_v" in "v$NODE_MAJOR".*) ;; *) fail "node $NODE_MAJOR is needed (found: ${node_v:-none})";; esac
command -v npx >/dev/null || fail "npx is missing (it comes with node)"
if [ -z "${JOULZ_PG_BIN:-}" ]; then
  for d in /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin; do
    if [ -x "$d/initdb" ]; then export JOULZ_PG_BIN="$d"; break; fi
  done
fi
if [ -n "${JOULZ_PG_BIN:-}" ]; then
  [ -x "$JOULZ_PG_BIN/initdb" ] && [ -x "$JOULZ_PG_BIN/pg_ctl" ] && [ -x "$JOULZ_PG_BIN/psql" ] || fail "JOULZ_PG_BIN has no initdb, pg_ctl and psql"
else
  ls -d /usr/lib/postgresql/*/bin >/dev/null 2>&1 || fail "no PostgreSQL found (macOS: brew install postgresql@16; WSL: sudo apt install postgresql)"
fi

# ------------------------------------------------------------------ secrets (never exported, never printed)
step "Required secrets are set"
KNOWN="CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_ACCESS_TOKEN SUPABASE_PROJECT_REF"
lineno=0
while IFS= read -r line || [ -n "$line" ]; do
  lineno=$((lineno + 1))
  line="${line%$'\r'}"
  case "$line" in ""|\#*) continue;; esac
  case "$line" in *=*) ;; *) fail "secrets file line $lineno is not KEY=value";; esac
  key="${line%%=*}"
  val="${line#*=}"
  case " $KNOWN " in *" $key "*) ;; *) fail "secrets file line $lineno: unknown name $key (this deploy reads only: $KNOWN)";; esac
  printf -v "S_$key" '%s' "$val"
done < "$SECRETS_ABS"

missing=""
bad=0
for n in $KNOWN; do
  var="S_$n"; v="${!var:-}"
  if [ -z "$v" ]; then missing="$missing $n"; continue; fi
  problems=""
  case "$v" in *$'\n'*|*$'\r'*) problems="$problems, a newline";; esac
  [[ "$v" =~ ^[[:space:]] ]] && problems="$problems, leading whitespace"
  [[ "$v" =~ [[:space:]]$ ]] && problems="$problems, trailing whitespace"
  case "$v" in \"*\"|\'*\') problems="$problems, quotes round the value";; esac
  if [ -n "$problems" ]; then echo "  $n has ${problems#, }"; bad=1; fi
done
[ -z "$missing" ] || fail "missing in the secrets file:$missing"
[ "$bad" = 0 ] || fail "fix the values above in the secrets file (names only are shown)"
case "$S_SUPABASE_URL" in https://*.supabase.co) ;; *) fail "SUPABASE_URL is not an https://<ref>.supabase.co address";; esac
[ "$S_SUPABASE_URL" = "https://$S_SUPABASE_PROJECT_REF.supabase.co" ] || fail "SUPABASE_PROJECT_REF is not the project in SUPABASE_URL"
echo "All six set, no stray whitespace, the URL and project ref agree."

# ------------------------------------------------------------------ install, as checks.yml and the deploy do
step "Install dependencies (public registry for the install only; bun.lock restored exactly)"
cp bun.lock "$LOCK_BACKUP"
node -e '
  const fs = require("fs");
  const t = fs.readFileSync("bun.lock", "utf8");
  fs.writeFileSync("bun.lock", t.replace(/https:\/\/europe-west[0-9]+-npm\.pkg\.dev\/lovable-core-prod\/[^/]+\//g, "https://registry.npmjs.org/"));
'
bun install --frozen-lockfile || fail "bun install"
cp "$LOCK_BACKUP" bun.lock
rm -f "$LOCK_BACKUP"
git diff --quiet -- bun.lock || fail "bun.lock changed during the install"

step "Migrations apply to a fresh local PostgreSQL"
TMPDIR=/tmp bun scripts/migrate.ts --local || fail "the migrations did not apply cleanly to a fresh database"

step "Build (vite build, nitro cloudflare-module)"
ref="${S_SUPABASE_URL#https://}"; ref="${ref%%.*}"
VITE_SUPABASE_URL="$S_SUPABASE_URL" VITE_SUPABASE_PUBLISHABLE_KEY="$S_SUPABASE_PUBLISHABLE_KEY" \
  VITE_SUPABASE_PROJECT_ID="$ref" bun run build || fail "the build"
[ -f .output/server/index.mjs ] || fail "no .output/server/index.mjs"
[ -f .wrangler/deploy/config.json ] || fail "no .wrangler/deploy/config.json"

step "Generated wrangler config keeps Workers Logs on"
node -e '
  const fs = require("fs"), path = require("path");
  const redirect = JSON.parse(fs.readFileSync(".wrangler/deploy/config.json", "utf8"));
  const cfg = path.join(".wrangler/deploy", redirect.configPath);
  const o = JSON.parse(fs.readFileSync(cfg, "utf8")).observability ?? {};
  const l = o.logs ?? {};
  if (!(o.enabled === true && l.enabled === true && l.invocation_logs === true && l.persist === true)) {
    console.error(cfg + " has no observability with logs on (vite.config.ts WORKER_OBSERVABILITY)"); process.exit(1);
  }
  console.log("Workers Logs on in " + cfg + ": " + JSON.stringify(o));
' || fail "Workers Logs would be turned off"

step "The build talks to the London project only"
old_url="$(sed -n -E 's/^VITE_SUPABASE_URL="?([^"]*)"?$/\1/p' .env)"
old_key="$(sed -n -E 's/^VITE_SUPABASE_PUBLISHABLE_KEY="?([^"]*)"?$/\1/p' .env)"
old_host="${old_url#https://}"
[ -n "$old_host" ] && [ -n "$old_key" ] || fail "could not read .env's Lovable values"
[ "$old_url" != "$S_SUPABASE_URL" ] || fail "SUPABASE_URL is the Lovable Cloud project's URL"
if grep -rqF -- "$old_host" .output || grep -rqF -- "$old_key" .output; then
  fail "the Lovable Cloud project's URL or key is in the build output"
fi
grep -rqF -- "$S_SUPABASE_URL" .output/public/assets || fail "the London project's URL is not in the browser bundle"
echo "Build output names the London project only."

step "The browser bundle's publishable key is the secret, exactly"
NEW_KEY="$S_SUPABASE_PUBLISHABLE_KEY" node - <<'JS' || fail "the publishable key check"
const fs = require("fs"), path = require("path");
const key = process.env.NEW_KEY ?? "";
const core = key.trim();
const fail = (m) => { console.error(`Publishable key mismatch: ${m}`); process.exit(1); };
if (!core) fail("SUPABASE_PUBLISHABLE_KEY is empty");
if (core !== key) fail("SUPABASE_PUBLISHABLE_KEY has surrounding whitespace (the bundle would carry it)");
const files = (dir) => fs.existsSync(dir)
  ? fs.readdirSync(dir, { recursive: true }).map((f) => path.join(dir, String(f)))
      .filter((f) => /\.(m?js|cjs|html)$/.test(f) && fs.statSync(f).isFile())
  : [];
const scan = (dir) => {
  let exact = 0; const inexact = new Set();
  for (const f of files(dir)) {
    const text = fs.readFileSync(f, "utf8");
    for (let i = text.indexOf(core); i !== -1; i = text.indexOf(core, i + 1)) {
      const before = text[i - 1], after = text[i + core.length];
      if (`"'\``.includes(before ?? "") && after === before) exact++;
      else inexact.add(path.relative(".output", f));
    }
  }
  return { exact, inexact: [...inexact] };
};
const pub = scan(".output/public");
const srv = scan(".output/server");
if (pub.inexact.length || srv.inexact.length)
  fail(`the key appears inside a longer string (stray whitespace or newline baked in?) in: ${[...pub.inexact, ...srv.inexact].join(", ")}`);
if (pub.exact === 0) fail("the browser bundle does not contain SUPABASE_PUBLISHABLE_KEY as a string of its own");
console.log(`Publishable key in the browser bundle matches the secret exactly (${pub.exact} literal(s); server ${srv.exact}).`);
JS

step "Bundle size (dry run)"
npx --yes "wrangler@$WRANGLER_VERSION" deploy --dry-run --name "$WORKER_NAME" \
  --compatibility-date "$COMPAT_DATE" --outdir "$TMP/dry" > "$TMP/dry.log" 2>&1 || { cat "$TMP/dry.log"; fail "the dry run"; }
grep -E "Total Upload|Total \(" "$TMP/dry.log" | sed 's/[│└┘─]//g; s/^ */  /' || true
echo "  Paid Workers plan limit: 10 MB gzip (free: 3 MB)"

# ------------------------------------------------------------------ production from here on
step "Migrations the London project would get (dry run, nothing applied)"
SUPABASE_ACCESS_TOKEN="$S_SUPABASE_ACCESS_TOKEN" SUPABASE_PROJECT_REF="$S_SUPABASE_PROJECT_REF" \
  SUPABASE_URL="$S_SUPABASE_URL" bun scripts/migrate.ts --live --dry-run || fail "the live migration dry run"

step "The Worker's existing secrets (names only)"
secret_names() {
  CLOUDFLARE_API_TOKEN="$S_CLOUDFLARE_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$S_CLOUDFLARE_ACCOUNT_ID" \
    npx --yes "wrangler@$WRANGLER_VERSION" secret list --name "$WORKER_NAME" 2>"$TMP/secrets.err" \
    | grep -oE '"name": *"[A-Z0-9_]+"' | sed -E 's/.*"([A-Z0-9_]+)"$/\1/' | sort -u
}
before="$(secret_names)" || true
[ -n "$before" ] || { cat "$TMP/secrets.err" >&2; fail "could not list the Worker's secrets (token permissions?)"; }
for n in SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY PRACTICE_SEAL_KEY INTRO_DEMO_KEY; do
  echo "$before" | grep -qx "$n" || fail "the Worker has no $n secret; this deploy sends none, so it must already be there"
done
for n in TURNSTILE_SECRET_KEY VAPID_PRIVATE_KEY FEEDBACK_HMAC_KEY; do
  echo "$before" | grep -qx "$n" || echo "  note: optional $n is not set on the Worker"
done
echo "Worker secrets present: $(echo "$before" | tr '\n' ' ')"

if [ "$MODE" = "--rehearse" ]; then
  printf '\nRehearsal passed for %s. Nothing was applied to the database and nothing was deployed.\n' "${SHA:0:10}"
  exit 0
fi

printf '\nAbout to apply the migrations listed above to the London project and deploy %s to the Worker %s.\n' "${SHA:0:10}" "$WORKER_NAME"
printf 'Type DEPLOY to continue: '
read -r answer
[ "$answer" = "DEPLOY" ] || fail "not confirmed"

step "Apply database migrations (London project)"
SUPABASE_ACCESS_TOKEN="$S_SUPABASE_ACCESS_TOKEN" SUPABASE_PROJECT_REF="$S_SUPABASE_PROJECT_REF" \
  SUPABASE_URL="$S_SUPABASE_URL" bun scripts/migrate.ts --live || fail "a migration was refused or failed (it rolled back); the Worker was NOT deployed"

step "Deploy to the Worker"
# No --secrets-file: the Worker keeps the secrets it has (checked above and again below).
CLOUDFLARE_API_TOKEN="$S_CLOUDFLARE_API_TOKEN" CLOUDFLARE_ACCOUNT_ID="$S_CLOUDFLARE_ACCOUNT_ID" \
  npx --yes "wrangler@$WRANGLER_VERSION" deploy --name "$WORKER_NAME" \
  --compatibility-date "$COMPAT_DATE" --message "${SHA:0:10} (local)" > "$TMP/deploy.log" 2>&1 \
  || { cat "$TMP/deploy.log"; fail "wrangler deploy (the migrations above were applied; the Worker is unchanged)"; }
grep -E "Worker Startup Time|Total Upload|Current Version ID|schedule:" "$TMP/deploy.log" | sed 's/^ */  /' || true
grep -oE "https://[a-z0-9.-]+\.workers\.dev" "$TMP/deploy.log" | sort -u | sed 's/^/  /' || true

step "The Worker still has its secrets"
after="$(secret_names)" || true
for n in $before; do
  echo "$after" | grep -qx "$n" || fail "secret $n is gone after the deploy; roll back in Cloudflare (docs/local-deploy.md) and tell the captain"
done
printf '\nDeployed %s. Check https://joulz.uk, then send the captain the lines above.\n' "${SHA:0:10}"
