const quotes = [
  {
    text: 'SumDoc cut my contract review time in half. The entity cards alone are worth switching from manual highlighting.',
    name: 'Elena Marchetti',
    role: 'General Counsel',
    company: 'Northline Logistics',
  },
  {
    text: 'We pipe board packs through it before meetings. Summaries are tight, and sentiment flags help us prep talking points.',
    name: 'James Okonkwo',
    role: 'Strategy Director',
    company: 'Vellum Analytics',
  },
  {
    text: 'Clean UI, fast turnaround, and no document retention—exactly what our security team required for pilots.',
    name: 'Priya Natarajan',
    role: 'Head of IT',
    company: 'Crescent Health Systems',
  },
]

export default function Testimonials() {
  return (
    <section
      id="testimonials"
      className="scroll-mt-24 border-b border-gray-100 bg-white px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
          Trusted by professionals
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-lg text-gray-600">
          Teams use SumDoc to move faster without sacrificing rigor.
        </p>
        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {quotes.map((q) => (
            <blockquote
              key={q.name}
              className="flex flex-col rounded-2xl border border-gray-200 bg-gray-50 p-8"
            >
              <p className="text-base leading-relaxed text-gray-800">
                &ldquo;{q.text}&rdquo;
              </p>
              <footer className="mt-8 border-t border-gray-200 pt-6">
                <cite className="not-italic">
                  <span className="font-heading font-bold text-gray-900">
                    {q.name}
                  </span>
                  <span className="mt-1 block text-sm text-gray-600">
                    {q.role}, {q.company}
                  </span>
                </cite>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  )
}
