import type { Metadata } from "next";
import SearchLandingPage from "@/components/SearchLandingPage";
import { absoluteUrl } from "@/lib/seo";

const title = "An AI-First Splitwise Alternative for Travel";
const description =
  "Looking for an AI-powered group expense app? See how Squared simplifies receipt entry, travel splits, currencies, and settling up.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/splitwise-alternative" },
  openGraph: {
    title: `${title} — Squared`,
    description,
    url: absoluteUrl("/splitwise-alternative"),
  },
};

export default function SplitwiseAlternativePage() {
  return (
    <SearchLandingPage
      eyebrow="An AI-first group expense app"
      title="A travel-focused alternative for splitting expenses."
      introduction="If you are searching for an AI Splitwise alternative, Squared offers a lightweight, browser-based workflow for group trips. Capture the purchase, choose the people and shares, and let the trip tab keep the balances straight."
      sections={[
        {
          title: "Less manual receipt entry",
          body: "Start from a receipt image or a plain-language expense description, then confirm the merchant, amount, payer, category, and split.",
        },
        {
          title: "A trip is the shared workspace",
          body: "Invite travelers into one focused tab where they can see expenses, search by payee, filter categories, and understand the running balance.",
        },
        {
          title: "Flexible shares for real groups",
          body: "Handle equal splits, custom amounts, and item-level receipt shares when only some people joined or everyone ordered differently.",
        },
        {
          title: "Balances you can explain",
          body: "Squared shows what a person paid for, what they spent, and their net balance so the final settlement remains easy to verify.",
        },
      ]}
      closingTitle="Choose the workflow that fits your group."
      closingBody="Squared is an independent product and is not affiliated with Splitwise. Product features and availability can change, so compare the current tools directly if your group needs a specific integration or payment method."
    />
  );
}
