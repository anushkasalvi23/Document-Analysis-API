export const API_BASE =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
export const API_KEY = String(import.meta.env.VITE_API_KEY ?? '').trim()

export const MISSING_KEY_MSG =
  'Missing VITE_API_KEY. Copy client/.env.example to client/.env, set VITE_API_KEY to the same value as API_KEY in server/.env, then restart the Vite dev server (npm run dev).'

export function formatApiError(detail) {
  if (detail == null) return 'Something went wrong.'
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((x) => (typeof x === 'object' && x?.msg ? x.msg : String(x)))
      .join(' ')
  }
  if (typeof detail === 'object' && detail.message) return String(detail.message)
  return 'Something went wrong.'
}

export function inferFileType(fileName, mimeType = '') {
  const n = (fileName || '').toLowerCase()
  const m = (mimeType || '').toLowerCase()
  if (n.endsWith('.pdf') || m === 'application/pdf') return 'pdf'
  if (n.endsWith('.docx') || m.includes('wordprocessingml')) return 'docx'
  if (/\.(png|jpe?g|webp|gif)$/i.test(n) || m.startsWith('image/')) {
    return 'image'
  }
  return null
}

export function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const r = reader.result
      if (typeof r !== 'string') {
        reject(new Error('Could not read file'))
        return
      }
      const base64 = r.includes(',') ? r.split(',')[1] : r
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error || new Error('Read failed'))
    reader.readAsDataURL(file)
  })
}

export async function postAnalyze(body) {
  if (!API_KEY) {
    throw new Error(MISSING_KEY_MSG)
  }
  const res = await fetch(`${API_BASE}/api/document-analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify(body),
  })
  let data = {}
  try {
    data = await res.json()
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(formatApiError(data.detail))
  }
  return data
}

export async function postSaveDocument(userId, body) {
  if (!API_KEY) {
    throw new Error(MISSING_KEY_MSG)
  }
  const uid = String(userId || '').trim()
  if (!uid) throw new Error('Not signed in.')
  const res = await fetch(`${API_BASE}/api/save-document`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'x-user-id': uid,
    },
    body: JSON.stringify({ ...body, userId: uid }),
  })
  let data = {}
  try {
    data = await res.json()
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(formatApiError(data.detail))
  }
  return data
}

export async function fetchDocuments(userId) {
  if (!API_KEY) {
    throw new Error(MISSING_KEY_MSG)
  }
  const uid = String(userId || '').trim()
  if (!uid) throw new Error('Not signed in.')
  const q = new URLSearchParams({ userId: uid })
  const res = await fetch(`${API_BASE}/api/documents?${q}`, {
    headers: {
      'x-api-key': API_KEY,
      'x-user-id': uid,
    },
  })
  let data = {}
  try {
    data = await res.json()
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(formatApiError(data.detail))
  }
  if (!Array.isArray(data)) {
    return []
  }
  return data
}

export async function fetchDocumentById(userId, documentId) {
  if (!API_KEY) {
    throw new Error(MISSING_KEY_MSG)
  }
  const uid = String(userId || '').trim()
  if (!uid) throw new Error('Not signed in.')
  const id = String(documentId || '').trim()
  if (!id) throw new Error('Missing document id.')
  const q = new URLSearchParams({ userId: uid })
  const res = await fetch(
    `${API_BASE}/api/document/${encodeURIComponent(id)}?${q}`,
    {
      headers: {
        'x-api-key': API_KEY,
        'x-user-id': uid,
      },
    },
  )
  let data = {}
  try {
    data = await res.json()
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(formatApiError(data.detail))
  }
  return data
}

export async function deleteDocument(userId, documentId) {
  if (!API_KEY) {
    throw new Error(MISSING_KEY_MSG)
  }
  const uid = String(userId || '').trim()
  if (!uid) throw new Error('Not signed in.')
  const id = String(documentId || '').trim()
  if (!id) throw new Error('Missing document id.')
  const q = new URLSearchParams({ userId: uid })
  const res = await fetch(
    `${API_BASE}/api/document/${encodeURIComponent(id)}?${q}`,
    {
      method: 'DELETE',
      headers: {
        'x-api-key': API_KEY,
        'x-user-id': uid,
      },
    },
  )
  let data = {}
  try {
    data = await res.json()
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(formatApiError(data.detail))
  }
  return data
}

export async function postChat(message, documentText) {
  if (!API_KEY) {
    throw new Error(MISSING_KEY_MSG)
  }
  const res = await fetch(`${API_BASE}/api/document-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    },
    body: JSON.stringify({ message, documentText }),
  })
  let data = {}
  try {
    data = await res.json()
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(formatApiError(data.detail))
  }
  return data
}
