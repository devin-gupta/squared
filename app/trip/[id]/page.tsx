import type { Metadata } from "next";
import { normalizeInvite } from "@/lib/auth/preferences";
import { inviteName, inviteTitle } from "@/lib/trips/invite";
import { homeMetadata } from "@/lib/metadata";
import InviteActions from "@/components/InviteActions";
import Link from "next/link";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string | string[] }>;
};

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const [{ id }, { name }] = await Promise.all([params, searchParams]);
  return homeMetadata(id, name);
}

export default async function InvitePage({ params, searchParams }: Props) {
  const [{ id }, { name: rawName }] = await Promise.all([params, searchParams]);
  const code = normalizeInvite(id);
  const name = inviteName(rawName);
  if (!code)
    return (
      <section className="panel mx-auto max-w-lg p-8">
        <h1 className="font-serif text-3xl">This invite looks incomplete.</h1>
        <p className="muted mt-4">
          Ask your friend to share a fresh link from Squared.
        </p>
        <Link href="/" className="btn-secondary mt-6">
          Back to Squared
        </Link>
      </section>
    );
  return (
    <section className="panel mx-auto max-w-xl overflow-hidden">
      <img
        src="/brand/share-card-v2.png"
        width="1200"
        height="630"
        alt=""
        className="w-full"
        fetchPriority="high"
      />
      <div className="p-6 sm:p-8">
        <p className="eyebrow mb-3">A trip invitation</p>
        <h1 className="break-words font-serif text-3xl leading-tight tracking-tight sm:text-4xl">
          {inviteTitle(name)}
        </h1>
        <p className="muted mt-4 text-[1rem]">
          Track shared expenses, split bills, and settle up together. From the
          first coffee to the last cab home.
        </p>
        <p className="mt-4 text-xs text-[#5e6b5f]">
          No app download needed. Sign in to join; trip expenses stay private.
        </p>
        <InviteActions inviteCode={code} tripName={name} />
      </div>
    </section>
  );
}
