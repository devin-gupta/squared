import type { Metadata } from "next";
import HomePage from "@/components/HomePage";
import { homeMetadata } from "@/lib/metadata";
import { softwareApplicationJsonLd } from "@/lib/seo";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const { code } = await searchParams;
  return homeMetadata(code);
}

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationJsonLd).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />
      <HomePage />
    </>
  );
}
