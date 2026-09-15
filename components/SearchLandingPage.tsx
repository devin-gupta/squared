import Link from "next/link";

type Section = {
  title: string;
  body: string;
};

export default function SearchLandingPage({
  eyebrow,
  title,
  introduction,
  sections,
  closingTitle,
  closingBody,
}: {
  eyebrow: string;
  title: string;
  introduction: string;
  sections: Section[];
  closingTitle: string;
  closingBody: string;
}) {
  return (
    <article className="mx-auto max-w-5xl space-y-16 py-10 sm:py-16">
      <header className="max-w-3xl">
        <p className="eyebrow mb-5">{eyebrow}</p>
        <h1 className="font-serif text-5xl leading-[1.08] tracking-[-0.045em] sm:text-6xl">
          {title}
        </h1>
        <p className="muted mt-6 max-w-2xl text-lg leading-8">
          {introduction}
        </p>
        <Link href="/" className="btn-primary mt-8">
          Try Squared free
        </Link>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {sections.map((section, index) => (
          <article key={section.title} className="panel p-6 sm:p-7">
            <p className="eyebrow">{String(index + 1).padStart(2, "0")}</p>
            <h2 className="mt-4 font-serif text-2xl">{section.title}</h2>
            <p className="muted mt-3 text-sm leading-6">{section.body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl bg-[#eaf0df] p-7 sm:p-10">
        <h2 className="font-serif text-3xl">{closingTitle}</h2>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[#475548]">
          {closingBody}
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
        >
          Start a shared trip tab
        </Link>
      </section>
    </article>
  );
}
