const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
      { label: 'Security', href: '#' },
    ],
  },
]

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <p className="font-heading text-xl font-bold text-gray-900">
              SumDoc
            </p>
            <p className="mt-3 text-sm leading-relaxed text-gray-600">
              Summarize and analyze any document, instantly—PDFs, Word, and
              images with summaries, entities, and sentiment.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:gap-16">
            {columns.map((col) => (
              <div key={col.title}>
                <p className="font-heading text-xs font-bold uppercase tracking-widest text-gray-400">
                  {col.title}
                </p>
                <ul className="mt-4 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm font-medium text-gray-600 transition hover:text-gray-900"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-14 border-t border-gray-200 pt-8">
          <p className="text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} SumDoc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
