import type { Metadata } from "next";
import SearchLandingPage from "@/components/SearchLandingPage";
import { absoluteUrl, productDescription } from "@/lib/seo";

const title = "AI Travel Expense Splitter for Group Trips";
const description =
  "Use AI-assisted entry to split group travel receipts, track multiple currencies, and calculate a clear final settlement with Squared.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/ai-travel-expense-splitter" },
  openGraph: {
    title: `${title} — Squared`,
    description,
    url: absoluteUrl("/ai-travel-expense-splitter"),
  },
};

export default function AiTravelExpenseSplitterPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: title,
            url: absoluteUrl("/ai-travel-expense-splitter"),
            description: productDescription,
          }).replace(/</g, "\\u003c"),
        }}
      />
      <SearchLandingPage
        eyebrow="AI travel expense splitting"
        title="Turn a group-trip receipt into a fair split."
        introduction="Squared brings receipt entry, group shares, currency conversion, and settling up into one trip tab. It is built for the messy reality of travel: one person books the stay, another gets dinner, and not everyone joins every expense."
        sections={[
          {
            title: "Capture expenses quickly",
            body: "Upload a receipt or describe a purchase in plain language. Review the suggested details before anything is added to the group tab.",
          },
          {
            title: "Split by who actually spent",
            body: "Use equal shares when they fit, custom amounts when they do not, or assign receipt items to the people who ordered them.",
          },
          {
            title: "Keep currencies understandable",
            body: "Record purchases in their local currency while keeping a consistent view of the trip's shared totals and balances.",
          },
          {
            title: "Settle one net balance",
            body: "Compare what each traveler paid for with what they spent, then use the net balance to finish the trip cleanly.",
          },
        ]}
        closingTitle="Made for the trip, not bookkeeping."
        closingBody="A good travel expense tool should reduce admin without hiding the numbers. Every suggested expense stays reviewable, every split can be adjusted, and the final balance follows from the group's actual payments and shares."
      />
    </>
  );
}
