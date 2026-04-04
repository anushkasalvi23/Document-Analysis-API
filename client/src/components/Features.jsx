import {
  Brain,
  FileStack,
  Gauge,
  ScanSearch,
  ShieldCheck,
  Smile,
} from 'lucide-react'

const items = [
  {
    icon: Brain,
    title: 'Instant Summarization',
    desc: 'Concise summaries in seconds so you can grasp any document fast.',
  },
  {
    icon: ScanSearch,
    title: 'Entity Extraction',
    desc: 'Detect names, dates, organizations, and amounts automatically.',
  },
  {
    icon: Smile,
    title: 'Sentiment Analysis',
    desc: 'Understand tone at a glance—positive, neutral, or negative.',
  },
  {
    icon: FileStack,
    title: 'Multi-format Support',
    desc: 'PDF, DOCX, and image files—all handled in one workflow.',
  },
  {
    icon: ShieldCheck,
    title: 'Secure Processing',
    desc: 'Documents are analyzed in transit and never stored on our servers.',
  },
  {
    icon: Gauge,
    title: 'Fast and Accurate',
    desc: 'Powered by state-of-the-art AI models for reliable results.',
  },
]

export default function Features() {
  return (
    <section
      id="features"
      className="scroll-mt-24 border-b border-gray-100 bg-white px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
          Everything you need to analyze documents
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-center text-lg text-gray-600">
          One platform for summaries, structured data, and insight—without the
          busywork.
        </p>
        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-gray-200 bg-gray-50 p-8 transition hover:border-gray-300"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#2563eb] shadow-sm ring-1 ring-gray-100">
                <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
              </div>
              <h3 className="mt-6 font-heading text-lg font-bold text-gray-900">
                {title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
