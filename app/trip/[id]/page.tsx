import { redirect } from "next/navigation";

// Keep old /trip/CODE invites on the same authenticated join path as shared links.
export default async function JoinTripPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/?code=${encodeURIComponent(id)}`);
}
