import { Fragment } from 'react'

const steps = [
  {
    title: 'Upload your document',
    desc: 'Drop a PDF, Word file, or image—or paste a direct link. No account needed to try.',
  },
  {
    title: 'AI analyzes and extracts key information',
    desc: 'Our models read the full text, identify entities, and score sentiment in one pass.',
  },
  {
    title: 'Get your summary, entities, and sentiment instantly',
    desc: 'Review structured results and ask follow-up questions in plain language.',
  },
]

export default function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 border-b border-gray-100 bg-white px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-center font-heading text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl">
          As simple as 1, 2, 3
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-lg text-gray-600">
          From file to insight in three clear steps.
        </p>

        <div className="mx-auto mt-16 hidden max-w-5xl items-start md:flex">
          {steps.map((step, i) => (
            <Fragment key={step.title}>
              {i > 0 ? (
                <div className="flex min-h-14 min-w-[1.5rem] flex-1 items-center">
                  <div className="h-px w-full bg-gray-300" aria-hidden />
                </div>
              ) : null}
              <div className="flex w-44 shrink-0 flex-col items-center text-center sm:w-48 lg:w-52">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-[#2563eb] bg-white font-heading text-xl font-bold text-[#2563eb]">
                  {i + 1}
                </div>
                <h3 className="mt-6 font-heading text-lg font-bold text-gray-900">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">
                  {step.desc}
                </p>
              </div>
            </Fragment>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-10 md:hidden">
          {steps.map((step, i) => (
            <div key={step.title} className="flex gap-5">
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-[#2563eb] bg-white font-heading text-lg font-bold text-[#2563eb]">
                  {i + 1}
                </div>
                {i < steps.length - 1 ? (
                  <div
                    className="mt-2 min-h-[2rem] w-px flex-1 bg-gray-300"
                    aria-hidden
                  />
                ) : null}
              </div>
              <div className="pt-1">
                <h3 className="font-heading text-lg font-bold text-gray-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                  {step.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
