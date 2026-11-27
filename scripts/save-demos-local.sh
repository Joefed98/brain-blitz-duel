#!/usr/bin/env bash
# Save intro demos from Joe's own computer (DRAFT, 27 Nov 2026; for while GitHub Actions is locked). Mirrors
# .github/workflows/save-intro-demos.yml: the app's dev server on the live project, then each
# scripts/<area>-demos-save.ts against it, through the app's own Save demo path (nothing writes the database directly).
#
#   bash scripts/save-demos-local.sh <secrets file>                    dry run, every area (the default)
#   bash scripts/save-demos-local.sh <secrets file> --save             saves (asks you to type SAVE first)
#   bash scripts/save-demos-local.sh <secrets file> [--save] speed,action    only those areas
#
# The secrets file sits outside the repo, chmod 600, and holds exactly these four KEY=value lines:
# SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, INTRO_DEMO_KEY. Keep it separate from the
# deploy's file: the service role key bypasses the live database's row security. It is read, never sourced, and no
# value is ever printed (the dev server's log stays in a temp folder; on a failure its last lines are shown with every
# secret replaced by ***).

set -euo pipefail
set +x
umask 077

BUN_VERSION="1.4.2"
NODE_MAJOR="22"
PORT="5199"

step() { printf '\n== %s\n' "$*"; }
fail() { printf '\nFAILED: %s\n' "$*" >&2; exit 1; }

SECRETS_FILE="${1:-}"; shift || true
SAVE=""; AREAS=""
for a in "$@"; do
  case "$a" in --save) SAVE=1;; -*) fail "unknown option: $a";; *) AREAS="$a";; esac
done
[ -n "$SECRETS_FILE" ] && [ -f "$SECRETS_FILE" ] || fail "usage: bash scripts/save-demos-local.sh <secrets file> [--save] [areas]"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "run this from inside the brain-blitz-duel checkout"
cd "$ROOT"
[ -f .github/workflows/save-intro-demos.yml ] || fail "$ROOT is not the brain-blitz-duel repo"
SECRETS_ABS="$(cd "$(dirname "$SECRETS_FILE")" && pwd)/$(basename "$SECRETS_FILE")"
case "$SECRETS_ABS/" in "$ROOT"/*) fail "the secrets file is inside the repo; keep it outside $ROOT";; esac
perm="$(stat -c %a "$SECRETS_ABS" 2>/dev/null || stat -f %Lp "$SECRETS_ABS")"
case "$perm" in 600|400) ;; *) fail "the secrets file is readable by others (mode $perm); run: chmod 600 \"$SECRETS_ABS\"";; esac

TMP="$(mktemp -d "${TMPDIR:-/tmp}/joulz-demos.XXXXXX")"
LOCK_BACKUP="$TMP/bun.lock.orig"
SERVER_PID=""
cleanup() {
  if [ -n "$SERVER_PID" ]; then
    pkill -TERM -P "$SERVER_PID" 2>/dev/null || true; kill -TERM "$SERVER_PID" 2>/dev/null || true
    sleep 2
    pkill -KILL -P "$SERVER_PID" 2>/dev/null || true; kill -KILL "$SERVER_PID" 2>/dev/null || true
  fi
  pkill -f "vite.*--port $PORT" 2>/dev/null || true
  if [ -f "$LOCK_BACKUP" ]; then cp "$LOCK_BACKUP" "$ROOT/bun.lock"; fi
  rm -rf "$TMP"
}
trap cleanup EXIT

step "The checkout is main, clean and up to date"
git fetch --quiet origin main || fail "git fetch origin main failed"
[ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || fail "check out main first"
[ -z "$(git status --porcelain)" ] || fail "the working tree has changes"
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || fail "main is not origin/main; run: git pull --ff-only"
echo "On $(git rev-parse --short=10 HEAD): $(git log -1 --format=%s)"

step "Tools: bun $BUN_VERSION, node $NODE_MAJOR, curl"
[ "$(bun --version 2>/dev/null)" = "$BUN_VERSION" ] || fail "bun $BUN_VERSION is needed (found: $(bun --version 2>/dev/null || echo none))"
case "$(node --version 2>/dev/null || true)" in "v$NODE_MAJOR".*) ;; *) fail "node $NODE_MAJOR is needed";; esac
command -v curl >/dev/null || fail "curl is missing"

step "The scripts to run"
want=" $(printf '%s' "$AREAS" | tr ',' ' ' | tr -s '[:space:]' ' ') "
LIST=""
for f in scripts/*-demos-save.ts; do
  [ -e "$f" ] || continue
  area="$(basename "$f" -demos-save.ts)"
  if [ -n "${AREAS//[[:space:],]/}" ] && [[ "$want" != *" $area "* ]]; then continue; fi
  LIST="$LIST $f"
done
LIST="${LIST# }"
[ -n "$LIST" ] || fail "no demos-save scripts found${AREAS:+ for: $AREAS}"
echo "$LIST"

step "Required secrets are set"
KNOWN="SUPABASE_URL SUPABASE_PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY INTRO_DEMO_KEY"
lineno=0
while IFS= read -r line || [ -n "$line" ]; do
  lineno=$((lineno + 1)); line="${line%$'\r'}"
  case "$line" in ""|\#*) continue;; esac
  case "$line" in *=*) ;; *) fail "secrets file line $lineno is not KEY=value";; esac
  key="${line%%=*}"; val="${line#*=}"
  case " $KNOWN " in *" $key "*) ;; *) fail "secrets file line $lineno: unknown name $key (this reads only: $KNOWN)";; esac
  printf -v "S_$key" '%s' "$val"
done < "$SECRETS_ABS"
missing=""; bad=0
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
[ "$bad" = 0 ] || fail "fix the values above (names only are shown)"
case "$S_SUPABASE_URL" in https://*.supabase.co) ;; *) fail "SUPABASE_URL is not an https://<ref>.supabase.co address";; esac
echo "All four set."

step "Install dependencies (as CI; bun.lock restored exactly)"
cp bun.lock "$LOCK_BACKUP"
node -e '
  const fs = require("fs");
  const t = fs.readFileSync("bun.lock", "utf8");
  fs.writeFileSync("bun.lock", t.replace(/https:\/\/europe-west[0-9]+-npm\.pkg\.dev\/lovable-core-prod\/[^/]+\//g, "https://registry.npmjs.org/"));
'
bun install --frozen-lockfile || fail "bun install"
cp "$LOCK_BACKUP" bun.lock; rm -f "$LOCK_BACKUP"
git diff --quiet -- bun.lock || fail "bun.lock changed during the install"

step "Chromium for Playwright"
# The save scripts launch PLAYWRIGHT_CHROMIUM if set, else /opt/pw-browsers/chromium, else Playwright's own.
bunx playwright install chromium > "$TMP/pw.log" 2>&1 || { tail -n 20 "$TMP/pw.log"; fail "playwright install chromium (on WSL first run: sudo bunx playwright install-deps chromium)"; }

mask() {
  # Prints stdin with every secret value replaced by ***.
  M_URL="$S_SUPABASE_URL" M_PUB="$S_SUPABASE_PUBLISHABLE_KEY" M_SRV="$S_SUPABASE_SERVICE_ROLE_KEY" M_KEY="$S_INTRO_DEMO_KEY" \
    node -e '
      let t = require("fs").readFileSync(0, "utf8");
      const u = process.env.M_URL; const ref = u.replace(/^https:\/\//, "").split(".")[0];
      for (const v of [process.env.M_SRV, process.env.M_KEY, process.env.M_PUB, u, ref]) if (v) t = t.split(v).join("***");
      process.stdout.write(t);
    '
}

step "Start the dev server on the live project (127.0.0.1:$PORT)"
ref="${S_SUPABASE_URL#https://}"; ref="${ref%%.*}"
SUPABASE_URL="$S_SUPABASE_URL" SUPABASE_PUBLISHABLE_KEY="$S_SUPABASE_PUBLISHABLE_KEY" \
  SUPABASE_SERVICE_ROLE_KEY="$S_SUPABASE_SERVICE_ROLE_KEY" INTRO_DEMO_KEY="$S_INTRO_DEMO_KEY" \
  VITE_SUPABASE_URL="$S_SUPABASE_URL" VITE_SUPABASE_PUBLISHABLE_KEY="$S_SUPABASE_PUBLISHABLE_KEY" VITE_SUPABASE_PROJECT_ID="$ref" \
  NODE_OPTIONS="--max-old-space-size=6144" \
  nohup bun run dev --port "$PORT" --host 127.0.0.1 --strictPort > "$TMP/dev-server.log" 2>&1 &
SERVER_PID=$!
up=""
for i in $(seq 1 180); do
  if curl -s -o /dev/null -m 10 "http://127.0.0.1:$PORT/"; then up=1; echo "dev server answering after ${i}s"; break; fi
  kill -0 "$SERVER_PID" 2>/dev/null || break
  sleep 1
done
[ -n "$up" ] || { tail -n 40 "$TMP/dev-server.log" | mask; fail "the dev server did not answer"; }

if [ -n "$SAVE" ]; then
  printf '\nThis will SAVE intro demos to the live project for: %s\nType SAVE to continue: ' "$LIST"
  read -r answer
  [ "$answer" = "SAVE" ] || fail "not confirmed (nothing saved)"
  mode="save"
else
  mode="dry run"
fi

step "Save the demos ($mode)"
bad=0
for f in $LIST; do
  out="$TMP/$(basename "$f").log"
  set +e
  if [ -n "$SAVE" ]; then
    DEMOS_URL="http://127.0.0.1:$PORT" INTRO_DEMO_KEY="$S_INTRO_DEMO_KEY" bun "$f" > "$out" 2>&1
  else
    DEMOS_URL="http://127.0.0.1:$PORT" INTRO_DEMO_KEY="$S_INTRO_DEMO_KEY" DEMOS_DRY=1 bun "$f" > "$out" 2>&1
  fi
  code=$?
  set -e
  ok=$(grep -c '^OK' "$out" || true); bad_n=$(grep -c '^FAIL' "$out" || true)
  case "$code" in
    0) result="passed";;
    1) result="failed (a game failed or the key was refused)"; bad=1;;
    2) result="not run (URL or key missing, or nothing tried)"; bad=1;;
    *) result="error (exit $code)"; bad=1;;
  esac
  echo "$f: exit $code, $ok OK, $bad_n FAIL: $result"
  grep '^FAIL' "$out" | mask | sed 's/^/    /' || true
done

[ "$bad" = 0 ] || fail "one or more scripts failed (lines above)"
printf '\nAll scripts passed (%s). Send the captain the lines above.\n' "$mode"
