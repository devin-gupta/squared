import type { MetadataRoute } from "next";
import { absoluteUrl, publicSearchPages } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicSearchPages.map((path) => ({
    url: absoluteUrl(path),
  }));
}
