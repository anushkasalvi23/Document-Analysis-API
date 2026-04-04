import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
  useUser,
} from '@clerk/clerk-react'
import { Navigate } from 'react-router-dom'
import { Crown, FileText, LayoutGrid, Menu, PanelLeft, Trash2 } from 'lucide-react'
import UploadSection from '../components/UploadSection.jsx'
import {
  deleteDocument,
  fetchDocumentById,
  fetchDocuments,
} from '../lib/documentApi.js'

function startOfDay(ts) {
  const d = new Date(ts)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function groupDocumentsByLabel(documents) {
  const todayStart = startOfDay(Date.now())
  const yesterdayStart = todayStart - 86400000
  const today = []
  const yesterday = []
  const earlier = []
  for (const doc of documents) {
    const t = new Date(doc.createdAt).getTime()
    if (Number.isNaN(t)) {
      earlier.push(doc)
      continue
    }
    const day = startOfDay(t)
    if (day === todayStart) today.push(doc)
    else if (day === yesterdayStart) yesterday.push(doc)
    else earlier.push(doc)
  }
  return { today, yesterday, earlier }
}

function DocListGroup({ label, items, selectedId, onPick, onDelete, deletingId }) {
  if (!items.length) return null
  return (
    <div>
      <p className="mb-2 px-1 text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">
        {label}
      </p>
      <ul className="space-y-0.5">
        {items.map((d) => (
          <li key={d.id} className="flex items-stretch gap-0.5">
            <button
              type="button"
              onClick={() => onPick(d)}
              className={`min-w-0 flex-1 truncate rounded-md px-2 py-2 text-left text-xs text-gray-300 transition hover:bg-gray-800 ${
                selectedId === d.id ? 'bg-gray-800 text-white' : ''
              }`}
            >
              {d.fileName}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete(d)
              }}
              disabled={deletingId === d.id}
              className="shrink-0 rounded-md p-2 text-gray-500 transition hover:bg-gray-800 hover:text-red-400 disabled:opacity-40"
              aria-label={`Delete ${d.fileName}`}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <>
      <SignedIn>
        <DashboardInner />
      </SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  )
}

function DashboardInner() {
  const { userId } = useAuth()
  const { user } = useUser()
  const displayName =
    user?.fullName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress ||
    'Account'
  const [documents, setDocuments] = useState([])
  const [loadError, setLoadError] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [resetKey, setResetKey] = useState(0)
  const [deletingId, setDeletingId] = useState(null)
  const listRef = useRef(null)

  const loadList = useCallback(async () => {
    if (!userId) return
    setLoadError('')
    try {
      const list = await fetchDocuments(userId)
      setDocuments(list)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load documents.')
    }
  }, [userId])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const grouped = useMemo(() => groupDocumentsByLabel(documents), [documents])

  const startNewAnalysis = useCallback(() => {
    setSelectedDoc(null)
    setResetKey((k) => k + 1)
    setMobileOpen(false)
  }, [])

  const scrollToListTop = useCallback(() => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const pickDoc = useCallback(
    async (doc) => {
      if (!userId) return
      setMobileOpen(false)
      try {
        const full = await fetchDocumentById(userId, doc.id)
        setSelectedDoc(full)
      } catch {
        setSelectedDoc(doc)
      }
    },
    [userId],
  )

  const handleDeleteDoc = useCallback(
    async (doc) => {
      if (!userId || !doc?.id) return
      if (!window.confirm(`Delete "${doc.fileName}" permanently?`)) return
      setDeletingId(doc.id)
      setLoadError('')
      try {
        await deleteDocument(userId, doc.id)
        if (selectedDoc?.id === doc.id) {
          setSelectedDoc(null)
          setResetKey((k) => k + 1)
        }
        await loadList()
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Could not delete.')
      } finally {
        setDeletingId(null)
      }
    },
    [userId, selectedDoc?.id, loadList],
  )

  const showExpanded = mobileOpen || !sidebarCollapsed
  const asideClass = showExpanded ? 'w-72' : 'w-72 lg:w-[4.5rem]'

  return (
    <div className="flex h-dvh max-h-dvh min-h-0 overflow-hidden bg-[#111827]">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed z-50 flex h-dvh max-h-dvh ${asideClass} flex-col border-r border-gray-800 bg-[#111827] transition-all duration-200 lg:static lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div
          className={`flex shrink-0 border-b border-gray-800 px-2 py-4 ${showExpanded ? 'items-center justify-between gap-2' : 'flex-col items-center gap-3 lg:px-1'}`}
        >
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-6 w-6 shrink-0 text-[#2563eb]" aria-hidden />
            {showExpanded ? (
              <span className="truncate font-heading text-lg font-bold text-white">
                SumDoc
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            className="shrink-0 rounded-lg p-2 text-gray-400 transition hover:bg-gray-800 hover:text-white"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <PanelLeft
              className={`h-5 w-5 ${sidebarCollapsed ? '' : 'lg:scale-x-[-1]'}`}
              aria-hidden
            />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-3 pb-3 pt-2">
          <button
            type="button"
            onClick={startNewAnalysis}
            className={`flex w-full items-center justify-center gap-2 rounded-lg bg-[#2563eb] py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] ${showExpanded ? 'px-4' : 'lg:px-2'}`}
          >
            <span className="text-lg leading-none">+</span>
            {showExpanded ? <span>Start New Analysis</span> : null}
          </button>

          {showExpanded ? (
            <button
              type="button"
              onClick={scrollToListTop}
              className="flex w-full items-center gap-2 rounded-lg border border-gray-700 bg-gray-800/50 px-3 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-gray-800"
            >
              <LayoutGrid className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              <span>All Documents</span>
            </button>
          ) : null}

          {showExpanded ? (
            <div
              ref={listRef}
              className="scrollbar-panel min-h-0 flex-1 space-y-4 overflow-y-auto py-1"
            >
              {loadError ? (
                <p className="text-xs text-red-400">{loadError}</p>
              ) : null}
              <DocListGroup
                label="Today"
                items={grouped.today}
                selectedId={selectedDoc?.id}
                onPick={pickDoc}
                onDelete={handleDeleteDoc}
                deletingId={deletingId}
              />
              <DocListGroup
                label="Yesterday"
                items={grouped.yesterday}
                selectedId={selectedDoc?.id}
                onPick={pickDoc}
                onDelete={handleDeleteDoc}
                deletingId={deletingId}
              />
              <DocListGroup
                label="Earlier"
                items={grouped.earlier}
                selectedId={selectedDoc?.id}
                onPick={pickDoc}
                onDelete={handleDeleteDoc}
                deletingId={deletingId}
              />
              {!loadError &&
              !grouped.today.length &&
              !grouped.yesterday.length &&
              !grouped.earlier.length ? (
                <p className="px-1 text-xs text-gray-500">
                  No saved documents yet.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="hidden min-h-0 flex-1 lg:block" aria-hidden />
          )}
        </div>

        {showExpanded ? (
          <div className="mt-auto shrink-0 border-t border-gray-800 p-3">
            <div className="rounded-xl bg-gradient-to-b from-gray-800/95 to-gray-900/90 p-4 ring-1 ring-gray-700/50">
              <div className="mb-4 flex items-center gap-3 border-b border-gray-700/50 pb-4">
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox:
                        'h-10 w-10 ring-2 ring-[#2563eb]/35 shadow-md',
                    },
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">
                    Signed in as
                  </p>
                  <p className="truncate font-heading text-sm font-semibold text-white">
                    {displayName}
                  </p>
                </div>
              </div>
              <Crown
                className="mb-2 h-5 w-5 text-amber-400"
                strokeWidth={1.75}
                aria-hidden
              />
              <p className="font-heading text-sm font-bold text-white">
                Upgrade to Pro
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">
                Unlimited documents, all formats, priority processing
              </p>
              <button
                type="button"
                className="mt-4 w-full rounded-lg bg-[#2563eb] py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]"
              >
                Get SumDoc Pro
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-auto flex shrink-0 justify-center border-t border-gray-800 p-3">
            <UserButton afterSignOutUrl="/" />
          </div>
        )}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
        <header className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-3 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-gray-700 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
          <span className="font-heading font-semibold text-gray-900">
            SumDoc
          </span>
        </header>

        <div className="min-h-0 flex-1 overflow-hidden">
          <UploadSection
            layout="dashboard"
            userId={userId}
            loadedRecord={selectedDoc}
            resetKey={resetKey}
            onDocumentSaved={loadList}
            onClearSidebarSelection={() => setSelectedDoc(null)}
          />
        </div>
      </div>
    </div>
  )
}
