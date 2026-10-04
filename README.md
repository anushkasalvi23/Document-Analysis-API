<div align="center">

# 📄 SumDoc — AI Document Analysis

**Upload a document. Get a summary, key entities, sentiment, and answers to your questions.**

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://document-analysis-api-pi.vercel.app)

![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat-square&logo=mongodb&logoColor=white)
![Clerk](https://img.shields.io/badge/Clerk-6C47FF?style=flat-square&logo=clerk&logoColor=white)

[Live Demo](https://document-analysis-api-pi.vercel.app) · [Features](#-features) · [Getting Started](#-getting-started) · [API Reference](#-api-reference) · [Troubleshooting](#-troubleshooting)

</div>

---

## 📖 Overview

SumDoc is a full-stack web application that turns long documents into quick, usable insight. Upload a PDF, Word document, or image and SumDoc extracts the text (using OCR for images), then uses an LLM to generate a summary, named entities, sentiment, and suggested questions. You can ask follow-up questions about the document and, when signed in, save every analysis to a personal library.

## 📸 Screenshots

### Analysis results
![SumDoc document summary, sentiment, and extracted entities](<Screenshots/Screenshot 2026-10-04 215032.png>)

### Document chat and saved library
![SumDoc chat answers and document library](<Screenshots/Screenshot 2026-10-04 214409.png>)

> **Note:** these captures use a sample document. Make sure no real personal information (phone number, email, address) is visible before publishing them.

## ✨ Features

- 📂 **Multi-format upload** — PDF, DOCX, PNG, JPG/JPEG, and WebP
- 🔍 **Text extraction** — native parsing for PDF/DOCX, Tesseract OCR for images
- 🧠 **AI analysis** — summary, entities (people, dates, organizations, amounts), sentiment, and suggested questions
- 💬 **Document chat** — ask follow-up questions grounded in the extracted text
- 🔐 **Authentication** — sign in with Clerk
- 🗂️ **Personal library** — save, view, and delete past analyses
- 🔗 **Fetch by URL** — analyze a document from a direct link

## 🧱 Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, React Router, Tailwind CSS |
| Authentication | Clerk |
| Backend | Python, FastAPI, Uvicorn |
| Document processing | PyMuPDF, python-docx, Pillow, Tesseract OCR |
| AI | OpenRouter (via the OpenAI Python client) |
| Database | MongoDB (Atlas or local) |
| Deployment | Vercel (frontend), Docker-ready backend |

## 🏗️ How It Works

```
Upload file ──▶ Extract text ──▶ LLM analysis ──▶ Summary · Entities · Sentiment · Questions
 (PDF/DOCX/     (PyMuPDF,        (OpenRouter)            │
  image)         python-docx,                             ├──▶ Ask follow-up questions
                 Tesseract OCR)                           └──▶ Save to library (MongoDB)
```

## 🚀 Getting Started

### Prerequisites

- Python **3.10+**
- Node.js **20.19+** or **22.12+**, and npm
- An [OpenRouter](https://openrouter.ai) API key
- A [Clerk](https://clerk.com) application (publishable key)
- A MongoDB connection string (for the saved library)
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) installed and on your `PATH` (only needed for image analysis)

### 1. Clone the repository

```bash
git clone https://github.com/anushkasalvi23/Document-Analysis-API.git
cd Document-Analysis-API
```

### 2. Set up the backend

<details open>
<summary><b>Windows (PowerShell)</b></summary>

```powershell
cd .\server
Copy-Item .env.example .env
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```
</details>

<details>
<summary><b>macOS / Linux</b></summary>

```bash
cd server
cp .env.example .env
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```
</details>

Edit `server/.env`:

```dotenv
OPENROUTER_API_KEY=your_openrouter_api_key
API_KEY=choose_a_shared_api_key
MONGODB_URI=your_mongodb_connection_string
# MONGODB_DB=sumdoc
# TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe   # only if not on PATH
```

Start the API:

```bash
uvicorn src.main:app --reload --port 8000
```

The API runs at `http://localhost:8000` and interactive docs are at `http://localhost:8000/docs`.

### 3. Set up the frontend

In a second terminal:

```bash
cd client
cp .env.example .env        # PowerShell: Copy-Item .env.example .env
npm ci
```

Edit `client/.env`:

```dotenv
VITE_API_KEY=the_same_value_as_server_API_KEY
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
# Optional, defaults to http://localhost:8000
# VITE_API_BASE_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

> Restart Vite after changing any `VITE_` variable, and restart the API after changing backend environment values.

### Environment variables

| Variable | Where | Required | Description |
| --- | --- | :---: | --- |
| `OPENROUTER_API_KEY` | server | ✅ | OpenRouter key used for analysis and chat |
| `API_KEY` | server | ✅ | Shared key checked against the `x-api-key` header |
| `MONGODB_URI` | server | ✅* | MongoDB connection string (*needed for the saved library) |
| `MONGODB_DB` | server | ❌ | Database name (defaults to `sumdoc`) |
| `TESSERACT_CMD` | server | ❌ | Full path to Tesseract if it isn't on `PATH` |
| `VITE_API_KEY` | client | ✅ | Must match the server's `API_KEY` |
| `VITE_CLERK_PUBLISHABLE_KEY` | client | ✅ | Clerk publishable key |
| `VITE_API_BASE_URL` | client | ❌ | Backend URL (defaults to `http://localhost:8000`) |

## 🐳 Docker (backend)

The `server/` folder includes a `Dockerfile`. Example:

```bash
cd server
docker build -t sumdoc-api .
docker run --env-file .env -p 8000:8000 sumdoc-api
```

## 📡 API Reference

All routes live under `/api` and require the shared `x-api-key` header. Library routes also require `x-user-id`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/document-analyze` | Extract and analyze a document |
| `POST` | `/api/document-chat` | Ask a question about document text |
| `POST` | `/api/save-document` | Save an analysis for the signed-in user |
| `GET` | `/api/documents` | List the user's saved documents |
| `GET` | `/api/document/{document_id}` | Retrieve a saved document |
| `DELETE` | `/api/document/{document_id}` | Delete a saved document |

Full request/response schemas are available in the interactive docs at `/docs`.

## 📁 Project Structure

```
Document-Analysis-API/
├── client/          # React + Vite frontend
├── server/          # FastAPI backend
│   ├── src/         # Application code (entry point: src/main.py)
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── Screenshots/     # README images
└── README.md
```

## 🧰 Useful Commands

From `client/`:

```bash
npm run dev       # start the dev server
npm run lint      # run ESLint
npm run build     # production build
npm run preview   # preview the production build
```

## 🛠️ Troubleshooting

| Problem | Fix |
| --- | --- |
| **"Failed to fetch" / CORS error** | Confirm the API is running on port `8000`, `VITE_API_BASE_URL` is correct, and your Vite origin is allowed in `server/src/main.py` (ports `5173` and `5174` are allowed by default). |
| **API key error** | `VITE_API_KEY` in `client/.env` must exactly match `API_KEY` in `server/.env`. |
| **OpenRouter error** | Check that `OPENROUTER_API_KEY` is valid, then restart the API. |
| **Library doesn't load or save** | Verify `MONGODB_URI`, the database user's permissions, and Atlas Network Access (add your IP). URL-encode special characters in the password. |
| **Image text is missing** | Install Tesseract OCR and make sure the backend can find the executable (or set `TESSERACT_CMD`). |

## 🔒 Security Notes

- Never commit `.env` files or share API keys, database credentials, or Clerk secrets.
- `VITE_` variables are bundled into the browser. `VITE_API_KEY` is a shared application key, **not** a secret that can protect a public production API.
- Before deploying publicly, configure production CORS origins, Clerk production keys, and proper server-side authentication.

## 🗺️ Roadmap

- [ ] Per-user server-side authentication (replace the shared API key)
- [ ] Support for more file types (PPTX, TXT, CSV)
- [ ] Export analysis as PDF or Markdown
- [ ] Multi-document comparison

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push the branch: `git push origin feature/your-feature`
5. Open a Pull Request

## 📜 License

Add a `LICENSE` file to the repository (for example, MIT) and update this section to match.

## 👩‍💻 Author

**Anushka Salvi**

[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat-square&logo=github&logoColor=white)](https://github.com/anushkasalvi23)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/anushkasalvi23/)
[![LeetCode](https://img.shields.io/badge/LeetCode-FFA116?style=flat-square&logo=leetcode&logoColor=black)](https://leetcode.com/u/Anushka_Salvi/)

---

<div align="center">⭐ If you found this project useful, consider giving it a star.</div>