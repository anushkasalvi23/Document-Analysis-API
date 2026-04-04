export default function Navbar() {
  const linkClass =
    'text-sm font-medium text-gray-600 transition hover:text-gray-900'

  const links = [
    { href: '#features', label: 'Features' },
    { href: '#how-it-works', label: 'How it works' },
    { href: '#pricing', label: 'Pricing' },
    { href: '#testimonials', label: 'Testimonials' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <nav className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <a
            href="#"
            className="font-heading text-xl font-bold tracking-tight text-gray-900"
          >
            SumDoc
          </a>
          <ul className="hidden items-center gap-10 lg:flex">
            {links.map(({ href, label }) => (
              <li key={href}>
                <a href={href} className={linkClass}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <a
            href="#upload-section"
            className="shrink-0 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] sm:px-5"
          >
            Get Started
          </a>
        </div>
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-gray-100 pt-4 lg:hidden">
          {links.map(({ href, label }) => (
            <li key={`m-${href}`}>
              <a
                href={href}
                className="text-xs font-semibold text-gray-600 hover:text-gray-900"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
