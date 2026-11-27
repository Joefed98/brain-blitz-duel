#!/usr/bin/env bash
# Chromium for the browser checks (Full suite), with retries and a cache. Added with Joe's approval, 13 Nov 2026
# (checks and infrastructure session, item 1): the download sometimes failed and every run reinstalled the system
# libraries through apt.
#
#  - The browser: Playwright's own Chromium for the locked playwright version, in ~/.cache/ms-playwright (restored by
#    actions/cache before this runs). `playwright install chromium` is a no-op when it is there; otherwise it downloads,
#    retried up to 4 times with backoff (15 s, 30 s, 60 s).
#  - Its system libraries: `playwright install-deps --dry-run chromium` lists the packages this runner image lacks. When
#    none are missing nothing happens. Otherwise the .deb files kept in $PW_DEBS (also restored by actions/cache, keyed by
#    the runner image and the playwright version) are installed with dpkg, with no network; if they're absent or don't
#    complete the set, apt downloads exactly the missing packages into $PW_DEBS (retried as above) and installs them, so
#    the next run on this image finds them in the cache.
#  - A cached set that doesn't install (dpkg leaves packages half-installed, and apt then can't simulate anything) is
#    repaired with `apt-get install -f` after the update; if apt still can't work out the missing packages, Playwright's
#    own `install-deps chromium` installs its whole list. # Changed with Joe's approval, 27 Nov 2026
#  - Prints which path it took ("browser: cached | downloaded", "system libraries: already installed | from the cache |
#    repaired | downloaded | installed by playwright install-deps") and finally checks that the browser launches. Writes # Changed with Joe's approval, 27 Nov 2026
#    PLAYWRIGHT_CHROMIUM to $GITHUB_ENV. # Changed with Joe's approval, 27 Nov 2026
set -euo pipefail

PW_DEBS="${PW_DEBS:-$HOME/.cache/pw-debs}"
mkdir -p "$PW_DEBS" # so the cache step always has its path, even when nothing was missing

retry() {
  local n=1 delay=15
  until "$@"; do
    if [ "$n" -ge 4 ]; then
      echo "failed after $n attempts: $*" >&2
      return 1
    fi
    echo "attempt $n failed; retrying in ${delay}s: $*" >&2
    sleep "$delay"
    n=$((n + 1))
    delay=$((delay * 2))
  done
}

browser_path() { bun -e 'import("playwright").then(m => console.log(m.chromium.executablePath()))'; }

# 1. The browser.
exe="$(browser_path)"
if [ -x "$exe" ]; then
  echo "browser: cached ($exe)"
else
  retry bunx playwright install chromium
  exe="$(browser_path)"
  echo "browser: downloaded ($exe)"
fi

# 2. Its system libraries.
# deps_state sets STATE to "ok" (nothing missing), "missing" (NEED lists the packages) or "unknown" (apt couldn't
# simulate the install, e.g. its package lists are empty, so the missing set isn't known yet).
STATE="" NEED="" DEPS_OUT="" # Changed with Joe's approval, 27 Nov 2026: DEPS_OUT keeps the dry run's output for the messages below
deps_state() {
  local rc=0 # Changed with Joe's approval, 27 Nov 2026
  DEPS_OUT="$(bunx playwright install-deps --dry-run chromium 2>&1)" || rc=$? # Changed with Joe's approval, 27 Nov 2026
  NEED="$(printf '%s\n' "$DEPS_OUT" | sed -n 's/^  \([^ ][^ ]*\)$/\1/p')" # Changed with Joe's approval, 27 Nov 2026
  if [ "$rc" -eq 0 ]; then STATE=ok
  elif printf '%s\n' "$DEPS_OUT" | grep -q '^Missing system dependencies' && [ -n "$NEED" ]; then STATE=missing # Changed with Joe's approval, 27 Nov 2026
  else STATE=unknown; NEED=""
  fi
}
deps_state
if [ "$STATE" = ok ]; then
  echo "system libraries: already installed"
else
  echo "system libraries needed (${STATE}): $(echo "$NEED" | tr '\n' ' ')"
  done_from_cache=false
  dpkg_failed=false # Changed with Joe's approval, 27 Nov 2026
  if compgen -G "$PW_DEBS/*.deb" > /dev/null; then
    dpkg_log="$(mktemp)" # Changed with Joe's approval, 27 Nov 2026
    if sudo dpkg -i "$PW_DEBS"/*.deb > "$dpkg_log" 2>&1; then deps_state; else dpkg_failed=true; echo "system libraries: dpkg couldn't install the cached packages: $(grep -m 2 -E 'dpkg: (error|dependency problems)|depends on' "$dpkg_log" | tr '\n' ' ')"; fi # Changed with Joe's approval, 27 Nov 2026
    if [ "$STATE" = ok ]; then
      done_from_cache=true
      echo "system libraries: from the cache ($(ls "$PW_DEBS"/*.deb | wc -l) packages, no download)"
    else
      echo "system libraries: the cached packages didn't complete the set; downloading"
    fi
  fi
  if [ "$done_from_cache" = false ]; then
    retry sudo apt-get update -q
    if [ "$dpkg_failed" = true ]; then # Changed with Joe's approval, 27 Nov 2026
      mkdir -p "$PW_DEBS/partial" # apt's archive folder needs it # Changed with Joe's approval, 27 Nov 2026
      retry sudo apt-get install -f -y -q --no-install-recommends -o Dir::Cache::archives="$PW_DEBS" # Changed with Joe's approval, 27 Nov 2026
      sudo rm -rf "$PW_DEBS/partial" "$PW_DEBS/lock"; sudo chown -R "$(id -u):$(id -g)" "$PW_DEBS" # Changed with Joe's approval, 27 Nov 2026
    fi # Changed with Joe's approval, 27 Nov 2026
    deps_state
    if [ "$STATE" = ok ]; then # Changed with Joe's approval, 27 Nov 2026
      echo "system libraries: $([ "$dpkg_failed" = true ] && echo "repaired (the cached packages finished with apt-get install -f)" || echo "already installed")" # Changed with Joe's approval, 27 Nov 2026
    elif [ "$STATE" = unknown ]; then # Changed with Joe's approval, 27 Nov 2026
      echo "system libraries: apt can't work out the missing packages ($(printf '%s\n' "$DEPS_OUT" | grep -v '^\s*$' | tail -n 2 | tr '\n' ' ')); installing Playwright's whole list" # Changed with Joe's approval, 27 Nov 2026
      retry bunx playwright install-deps chromium # Changed with Joe's approval, 27 Nov 2026
      deps_state # Changed with Joe's approval, 27 Nov 2026
      if [ "$STATE" != ok ]; then echo "system libraries still missing after playwright install-deps: $NEED $DEPS_OUT" >&2; exit 1; fi # Changed with Joe's approval, 27 Nov 2026
      rm -rf "$PW_DEBS"; mkdir -p "$PW_DEBS"; cp /var/cache/apt/archives/*.deb "$PW_DEBS"/ 2> /dev/null || true # Changed with Joe's approval, 27 Nov 2026
      echo "system libraries: installed by playwright install-deps ($(ls "$PW_DEBS"/*.deb 2> /dev/null | wc -l) packages kept for the cache)" # Changed with Joe's approval, 27 Nov 2026
    else
      rm -rf "$PW_DEBS"
      mkdir -p "$PW_DEBS/partial"
      # shellcheck disable=SC2086
      retry sudo apt-get install -y -q --no-install-recommends --download-only -o Dir::Cache::archives="$PW_DEBS" $NEED
      # shellcheck disable=SC2086
      sudo apt-get install -y -q --no-install-recommends -o Dir::Cache::archives="$PW_DEBS" $NEED
      sudo rm -rf "$PW_DEBS/partial" "$PW_DEBS/lock"
      sudo chown -R "$(id -u):$(id -g)" "$PW_DEBS"
      deps_state
      if [ "$STATE" != ok ]; then
        echo "system libraries still missing after the install: $NEED" >&2
        exit 1
      fi
      echo "system libraries: downloaded ($(ls "$PW_DEBS"/*.deb 2>/dev/null | wc -l) packages kept for the cache)"
    fi
  fi
fi

# 3. It launches.
"$exe" --headless --no-sandbox --disable-gpu --dump-dom about:blank > /dev/null 2>&1 || { echo "chromium does not start: $exe" >&2; exit 1; }
echo "PLAYWRIGHT_CHROMIUM=$exe" >> "${GITHUB_ENV:-/dev/null}"
echo "chromium ready: $exe"
