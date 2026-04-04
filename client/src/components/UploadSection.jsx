import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  FileText,
  Link2,
  Loader2,
  Sparkles,
  Upload,
} from 'lucide-react'
import {
  inferFileType,
  postAnalyze,
  postChat,
  readFileAsBase64,
} from '../lib/documentApi.js'

/** Above this length, document preview starts collapsed with "Read more". */
const PREVIEW_TEXT_COLLAPSE_CHARS = 1200

function sentimentClasses(sentiment) {
  const s = (sentiment || '').toLowerCase()
  if (s === 'positive')
    return 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
  if (s === 'negative') return 'bg-red-50 text-red-800 ring-1 ring-red-200'
  return 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'
}

export default function UploadSection() {
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

  const extractedText = result?.extractedText ?? ''
  const isLongDocumentText =
    fileType !== 'image' &&
    extractedText.length > PREVIEW_TEXT_COLLAPSE_CHARS

  useEffect(() => {
    setDocPreviewExpanded(false)
  }, [extractedText])

  const resetPreview = useCallback(() => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
  }, [previewUrl])

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
  }, [resetPreview])

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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed.')
    } finally {
      setLoading(false)
    }
  }, [])

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
    const formatPills = ['PDF', 'DOCX', 'PNG', 'JPG']

    return (
      <section
        id="upload-section"
        className="scroll-mt-24 border-b border-gray-100 bg-gradient-to-b from-slate-50 via-white to-white px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto max-w-lg sm:max-w-xl">
          <p className="text-center font-heading text-xs font-bold uppercase tracking-[0.2em] text-[#2563eb]">
            Upload
          </p>
          <h2 className="mt-2 text-center font-heading text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            Analyze your document
          </h2>
          <p className="mx-auto mt-3 max-w-md text-center text-base leading-relaxed text-gray-600">
            Drop a file here or paste a direct link. AI summary and insights in
            seconds.
          </p>

          <div className="mt-10 overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-xl shadow-slate-200/40 ring-1 ring-black/[0.04] sm:mt-12">
            <div className="h-1 bg-gradient-to-r from-[#2563eb] via-blue-400 to-indigo-500" />

            <div className="p-6 sm:p-8">
              {error ? (
                <p
                  className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-100/80"
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
                className={`group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-14 transition-all duration-200 sm:py-16 ${
                  dragActive
                    ? 'scale-[1.01] border-[#2563eb] bg-gradient-to-br from-blue-50 to-indigo-50/80 shadow-inner'
                    : 'border-gray-200 bg-gradient-to-br from-slate-50/90 to-white hover:border-[#2563eb]/50 hover:bg-gradient-to-br hover:from-blue-50/40 hover:to-white hover:shadow-md'
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
                  className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-colors ${
                    dragActive
                      ? 'bg-[#2563eb] text-white shadow-lg shadow-blue-500/25'
                      : 'bg-[#2563eb]/10 text-[#2563eb] group-hover:bg-[#2563eb]/15'
                  }`}
                >
                  <Upload className="h-8 w-8" strokeWidth={1.5} aria-hidden />
                </div>
                <p className="mt-5 text-center font-heading text-lg font-bold text-gray-900">
                  Drop your file here
                </p>
                <p className="mt-1 text-center text-sm text-gray-500">
                  or <span className="font-semibold text-[#2563eb]">browse</span>{' '}
                  to choose from your device
                </p>
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  {formatPills.map((label) => (
                    <span
                      key={label}
                      className="rounded-full border border-gray-200/80 bg-white/90 px-3 py-1 text-xs font-semibold text-gray-600 shadow-sm"
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center" aria-hidden>
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 shadow-sm">
                    <Link2 className="h-3.5 w-3.5 text-[#2563eb]" aria-hidden />
                    or paste a link
                  </span>
                </div>
              </div>

              <form onSubmit={onLinkSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                <div className="relative min-w-0 flex-1">
                  <Link2
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                    aria-hidden
                  />
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com/document.pdf"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50/80 py-3.5 pl-10 pr-4 text-sm text-gray-900 shadow-inner outline-none transition placeholder:text-gray-400 focus:border-[#2563eb] focus:bg-white focus:ring-2 focus:ring-[#2563eb]/20"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !linkUrl.trim()}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
                  aria-label="Submit link"
                >
                  <span className="hidden sm:inline">Fetch</span>
                  <ArrowRight className="h-5 w-5" strokeWidth={2} />
                </button>
              </form>

              {loading ? (
                <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/80 to-white py-10">
                  <Loader2
                    className="h-11 w-11 animate-spin text-[#2563eb]"
                    aria-hidden
                  />
                  <div className="text-center">
                    <p className="font-heading text-sm font-bold text-gray-900">
                      Analyzing your document
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Summary, entities, and sentiment
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-center gap-2 border-t border-gray-100 bg-slate-50/60 px-6 py-4 text-xs text-gray-500">
              <FileText className="h-4 w-4 shrink-0 text-[#2563eb]" aria-hidden />
              <span>Files stay in your session; we don’t store your uploads.</span>
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
    <section
      id="upload-section"
      className="scroll-mt-24 border-b border-gray-100 bg-gradient-to-b from-slate-50/60 via-white to-white px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-8"
    >
      <div className="mx-auto max-w-6xl lg:h-[calc(100dvh-6rem)] lg:max-h-[calc(100dvh-6rem)] lg:min-h-0">
        <div className="grid min-h-[560px] grid-cols-1 gap-0 overflow-hidden rounded-3xl border border-gray-200/80 bg-white shadow-xl shadow-slate-200/35 ring-1 ring-black/[0.04] lg:h-full lg:min-h-0 lg:grid-cols-2">
          <div className="flex min-h-0 flex-col border-b border-gray-200 lg:h-full lg:min-h-0 lg:border-b-0 lg:border-r lg:border-gray-200/80">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-gradient-to-r from-slate-50/90 via-white to-blue-50/20 px-5 py-4">
              <span className="inline-flex max-w-[65%] items-center gap-2 truncate rounded-full border border-gray-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm">
                <FileText
                  className="h-3.5 w-3.5 shrink-0 text-[#2563eb]"
                  aria-hidden
                />
                {fileName}
              </span>
              <button
                type="button"
                onClick={handleRemove}
                className="rounded-lg px-2 py-1 text-sm font-semibold text-[#2563eb] transition hover:bg-blue-50 hover:text-[#1d4ed8]"
              >
                Remove
              </button>
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
