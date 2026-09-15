import { siteUrl } from "./metadata";

export const publicSearchPages = [
  "/",
  "/ai-travel-expense-splitter",
  "/splitwise-alternative",
] as const;

export const productDescription =
  "Split group travel expenses with AI-assisted receipt entry, flexible shares, multiple currencies, and clear settlement totals.";

export function absoluteUrl(path: string) {
  return new URL(path, siteUrl).href;
}

export const softwareApplicationJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Squared",
  url: absoluteUrl("/"),
  description: productDescription,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires a modern web browser",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "AI-assisted travel expense entry",
    "Receipt-based expense splitting",
    "Multi-currency group expenses",
    "Equal, custom, and itemized splits",
    "Group settlement calculations",
  ],
};
