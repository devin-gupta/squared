import type { Metadata } from "next";
import { normalizeInvite } from "./auth/preferences";

export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL || "https://squared-omega.vercel.app",
);
const description =
  "Good trips. Clear tabs. Share expenses with your people and enjoy the time together.";
const image = {
  url: "/brand/share-card-v2.png",
  width: 1200,
  height: 630,
  type: "image/png",
  alt: "Squared: a mountain-trip postcard and a shared tab, illustrated in forest green and cream.",
};

export const socialMetadata: Metadata = {
  metadataBase: siteUrl,
  title: "Squared — Good trips. Clear tabs.",
  description,
  applicationName: "Squared",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Squared",
    title: "Good trips. Clear tabs.",
    description,
    images: [image],
  },
  twitter: {
    card: "summary_large_image",
    title: "Good trips. Clear tabs.",
    description,
    images: [image],
  },
};

export function homeMetadata(rawCode: string | string[] | undefined): Metadata {
  const code = typeof rawCode === "string" ? normalizeInvite(rawCode) : null;
  // Next 15's OG resolver drops queries on root URLs. Our existing /trip/CODE
  // route redirects to the same join flow, and preserves the code in previews.
  const url = new URL(code ? `/trip/${code}` : "/", siteUrl);
  const title = code
    ? "You’re invited. Join your people."
    : "Good trips. Clear tabs.";
  const detail = code
    ? "The trip is better together. Join your friends on Squared to share expenses and keep the good times simple."
    : description;
  // No database lookups or private trip information are exposed to crawlers.
  // Keep the invitation in og:url so preview taps never lose the join context.
  return {
    title: code ? "You’re invited — Squared" : socialMetadata.title,
    description: detail,
    openGraph: { ...socialMetadata.openGraph, title, description: detail, url },
    twitter: { ...socialMetadata.twitter, title, description: detail },
    ...(rawCode !== undefined
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}
