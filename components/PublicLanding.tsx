"use client";

import Link from "next/link";
import AuthModal from "./AuthModal";
import Icon from "./Icon";

export default function PublicLanding({
  showAuth,
  onOpenAuth,
  onCloseAuth,
}: {
  showAuth: boolean;
  onOpenAuth: () => void;
  onCloseAuth: () => void;
}) {
  return (
    <>
      <div className="space-y-20 py-8 sm:py-12">
        <div className="grid items-center gap-10 xl:grid-cols-[1.1fr_1fr]">
          <section>
            <p className="eyebrow mb-6">AI travel expenses for groups</p>
            <h1 className="font-serif text-5xl leading-[1.08] tracking-[-0.05em] sm:text-6xl">
              Share the trip.
              <br />
              <span className="text-[#799260]">Skip the math.</span>
            </h1>
            <p className="muted mt-6 max-w-lg text-[1rem] leading-7">
              Squared is an AI travel expense splitter for friends and groups.
              Add a receipt or describe what happened, split costs by who
              actually spent, and settle the trip without a spreadsheet.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button onClick={onOpenAuth} className="btn-primary">
                Get started
                <Icon name="arrow" width="17" />
              </button>
              <Link
                href="/ai-travel-expense-splitter"
                className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
              >
                See how it works
              </Link>
            </div>
            <p className="muted mt-3 text-xs">
              Google or an email link. No password or app download required.
            </p>
            {process.env.NODE_ENV === "development" && (
              <Link
                href="/preview"
                className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4"
              >
                Explore the sample trip
                <Icon name="arrow" width="15" />
              </Link>
            )}
          </section>
          <section className="panel relative overflow-hidden p-7 sm:p-9">
            <div className="mb-8 flex items-center justify-between">
              <span className="eyebrow">A weekend together</span>
              <span className="rounded-full bg-[#edf1e9] px-3 py-1 text-[10px] font-medium">
                SHARED TAB
              </span>
            </div>
            <h2 className="font-serif text-3xl">
              Little moments.
              <br />
              All accounted for.
            </h2>
            <div className="my-7 divide-y divide-[#edf0e8]">
              {[
                {
                  icon: "coffee" as const,
                  title: "Coffee for the road",
                  subtitle: "You paid · split equally",
                  amount: "$24.00",
                },
                {
                  icon: "home" as const,
                  title: "A place to call home",
                  subtitle: "Alex paid · split equally",
                  amount: "$480.00",
                },
                {
                  icon: "travel" as const,
                  title: "The scenic route",
                  subtitle: "Sam paid · split equally",
                  amount: "$96.00",
                },
              ].map((transaction) => (
                <div
                  key={transaction.title}
                  className="flex items-center gap-3 py-5"
                >
                  <span className="icon-tile">
                    <Icon name={transaction.icon} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{transaction.title}</p>
                    <p className="mt-1 text-xs text-[#5e6b5f]">
                      {transaction.subtitle}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">
                    {transaction.amount}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 rounded-xl bg-[#eaf0df] p-4 text-xs">
              <Icon name="check" className="shrink-0" />
              Everyone in the loop. Everything in one place.
            </div>
          </section>
        </div>

        <section aria-labelledby="how-it-works">
          <p className="eyebrow mb-3">How it works</p>
          <h2 id="how-it-works" className="max-w-2xl font-serif text-4xl">
            From receipt to settled in three simple steps.
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              [
                "01",
                "Add the expense",
                "Upload a receipt or type a quick description. Squared helps turn it into a clean expense entry.",
              ],
              [
                "02",
                "Split the real spend",
                "Choose who paid, who participated, and whether the bill was equal, custom, or itemized.",
              ],
              [
                "03",
                "Settle the difference",
                "See what each person paid for, what they spent, and the net amount needed to settle up.",
              ],
            ].map(([step, title, copy]) => (
              <article key={step} className="panel p-6">
                <p className="eyebrow">{step}</p>
                <h3 className="mt-4 font-serif text-2xl">{title}</h3>
                <p className="muted mt-3 text-sm leading-6">{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel grid gap-6 p-7 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="eyebrow mb-3">A simpler group-expense workflow</p>
            <h2 className="font-serif text-3xl">
              Looking for an AI-first Splitwise alternative?
            </h2>
            <p className="muted mt-3 max-w-2xl text-sm leading-6">
              Squared keeps travel receipts, multi-currency expenses, custom
              shares, and the final settlement together in one browser-based
              trip tab.
            </p>
          </div>
          <Link href="/splitwise-alternative" className="btn-secondary">
            Compare the workflow
          </Link>
        </section>
      </div>
      <AuthModal isOpen={showAuth} onClose={onCloseAuth} />
    </>
  );
}
