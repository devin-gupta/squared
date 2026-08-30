"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

export function Brand() {
  return (
    <span className="inline-flex items-center gap-3">
      <img
        src="/brand/mark.svg"
        width="36"
        height="36"
        alt=""
        className="h-9 w-9 shrink-0"
      />
      <span className="text-xl font-semibold tracking-[-0.06em]">
        squared<span className="text-[#8c9e72]">.</span>
      </span>
    </span>
  );
}

export default function Navigation() {
  const pathname = usePathname();
  const preview = pathname.startsWith("/preview");
  const base = preview ? "/preview" : "";
  const items = [
    { path: base || "/", label: "Overview", icon: "overview" as const },
    { path: `${base}/feed`, label: "Expenses", icon: "ledger" as const },
    { path: `${base}/settle`, label: "Settle up", icon: "balance" as const },
  ];
  return (
    <>
      <header className="flex items-center justify-between border-b border-[#e1e5dc] bg-white px-5 py-4 lg:hidden">
        <Link href={base || "/"} aria-label="Squared home">
          <Brand />
        </Link>
        <span className="eyebrow">
          {preview ? "Local preview" : "Better together"}
        </span>
      </header>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-[#e1e5dc] bg-[#fbfcf9] px-5 py-9 lg:flex">
        <Link
          href={base || "/"}
          className="mb-14 px-3"
          aria-label="Squared home"
        >
          <Brand />
        </Link>
        <p className="eyebrow mb-4 px-3">Your workspace</p>
        <nav aria-label="Main navigation" className="space-y-2">
          {items.map((item) => (
            <Link
              key={item.path}
              href={item.path}
              aria-current={pathname === item.path ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium transition-colors ${pathname === item.path ? "bg-[#e7eddf] text-accent" : "text-[#5e6b5f] hover:bg-[#f0f3ec]"}`}
            >
              <Icon name={item.icon} />
              {item.label}
              {pathname === item.path && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#557344]" />
              )}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-[#e1e5dc] p-4">
          <Icon name="travel" className="mb-3 text-[#6d845a]" />
          <p className="font-serif text-xl">
            Good trips.
            <br />
            Clear tabs.
          </p>
          <p className="muted mt-2 text-xs">
            A little less math.
            <br />A little more together.
          </p>
        </div>
        {process.env.NODE_ENV === "development" && (
          <Link
            href={preview ? "/" : "/preview"}
            className="mt-5 px-3 text-xs font-medium text-[#5e6b5f] underline underline-offset-4"
          >
            {preview ? "Open connected app" : "Explore sample trip"}
          </Link>
        )}
        <p className="mt-5 px-3 text-[10px] tracking-wide text-[#5e6b5f]">
          SHARED MOMENTS. SHARED EXPENSES.
        </p>
      </aside>
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-[#e1e5dc] bg-white/95 px-3 pt-2 backdrop-blur-lg lg:hidden"
        style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
      >
        {items.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            aria-current={pathname === item.path ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium ${pathname === item.path ? "bg-[#edf1e9] text-accent" : "text-[#5e6b5f]"}`}
          >
            <Icon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}
