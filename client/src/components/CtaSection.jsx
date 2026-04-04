export default function CtaSection() {
  return (
    <section className="bg-[#0f172a] px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Start analyzing your documents today
        </h2>
        <p className="mt-5 text-lg text-gray-300">
          No credit card required. Get started in seconds.
        </p>
        <a
          href="#upload-section"
          className="mt-10 inline-flex min-w-[240px] items-center justify-center rounded-lg bg-[#2563eb] px-10 py-4 text-base font-semibold text-white transition hover:bg-[#1d4ed8]"
        >
          Try SumDoc Free
        </a>
      </div>
    </section>
  )
}
