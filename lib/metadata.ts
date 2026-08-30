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

export function homeMetadata(
  rawCode: string | string[] | undefined,
  name?: unknown,
): Metadata {
  const code = typeof rawCode === "string" ? normalizeInvite(rawCode) : null;
  // Next 15's OG resolver drops queries on root URLs. The /trip/CODE preview
  // preserves both the code and the optional public display label.
  const url = new URL(code ? invitePath(code, name)! : "/", siteUrl);
  const title = code ? invitePreviewTitle(name) : "Good trips. Clear tabs.";
  const detail = code ? inviteDescription : description;
  // Only the sender's display label is exposed; no database/private-data lookup.
  // Keep the invitation in og:url so preview taps never lose the join context.
  return {
    title: code ? `${title} — Squared` : socialMetadata.title,
    description: detail,
    openGraph: { ...socialMetadata.openGraph, title, description: detail, url },
    twitter: { ...socialMetadata.twitter, title, description: detail },
    ...(rawCode !== undefined
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}
