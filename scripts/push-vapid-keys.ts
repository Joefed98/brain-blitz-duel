/**
 * Makes Joulz's VAPID key pair for phone notifications (wave 2 B2; docs/push-notifications.md). No package: WebCrypto,
 * as the Worker uses. Run once, on your own computer:
 *
 *   bun scripts/push-vapid-keys.ts
 *
 * It prints two values and stores nothing:
 *   PUSH_PUBLIC_KEY   → src/config/pushConfig.ts (public; goes in a PR)
 *   VAPID_PRIVATE_KEY → GitHub secret of that name (never in the repo, never in a chat)
 *
 * Keep the private key: a new pair makes every phone's subscription stop working (each would have to turn notifications
 * on again).
 */
import { b64urlEncode, generateP256 } from "../src/lib/push/webPush.server";

const { d, publicPoint } = await generateP256();
console.log("PUSH_PUBLIC_KEY (src/config/pushConfig.ts):");
console.log(`  ${b64urlEncode(publicPoint)}`);
console.log("VAPID_PRIVATE_KEY (GitHub secret):");
console.log(`  ${b64urlEncode(d)}`);
