import { ChevronDown, FileCheck, Star } from 'lucide-react'

const heroCss = `
@keyframes hero-scroll-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(8px);
  }
}

.hero-scroll-chevron {
  animation: hero-scroll-bounce 1.2s ease-in-out infinite;
}

@media (prefers-reduced-motion: reduce) {
  .hero-scroll-chevron {
    animation: none !important;
  }
}
`

export default function Hero() {
  function scrollToFeatures() {
    document.getElementById('features')?.scrollIntoView({
      behavior: 'smooth',
    })
  }

  const vbW = 1000
  const vbH = 700
  const cx = vbW / 2
  const cy = vbH / 2

  const rings = [
    { r: 322, gray: '#ebecef', blueRot: 12, dash: '88 2100' },
    { r: 246, gray: '#e8eaee', blueRot: 138, dash: '72 2100' },
  ]

  return (
    <section className="relative min-h-[32rem] overflow-hidden bg-white md:min-h-[38rem]">
      <style>{heroCss}</style>

      <svg
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        {rings.map(({ r, gray, blueRot, dash }) => (
          <g key={r}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={gray}
              strokeWidth="1"
            />
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="#2563eb"
              strokeWidth="1.5"
              strokeOpacity="0.22"
              strokeDasharray={dash}
              strokeLinecap="round"
              transform={`rotate(${blueRot} ${cx} ${cy})`}
            />
          </g>
        ))}
      </svg>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-24 md:py-28 lg:px-8">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-gray-500 sm:text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Star
              className="h-4 w-4 fill-amber-400 text-amber-400"
              strokeWidth={0}
              aria-hidden
            />
            <span>4.9 on Trustpilot</span>
          </span>
          <span className="text-gray-300" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FileCheck className="h-4 w-4 text-gray-400" strokeWidth={2} />
            <span>Trusted by 10,000+ users</span>
          </span>
        </div>

        <p className="mt-6 font-heading text-xs font-semibold uppercase tracking-[0.2em] text-[#2563eb]">
          SumDoc
        </p>

        <h1 className="font-heading mt-3 text-4xl font-extrabold leading-[1.08] tracking-tight text-gray-900 sm:text-5xl md:text-6xl md:leading-[1.05]">
          Summarize and analyze any document,{' '}
          <span className="text-[#2563eb]">instantly</span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-gray-600 md:text-lg">
          SumDoc turns PDFs, Word files, and images into clear summaries, smart
          entity cards, and sentiment insights in seconds.
        </p>

        <div className="mt-10 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center sm:justify-center">
          <a
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-full bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            Get started free
          </a>
          <a
            href="#how-it-works"
            className="inline-flex items-center justify-center rounded-full border-2 border-gray-900 bg-white px-6 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-50"
          >
            See how it works
          </a>
        </div>

        <div className="mt-12 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={scrollToFeatures}
            className="group flex flex-col items-center gap-2 text-gray-500 transition hover:text-gray-800"
          >
            <span className="text-xs font-medium sm:text-sm">
              Scroll to explore features
            </span>
            <ChevronDown
              className="hero-scroll-chevron h-6 w-6 text-[#2563eb] group-hover:text-[#1d4ed8]"
              strokeWidth={2.25}
              aria-hidden
            />
          </button>
        </div>
      </div>
    </section>
  )
}
