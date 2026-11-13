# Runbook: taking the offline worker off every phone

When to use it: the offline worker (`/sw.js`, offline practice) must stop serving on players' phones straight away,
for example a build whose worker keeps an old app on screen. It is a last resort: offline practice, its packs and the
app cache stop until it is undone. Push notifications stop too (a subscription belongs to the worker's registration;
the server removes each device's row when the push service answers 404 or 410).

What is kept: everything in IndexedDB, so queued offline practice runs and practice packs stay on the phone and are
sent once the worker is back.

## Steps

1. On a branch from `main`, turn the page's registration off: in `src/lib/offline/serviceWorker.ts` set
   `STOP_WORKER_REGISTRATION = true`. Without this, the next page load would register the normal worker again.
2. Serve the unregister worker as `/sw.js`. The build writes `/sw.js` from `src/lib/offline/sw.template.js`
   (`src/lib/offline/swPlugin.ts`), so for this build replace the template's contents with
   `docs/runbook/unregister-sw.js` (keep the template's file name; the plugin's `__OFFLINE_CONFIG__` placeholder is
   not used by it, which is fine).
3. Open a PR, let Checks run (offline-check will fail: expected for this build only), merge, and let
   "Deploy to Cloudflare" finish.
4. On a phone that had the app open: reopen it. The browser fetches `/sw.js` (it is registered with
   `updateViaCache: "none"`), the unregister worker installs, deletes the `joulz-` caches, unregisters itself and
   reloads the window. In Safari's or Chrome's developer tools no service worker is listed for joulz.uk afterwards.
   Phones that don't open the app pick it up on their next visit (browsers also check for a new worker at least
   once a day).

## Undoing it

1. Revert the PR from step 3 (the template back as it was, `STOP_WORKER_REGISTRATION = false`) and deploy.
2. The page registers the normal worker again on the next load; it downloads the app and media as on a new device.

## Not this

- Don't send `Clear-Site-Data`: it also clears IndexedDB, losing queued offline runs.
- Don't leave the unregister worker deployed with `STOP_WORKER_REGISTRATION = false`: each load would register it,
  and it would unregister itself again, in a loop of reloads.
