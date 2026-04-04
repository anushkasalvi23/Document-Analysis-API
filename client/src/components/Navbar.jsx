import { SignedIn, SignedOut } from '@clerk/clerk-react'
import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const linkClass =
    'text-sm font-medium text-gray-600 transition hover:text-gray-900'

  const location = useLocation()
  const onHome = location.pathname === '/'

  const navHash = (id) => (onHome ? `#${id}` : `/#${id}`)

  const links = [
    { id: 'features', label: 'Features' },
    { id: 'how-it-works', label: 'How it works' },
    { id: 'pricing', label: 'Pricing' },
    { id: 'testimonials', label: 'Testimonials' },
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <nav className="mx-auto max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="font-heading text-xl font-bold tracking-tight text-gray-900"
          >
            SumDoc
          </Link>
          <ul className="hidden items-center gap-10 lg:flex">
            {links.map(({ id, label }) => (
              <li key={id}>
                <a href={navHash(id)} className={linkClass}>
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <SignedIn>
            <Link
              to="/dashboard"
              className="shrink-0 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] sm:px-5"
            >
              Go to Dashboard
            </Link>
          </SignedIn>
          <SignedOut>
            <Link
              to="/sign-up"
              className="shrink-0 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] sm:px-5"
            >
              Get Started
            </Link>
          </SignedOut>
        </div>
        <ul className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-gray-100 pt-4 lg:hidden">
          {links.map(({ id, label }) => (
            <li key={`m-${id}`}>
              <a
                href={navHash(id)}
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
