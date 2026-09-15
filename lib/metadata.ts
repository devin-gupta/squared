import type { Metadata } from "next";
import { normalizeInvite } from "./auth/preferences";
import {
  invitePath,
  invitePreviewTitle,
  inviteDescription,
} from "./trips/invite";

export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL || "https://squared-omega.vercel.app",
);
const description =
  "Split group travel expenses with AI-assisted receipt entry, flexible shares, multiple currencies, and clear settlement totals.";
const image = {
  url: "/brand/share-card-v2.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "Squared: a mountain-trip postcard and a shared tab, illustrated in forest green and cream.",
};

export const socialMetadata: Metadata = {
  metadataBase: siteUrl,
  title: "Squared — AI Travel Expense Splitter",
  description,
  applicationName: "Squared",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Squared",
    title: "Squared — AI Travel Expense Splitter",
    description,
    images: [image],
  },
  twitter: {
    card: "summary_large_image",
    title: "Squared — AI Travel Expense Splitter",
    description,
    images: [image],
  },
};

export function homeMetadata(
  rawCode: string | string[] | undefined,
  name?: unknown,
): Metadata {
  const code = typeof rawCode === "string" ? normalizeInvite(rawCode) : null;
  // Next 15's OG resolver drops queries on root URLs. The /trip/CODE preview
  // preserves both the code and the optional public display label.
  const url = new URL(code ? invitePath(code, name)! : "/", siteUrl);
  const title = code
    ? invitePreviewTitle(name)
    : "Squared — AI Travel Expense Splitter";
  const detail = code ? inviteDescription : description;
  // Only the sender's display label is exposed; no database/private-data lookup.
  // Keep the invitation in og:url so preview taps never lose the join context.
  return {
    title: code ? `${title} — Squared` : socialMetadata.title,
    description: detail,
    verification: {
      google: "rPs0rHDOm2C3Pb8c2ZSsJ30zhjfdjKQ6uOpT9XgZ-Nc",
    },
    openGraph: { ...socialMetadata.openGraph, title, description: detail, url },
    twitter: { ...socialMetadata.twitter, title, description: detail },
    ...(!code ? { alternates: { canonical: "/" } } : {}),
    ...(rawCode !== undefined
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}
