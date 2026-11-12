import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

import { PhoneShell } from "@/components/duel/PhoneShell";
import { PassScreen } from "@/components/pass/PassScreen";
import { ShopFront } from "@/components/shop/ShopFront";
import { PlusPart } from "@/components/plus/PlusPart";
import { EmptyState, Segmented } from "@/design/components";
import { useAccount } from "@/lib/account/accountApi";
import { APP_NAME } from "@/lib/brand";
import { useShopOn } from "@/lib/identity/shopSwitch";
import { shopStatusSettled, useShopStatus } from "@/lib/shop/shopStatus";
import { useHomeBed } from "@/lib/useScreenMusic";

/**
 * The Shop tab (wave 2, session A2; mockup docs/art/wave-2/screens/shop.png): a Shop · Pass · Plus switch at the
 * top; the Shop part keeps Featured, Daily and Coins. Session D1 fills the Shop part (ShopFront: this week's bundle,
 * today's four, the coin packs); session D2 the Pass part (PassScreen: the Season pass and this week's challenges);
 * session E2 the Plus part (PlusPart: the Joulz Plus offer, or a member's Plus).
 *
 * Behind the Shop switch (src/config/shopConfig.ts): a device the switch is off for is sent to Play.
 */
type Part = "shop" | "pass" | "plus";
type Section = "featured" | "daily" | "coins";
const PARTS: readonly Part[] = ["shop", "pass", "plus"];
const SECTIONS: readonly Section[] = ["featured", "daily", "coins"];

export const Route = createFileRoute("/shop")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { part?: Part; section?: Section } => ({
    ...(PARTS.includes(search["part"] as Part) ? { part: search["part"] as Part } : {}),
    ...(SECTIONS.includes(search["section"] as Section) ? { section: search["section"] as Section } : {}),
  }),
  head: () => ({
    meta: [{ title: `${APP_NAME} shop` }, { name: "robots", content: "noindex" }],
  }),
  component: ShopScreen,
});

/** What each part and section says while the Shop is opening (calm, no prices, no dates). */
export type { Section as ShopSection };

export const SOON: Record<Part | Section, { title: string; body: string }> = {
  featured: { title: "Opening soon", body: "This week’s bundle and featured items will show here." },
  daily: { title: "Opening soon", body: "New items every day at midnight, once the shop opens." },
  coins: { title: "Opening soon", body: "Coin packs will be here when the shop opens." },
  shop: { title: "Opening soon", body: "" },
  pass: { title: "The pass is coming", body: "Season 1 rewards will show here when the season starts." },
  plus: { title: "Joulz Plus is coming", body: "Everything Plus includes will show here when it launches." },
};

function ShopScreen() {
  useHomeBed();
  const router = useRouter();
  const search = Route.useSearch();
  const account = useAccount();
  const shopOn = useShopOn();
  const status = useShopStatus();
  const part: Part = search.part ?? "shop";
  const section: Section = search.section ?? "featured";
  // Known: the account, and for an account the server's tester answer (a tester waits for it before anyone is sent away).
  const known = account.kind !== "unknown" && shopStatusSettled(account as { kind: string; userId?: string | null }, status);

  // Only where the switch is on: anyone else lands on Play, as before the Shop.
  useEffect(() => {
    if (known && !shopOn) void router.navigate({ to: "/", replace: true });
  }, [known, shopOn, router]);

  const go = (next: { part?: Part; section?: Section }) => {
    const to = next.part ?? part;
    void router.navigate({ to: "/shop", search: to === "shop" ? { part: to, section: next.section ?? section } : { part: to }, replace: true });
  };

  const soon = part === "shop" ? SOON[section] : SOON[part];
  return (
    <PhoneShell tabs="shop">
      {shopOn ? (
        <div className="ap-stack" data-shop-page={part}>
          <Segmented<Part>
            label="Shop, pass or Plus"
            radio
            tone="gold"
            value={part}
            onChange={(value) => go({ part: value })}
            options={[
              { value: "shop", label: "Shop", data: { "data-shop-part": "shop" } },
              { value: "pass", label: "Pass", data: { "data-shop-part": "pass" } },
              { value: "plus", label: "Plus", data: { "data-shop-part": "plus" } },
            ]}
          />
          {part === "shop" ? (
            <ShopFront
              section={section}
              onSection={(value) => go({ part: "shop", section: value })}
              onGetCoins={() => go({ part: "shop", section: "coins" })}
            />
          ) : part === "pass" ? (
            <PassScreen />
          ) : (
            <>
              <div className="shop-head">
                <h1 className="ap-title">Plus</h1>
              </div>
              {/* Wave 2 E2: Joulz Plus (the offer, or a member's Plus), where Plus is open; else its calm card. */}
              <PlusPart soon={soon} />
            </>
          )}
        </div>
      ) : null}
    </PhoneShell>
  );
}
