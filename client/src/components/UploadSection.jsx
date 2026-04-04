import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  FileText,
  Link2,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  deleteDocument,
  inferFileType,
  postAnalyze,
  postChat,
  postSaveDocument,
  readFileAsBase64,
} from '../lib/documentApi.js'

/** Above this length, document preview starts collapsed with "Read more". */
const PREVIEW_TEXT_COLLAPSE_CHARS = 1200

function imageMimeFromFileName(name) {
  const n = (name || '').toLowerCase()
  if (n.endsWith('.png')) return 'image/png'
  if (n.endsWith('.webp')) return 'image/webp'
  if (n.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

function sentimentClasses(sentiment) {
  const s = (sentiment || '').toLowerCase()
  if (s === 'positive')
    return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
  if (s === 'negative') return 'bg-red-50 text-red-800 ring-1 ring-red-200'
  return 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
}

export default function UploadSection({
  layout = 'dashboard',
  userId = null,
  onDocumentSaved,
  loadedRecord = null,
  resetKey = 0,
  onClearSidebarSelection,
}) {
  const isDashboard = layout === 'dashboard'
  const [view, setView] = useState('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileType, setFileType] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [result, setResult] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const fileInputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)
  const [docPreviewExpanded, setDocPreviewExpanded] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const extractedText = result?.extractedText ?? ''
  const isLongDocumentText =
    fileType !== 'image' &&
    extractedText.length > PREVIEW_TEXT_COLLAPSE_CHARS

  useEffect(() => {
    setDocPreviewExpanded(false)
  }, [extractedText])

  const lastResetKey = useRef(0)

  const resetPreview = useCallback(() => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
  }, [previewUrl])

  useEffect(() => {
    if (!resetKey) return
    if (lastResetKey.current === resetKey) return
    lastResetKey.current = resetKey
    resetPreview()
    setResult(null)
    setFileName('')
    setFileType('')
    setChatMessages([])
    setChatInput('')
    setError('')
    setDocPreviewExpanded(false)
    setView('upload')
    setLinkUrl('')
  }, [resetKey, resetPreview])

  useEffect(() => {
    if (!loadedRecord?.id) return
    resetPreview()
    const ent = loadedRecord.entities || {}
    setFileName(loadedRecord.fileName || '')
    setFileType(loadedRecord.fileType || '')
    setResult({
      status: 'success',
      fileName: loadedRecord.fileName,
      summary: loadedRecord.summary || '',
      entities: {
        names: ent.names || [],
        dates: ent.dates || [],
        organizations: ent.organizations || [],
        amounts: ent.amounts || [],
      },
      sentiment: loadedRecord.sentiment || 'Neutral',
      extractedText: loadedRecord.extractedText || '',
      suggestedQuestions: Array.isArray(loadedRecord.suggestedQuestions)
        ? loadedRecord.suggestedQuestions
        : [],
    })
    setChatMessages([])
    setChatInput('')
    setError('')
    setDocPreviewExpanded(false)
    setView('result')
    if (
      loadedRecord.fileType === 'image' &&
      loadedRecord.imageBase64 &&
      String(loadedRecord.imageBase64).trim()
    ) {
      const mime = imageMimeFromFileName(loadedRecord.fileName)
      setPreviewUrl(
        `data:${mime};base64,${String(loadedRecord.imageBase64).trim()}`,
      )
    }
  }, [loadedRecord?.id, loadedRecord, resetPreview])

  const handleRemove = useCallback(() => {
    resetPreview()
    setResult(null)
    setFileName('')
    setFileType('')
    setChatMessages([])
    setChatInput('')
    setError('')
    setDocPreviewExpanded(false)
    setView('upload')
    onClearSidebarSelection?.()
  }, [resetPreview, onClearSidebarSelection])

  const deletePersistedDocument = useCallback(async () => {
    if (!loadedRecord?.id || !userId) return
    if (!window.confirm('Delete this saved document permanently?')) return
    setDeleteLoading(true)
    setError('')
    try {
      await deleteDocument(userId, loadedRecord.id)
      onDocumentSaved?.()
      handleRemove()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed.')
    } finally {
      setDeleteLoading(false)
    }
  }, [
    loadedRecord?.id,
    userId,
    onDocumentSaved,
    handleRemove,
  ])

  const runAnalyze = useCallback(async (name, type, base64) => {
    setError('')
    setLoading(true)
    try {
      const data = await postAnalyze({
        fileName: name,
        fileType: type,
        fileBase64: base64,
      })
      setFileName(data.fileName || name)
      setFileType(type)
      setResult(data)
      setChatMessages([])
      setView('result')
      if (userId) {
        void (async () => {
          try {
            const ent = data.entities || {}
            await postSaveDocument(userId, {
              userId,
              fileName: data.fileName || name,
              fileType: type,
              summary: data.summary || '',
              entities: {
                names: ent.names ?? [],
                dates: ent.dates ?? [],
                organizations: ent.organizations ?? [],
                amounts: ent.amounts ?? [],
              },
              sentiment: data.sentiment || 'Neutral',
              createdAt: new Date().toISOString(),
              extractedText: data.extractedText || '',
              suggestedQuestions: data.suggestedQuestions || [],
              ...(type === 'image' ? { imageBase64: base64 } : {}),
            })
            onDocumentSaved?.()
          } catch {
            /* save is best-effort; analysis already succeeded */
          }
        })()
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed.')
    } finally {
      setLoading(false)
    }
  }, [userId, onDocumentSaved])

  const onFileChosen = useCallback(
    async (file) => {
      if (!file) return
      const type = inferFileType(file.name, file.type)
      if (!type) {
        setError('Use a PDF, DOCX, PNG, or JPG file.')
        return
      }
      resetPreview()
      let objectUrl = null
      if (type === 'image') {
        objectUrl = URL.createObjectURL(file)
        setPreviewUrl(objectUrl)
      }
      try {
        const b64 = await readFileAsBase64(file)
        await runAnalyze(file.name, type, b64)
      } catch (e) {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        setPreviewUrl(null)
        setError(e instanceof Error ? e.message : 'Could not read the file.')
      }
    },
    [resetPreview, runAnalyze],
  )

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      const f = e.dataTransfer?.files?.[0]
      if (f) void onFileChosen(f)
    },
    [onFileChosen],
  )

  const onLinkSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      const url = linkUrl.trim()
      if (!url) return
      setError('')
      setLoading(true)
      resetPreview()
      let objectUrl = null
      try {
        const res = await fetch(url)
        if (!res.ok) {
          throw new Error(
            `Could not download file (${res.status}). If the link is on another site, the browser may block it (CORS).`,
          )
        }
        const blob = await res.blob()
        const pathName = (() => {
          try {
            return new URL(url).pathname
          } catch {
            return url
          }
        })()
        const derivedName =
          pathName.split('/').filter(Boolean).pop() || 'document'
        const type = inferFileType(derivedName, blob.type || '')
        if (!type) {
          throw new Error(
            'Could not detect a supported file type from the link.',
          )
        }
        if (type === 'image') {
          objectUrl = URL.createObjectURL(blob)
          setPreviewUrl(objectUrl)
        }
        const file = new File([blob], derivedName, { type: blob.type })
        const b64 = await readFileAsBase64(file)
        await runAnalyze(derivedName, type, b64)
      } catch (err) {
        if (objectUrl) URL.revokeObjectURL(objectUrl)
        setPreviewUrl(null)
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load the link. Try uploading the file directly.',
        )
      } finally {
        setLoading(false)
      }
    },
    [linkUrl, resetPreview, runAnalyze],
  )

  const sendChat = useCallback(async () => {
    const text = chatInput.trim()
    if (!text || !result?.extractedText) return
    setChatInput('')
    setChatMessages((m) => [...m, { role: 'user', text }])
    setChatSending(true)
    setError('')
    try {
      const { reply } = await postChat(text, result.extractedText)
      setChatMessages((m) => [...m, { role: 'assistant', text: reply }])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chat request failed.')
    } finally {
      setChatSending(false)
    }
  }, [chatInput, result])

  const pickQuestion = useCallback((q) => {
    setChatInput(q)
  }, [])

  if (view === 'upload') {
    const formatPills = ['PDF', 'DOCX', 'PNG', 'JPG', 'WEBP']

    return (
      <section
        className={
          isDashboard
            ? 'flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-br from-slate-100/90 via-white to-blue-50/30 p-4 sm:p-6 lg:p-8'
            : 'flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-br from-slate-100/90 via-white to-blue-50/30 p-4 sm:p-6'
        }
      >
        <div className="mx-auto flex h-full min-h-0 w-full max-w-xl flex-col overflow-y-auto lg:max-w-2xl">
          <div className="shrink-0 pb-4 text-center lg:pb-6">
            <p className="font-heading text-[0.7rem] font-bold uppercase tracking-[0.22em] text-[#2563eb]">
              New analysis
            </p>
            <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Upload or link a document
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-600 sm:text-base">
              Summarize and analyze any document, instantly—drop a file below or
              paste a direct URL. Signed-in results are saved to your library.
            </p>
          </div>

          <div className="min-h-0 flex-1 rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_8px_40px_-12px_rgba(37,99,235,0.15)] ring-1 ring-slate-200/60 backdrop-blur-sm">
            <div className="h-1.5 rounded-t-2xl bg-gradient-to-r from-[#2563eb] via-sky-500 to-indigo-500" />

            <div className="relative min-h-[280px] p-5 sm:p-7 sm:min-h-[320px]">
              {loading ? (
                <div
                  className="absolute inset-5 z-10 flex flex-col items-center justify-center gap-4 rounded-xl bg-white/92 px-4 py-10 shadow-inner backdrop-blur-sm sm:inset-7"
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563eb]/10 to-indigo-500/10 ring-1 ring-[#2563eb]/15">
                    <Loader2
                      className="h-8 w-8 animate-spin text-[#2563eb]"
                      aria-hidden
                    />
                  </div>
                  <div className="max-w-xs text-center">
                    <p className="font-heading text-base font-bold text-gray-900">
                      Analyzing your document
                    </p>
                    <p className="mt-1.5 text-sm leading-snug text-gray-600">
                      SumDoc is building your summary, entities, and sentiment—
                      this usually takes a few seconds.
                    </p>
                  </div>
                </div>
              ) : null}

              <div
                className={
                  loading
                    ? 'pointer-events-none select-none opacity-[0.32] transition-opacity'
                    : ''
                }
                aria-hidden={loading || undefined}
              >
              {error ? (
                <p
                  className="mb-5 rounded-xl border border-red-100 bg-red-50/90 px-4 py-3 text-sm text-red-800"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <div
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    fileInputRef.current?.click()
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  setDragActive(false)
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed px-5 py-12 transition-all duration-200 sm:py-14 ${
                  dragActive
                    ? 'scale-[1.01] border-[#2563eb] bg-gradient-to-br from-blue-50 via-white to-indigo-50/90 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.12)]'
                    : 'border-slate-200 bg-slate-50/40 hover:border-[#2563eb]/45 hover:bg-gradient-to-br hover:from-white hover:to-blue-50/50 hover:shadow-md'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    if (f) void onFileChosen(f)
                  }}
                />
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all ${
                    dragActive
                      ? 'bg-[#2563eb] text-white shadow-lg shadow-blue-500/30'
                      : 'bg-white text-[#2563eb] shadow-md ring-1 ring-slate-200/80 group-hover:ring-[#2563eb]/25'
                  }`}
                >
                  <Upload className="h-7 w-7" strokeWidth={1.5} aria-hidden />
                </div>
                <p className="mt-4 text-center font-heading text-base font-bold text-gray-900 sm:text-lg">
                  Drop file here
                </p>
                <p className="mt-1.5 text-center text-sm text-gray-500">
                  or{' '}
                  <span className="font-semibold text-[#2563eb]">
                    click to browse
                  </span>
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
                  {formatPills.map((label) => (
                    <span
                      key={label}
                      className="rounded-md border border-slate-200/90 bg-white px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-slate-600 shadow-sm"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative my-7">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500 shadow-sm">
                    <Link2 className="h-3.5 w-3.5 text-[#2563eb]" aria-hidden />
                    Or use a link
                  </span>
                </div>
              </div>

              <form
                onSubmit={onLinkSubmit}
                className="flex flex-col gap-3 sm:flex-row sm:items-stretch"
              >
                <div className="relative min-w-0 flex-1">
                  <Link2
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://…/document.pdf"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-3 pl-10 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-slate-400 focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !linkUrl.trim()}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-[7rem]"
                  aria-label="Submit link"
                >
                  <span className="hidden sm:inline">Fetch</span>
                  <ArrowRight className="h-5 w-5 sm:ml-0" strokeWidth={2} />
                </button>
              </form>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/80 px-4 py-3.5 text-center text-[0.7rem] leading-snug text-slate-500 sm:text-xs">
              <FileText className="h-3.5 w-3.5 shrink-0 text-[#2563eb]" aria-hidden />
              <span>
                Signed-in analyses are saved to your library. Images may be stored
                for preview (size limits apply).
              </span>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const entities = result?.entities || {}
  const questions = (result?.suggestedQuestions || []).slice(0, 3)

  const entityGroups = [
    { title: 'People', items: entities.names },
    { title: 'Dates', items: entities.dates },
    { title: 'Organizations', items: entities.organizations },
    { title: 'Amounts', items: entities.amounts },
  ]

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-gradient-to-b from-slate-50/50 to-white px-2 py-2 sm:px-4 sm:py-3">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1 flex-col">
        <div className="grid h-full min-h-[360px] grid-cols-1 gap-0 overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_12px_48px_-16px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/50 lg:min-h-0 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col border-b border-gray-200 lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r lg:border-gray-200/80">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-slate-50/90 via-white to-blue-50/20 px-5 py-4">
              <span className="inline-flex min-w-0 max-w-[55%] items-center gap-2 truncate rounded-full border border-gray-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm sm:max-w-[65%]">
                <FileText
                  className="h-3.5 w-3.5 shrink-0 text-[#2563eb]"
                  aria-hidden
                />
                {fileName}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                {isDashboard && loadedRecord?.id && userId ? (
                  <button
                    type="button"
                    onClick={() => void deletePersistedDocument()}
                    disabled={deleteLoading}
                    className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    aria-label="Delete saved document"
                  >
                    {deleteLoading ? (
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden
                      />
                    ) : (
                      <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                    )}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleRemove}
                  className="rounded-lg px-2 py-1 text-sm font-semibold text-[#2563eb] transition hover:bg-blue-50 hover:text-[#1d4ed8]"
                >
                  Remove
                </button>
              </div>
            </div>

            {error ? (
              <div className="mx-5 mt-4 shrink-0 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100">
                {error}
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:min-h-0">
              <div className="scrollbar-panel min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-5 py-6">
                <section>
                  <h3 className="flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-widest text-gray-500">
                    <Sparkles
                      className="h-3.5 w-3.5 text-[#2563eb]"
                      aria-hidden
                    />
                    Summary
                  </h3>
                  <div className="mt-3 rounded-xl border border-blue-100/80 bg-gradient-to-b from-white to-slate-50/40 p-4 shadow-inner">
                    <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-gray-800">
                      {result?.summary || '—'}
                    </p>
                  </div>
                </section>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-heading text-xs font-bold uppercase tracking-widest text-gray-400">
                    Sentiment
                  </span>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${sentimentClasses(result?.sentiment)}`}
                  >
                    {result?.sentiment || 'Neutral'}
                  </span>
                </div>

                <section>
                  <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-gray-400">
                    Entities
                  </h3>
                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {entityGroups.map(({ title, items }) => (
                      <div
                        key={title}
                        className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <h4 className="font-heading text-sm font-bold text-gray-900">
                          {title}
                        </h4>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {items?.length ? (
                            items.map((x, i) => (
                              <span
                                key={`${title}-${i}`}
                                className="inline-flex rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-800"
                              >
                                {x}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400">None</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                {questions.length ? (
                  <section>
                    <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-gray-400">
                      Suggested questions
                    </h3>
                    <div className="mt-3 flex flex-col gap-2">
                      {questions.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => pickQuestion(q)}
                          className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-medium text-gray-800 transition hover:border-[#2563eb] hover:bg-blue-50/50"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}

                {chatMessages.length > 0 || chatSending ? (
                  <section className="border-t border-gray-100 pt-6">
                    <h3 className="font-heading text-xs font-bold uppercase tracking-widest text-gray-400">
                      Chat
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {chatMessages.map((msg, i) => (
                        <li
                          key={`${msg.role}-${i}`}
                          className={`rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                            msg.role === 'user'
                              ? 'ml-2 bg-gray-100 text-gray-900'
                              : 'mr-2 border border-gray-200 bg-white text-gray-800'
                          }`}
                        >
                          {msg.text}
                        </li>
                      ))}
                      {chatSending ? (
                        <li
                          className="mr-2 rounded-lg border border-gray-200 bg-white px-4 py-3.5"
                          aria-busy="true"
                          aria-live="polite"
                        >
                          <span className="sr-only">Assistant is answering</span>
                          <span
                            className="inline-flex items-center gap-1.5"
                            aria-hidden
                          >
                            <span className="chat-typing-dot" />
                            <span className="chat-typing-dot" />
                            <span className="chat-typing-dot" />
                          </span>
                        </li>
                      ) : null}
                    </ul>
                  </section>
                ) : null}
              </div>

              <div className="shrink-0 border-t border-gray-100 bg-white p-4">
                <div className="flex gap-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void sendChat()
                      }
                    }}
                    placeholder="Ask me anything about your documents..."
                    className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none"
                  />
                  <button
                    type="button"
                    disabled={chatSending || !chatInput.trim()}
                    onClick={() => void sendChat()}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {chatSending ? 'Sending' : 'Send'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-[320px] flex-col bg-gradient-to-b from-slate-50/80 to-slate-50/40 lg:h-full lg:min-h-0">
            <div className="shrink-0 border-b border-gray-200/80 bg-white/60 px-5 py-4 backdrop-blur-sm">
              <h3 className="font-heading text-sm font-bold text-gray-900">
                Document
              </h3>
              <p className="mt-0.5 truncate text-xs text-gray-500">{fileName}</p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-5">
              {fileType === 'image' && previewUrl ? (
                <div className="scrollbar-panel min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  <img
                    src={previewUrl}
                    alt=""
                    className="mx-auto w-full max-w-full rounded-xl border border-gray-200 bg-white object-contain shadow-sm"
                  />
                </div>
              ) : fileType === 'image' && !previewUrl ? (
                <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-8 text-center text-sm text-gray-500">
                  No image stored for this entry (older saves). OCR text is on
                  the right if available.
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-md shadow-slate-200/30">
                  <div
                    className={
                      isLongDocumentText && !docPreviewExpanded
                        ? 'max-h-60 min-h-0 shrink-0 overflow-hidden p-5'
                        : 'scrollbar-panel min-h-0 flex-1 overflow-y-auto overscroll-contain p-5'
                    }
                  >
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-gray-800">
                      {extractedText || 'No text to display.'}
                    </pre>
                  </div>
                  {isLongDocumentText ? (
                    <div className="shrink-0 border-t border-gray-100 bg-white px-5 py-3">
                      <button
                        type="button"
                        onClick={() =>
                          setDocPreviewExpanded((expanded) => !expanded)
                        }
                        className="text-sm font-semibold text-[#2563eb] underline decoration-[#2563eb]/30 underline-offset-2 hover:text-[#1d4ed8]"
                      >
                        {docPreviewExpanded ? 'Show less' : 'Read more'}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
