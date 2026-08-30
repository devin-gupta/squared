import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { socialMetadata } from "@/lib/metadata";

export const metadata: Metadata = {
  ...socialMetadata,
  manifest: "/manifest.json?v=2",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Squared",
  },
  icons: {
    icon: [
      {
        url: "/favicon.ico?v=2",
        sizes: "16x16 32x32 48x48",
        type: "image/x-icon",
      },
      { url: "/brand/mark.svg", sizes: "any", type: "image/svg+xml" },
      { url: "/brand/icon-32-v2.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-192-v2.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/brand/icon-180-v2.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F6F7F3",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3"
        >
          Skip to content
        </a>
        <Navigation />
        <main id="main-content" className="app-content">
          {children}
        </main>
      </body>
    </html>
  );
}
