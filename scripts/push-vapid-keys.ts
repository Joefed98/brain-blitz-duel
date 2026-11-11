/**
 * Makes Joulz's VAPID key pair for phone notifications (wave 2 B2; docs/push-notifications.md), and a random key for the
 * evening reminder's scheduler. No package: WebCrypto, as the Worker uses. Run once, on your own computer:
 *
 *   bun scripts/push-vapid-keys.ts
 *
 * It prints three values and stores nothing:
 *   PUSH_PUBLIC_KEY   → src/config/pushConfig.ts (public; goes in a PR)
 *   VAPID_PRIVATE_KEY → GitHub secret of that name (never in the repo, never in a chat)
 *   PUSH_CRON_SECRET  → GitHub secret of that name (the Worker gets it on deploy; the reminder workflow sends it)
 *
 * Keep the private key: a new pair makes every phone's subscription stop working (each would have to turn notifications
 * on again).
 */
import { b64urlEncode, generateP256 } from "../src/lib/push/webPush.server";

const { d, publicPoint } = await generateP256();
const cron = b64urlEncode(crypto.getRandomValues(new Uint8Array(32)));
console.log("PUSH_PUBLIC_KEY (src/config/pushConfig.ts):");
console.log(`  ${b64urlEncode(publicPoint)}`);
console.log("VAPID_PRIVATE_KEY (GitHub secret):");
console.log(`  ${b64urlEncode(d)}`);
console.log("PUSH_CRON_SECRET (GitHub secret):");
console.log(`  ${cron}`);
