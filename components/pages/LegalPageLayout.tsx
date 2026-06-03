import { Link } from "react-router-dom";

export default function LegalPageLayout({
  eyebrow,
  title,
  intro,
  updated,
  children,
}) {
  return (
    <div className="bg-[linear-gradient(180deg,#fbf7f1_0%,#ffffff_28%,#ffffff_100%)]">
      <section className="mx-auto max-w-5xl px-6 py-14 md:px-10 lg:px-14">
        <div className="overflow-hidden rounded-[32px] border border-neutral-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
          <header className="border-b border-neutral-200 px-6 py-8 sm:px-10">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-neutral-500">
                {eyebrow}
              </p>
            ) : null}
            <h1
              className="mt-3 text-3xl font-semibold text-neutral-950 sm:text-5xl"
              style={{
                fontFamily: '"Cormorant Garamond", Georgia, "Times New Roman", serif',
              }}
            >
              {title}
            </h1>
            {intro ? (
              <p className="mt-4 max-w-3xl text-base leading-7 text-neutral-600 sm:text-lg">
                {intro}
              </p>
            ) : null}
            {updated ? (
              <p className="mt-4 text-sm text-neutral-500">Last updated: {updated}</p>
            ) : null}
          </header>

          <div className="px-6 py-8 sm:px-10">{children}</div>

          <footer className="border-t border-neutral-200 px-6 py-6 sm:px-10">
            <Link
              to="/"
              className="text-sm font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
            >
              Back to home
            </Link>
          </footer>
        </div>
      </section>
    </div>
  );
}
