import { createFileRoute, useRouter } from "@tanstack/react-router";

import { TermsScreen } from "@/components/beta/TermsScreen";
import { APP_NAME } from "@/lib/brand";

export const Route = createFileRoute("/terms")({
  ssr: false,
  head: () => ({
    meta: [
      { title: `${APP_NAME} beta terms` },
      {
        name: "description",
        content: `The ${APP_NAME} early-access beta terms, in plain English.`,
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TermsPage,
});

/** /terms: the beta terms (Profile → settings links here); I AGREE until this device has agreed. */
function TermsPage() {
  const router = useRouter();
  const back = () => {
    if (window.history.length > 1) router.history.back();
    else void router.navigate({ to: "/profile" });
  };
  return <TermsScreen onAgree={back} onBack={back} />;
}
