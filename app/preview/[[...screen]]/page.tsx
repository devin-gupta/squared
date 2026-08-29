import { notFound } from "next/navigation";
import DesignPreview from "@/components/DesignPreview";

export default async function PreviewPage({
  params: paramsPromise,
}: {
  params: Promise<{ screen?: string[] }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await paramsPromise;
  const screen = params.screen?.[0] || "overview";
  if (
    (params.screen?.length || 0) > 1 ||
    !["overview", "feed", "settle"].includes(screen)
  )
    notFound();
  return <DesignPreview screen={screen} />;
}
