const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    features: [
      '10 documents per month',
      'PDF and DOCX',
      'Basic summary',
    ],
    cta: 'Get started',
    href: '#upload-section',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    features: [
      'Unlimited documents',
      'All formats including images',
      'Entity extraction',
      'Sentiment analysis',
      'Priority processing',
    ],
    cta: 'Start Pro trial',
    href: '#upload-section',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    features: [
      'Everything in Pro',
      'API access',
      'Custom integrations',
      'Dedicated support',
    ],
    cta: 'Contact sales',
    href: '#',
    highlight: false,
  },
]

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="scroll-mt-24 border-b border-gray-100 bg-white px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
          Simple, transparent pricing
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-lg text-gray-600">
          Start free, scale when you need more power and support.
        </p>
        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl border bg-gray-50 p-8 ${
                tier.highlight
                  ? 'border-2 border-[#2563eb] shadow-md ring-1 ring-[#2563eb]/10'
                  : 'border-gray-200'
              }`}
            >
              {tier.highlight ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#2563eb] px-4 py-1 text-xs font-bold uppercase tracking-wide text-white">
                  Most Popular
                </span>
              ) : null}
              <h3 className="font-heading text-xl font-bold text-gray-900">
                {tier.name}
              </h3>
              <p className="mt-4 flex items-baseline gap-1">
                <span className="font-heading text-4xl font-extrabold text-gray-900">
                  {tier.price}
                </span>
                {tier.period ? (
                  <span className="text-sm text-gray-600">{tier.period}</span>
                ) : null}
              </p>
              <ul className="mt-8 flex flex-1 flex-col gap-3 text-sm text-gray-600">
                {tier.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2563eb]" />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={tier.href}
                className={`mt-10 inline-flex w-full items-center justify-center rounded-lg px-6 py-3.5 text-sm font-semibold transition ${
                  tier.highlight
                    ? 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]'
                    : 'border-2 border-gray-900 bg-white text-gray-900 hover:bg-gray-50'
                }`}
              >
                {tier.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
