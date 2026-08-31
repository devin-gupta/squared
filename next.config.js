const withPWA = require("next-pwa")({
  dest: "public",
  // App Router registration lives in DeviceOptions; next-pwa 5 only injects
  // its automatic registration into the old Pages Router main.js entry.
  register: false,
  skipWaiting: true,
  importScripts: ["/push-worker.js"],
  disable: process.env.NODE_ENV === "development",
  // These App Router build manifests are not public URLs. Precaching their
  // 404 responses rejects the entire worker install, including push support.
  buildExcludes: [/middleware-manifest\.json$/, /app-build-manifest\.json$/],
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      // Never recover auth responses or another account's data from a PWA cache.
      handler: "NetworkOnly",
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Messages fetches pages without executing JS, using varying user agents.
  // Our metadata is cheap and private-data-free; put it in <head> for everyone.
  htmlLimitedBots: /.*/,
  images: {
    domains: [],
  },
};

module.exports = withPWA(nextConfig);
