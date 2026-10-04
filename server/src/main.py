import asyncio
import base64
import io
import json
import logging
import re
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fitz
from docx import Document
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from openai import APIError, AsyncOpenAI, AuthenticationError
from PIL import Image
from bson import ObjectId
from bson.errors import InvalidId
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.errors import PyMongoError

_SERVER_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_SERVER_ROOT / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
# OpenRouter slug uses "4.5" (dot), not "4-5". Override with OPENROUTER_MODEL in .env if needed.
DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5"

api_key_header = APIKeyHeader(name="x-api-key", auto_error=False)
user_id_header = APIKeyHeader(name="x-user-id", auto_error=False)

_mongo_client: MongoClient | None = None

# Stored image payload cap (decoded bytes) to stay under MongoDB 16MB doc limit.
_MAX_STORED_IMAGE_BYTES = 10 * 1024 * 1024


def _validate_image_base64_for_storage(b64: str) -> None:
    s = (b64 or "").strip()
    if not s:
        return
    try:
        raw = base64.b64decode(s, validate=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid imageBase64: {e}") from e
    if len(raw) > _MAX_STORED_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image too large for storage (max {_MAX_STORED_IMAGE_BYTES // (1024 * 1024)}MB decoded).",
        )


def _documents_collection():
    global _mongo_client
    uri = (os.environ.get("MONGODB_URI") or "").strip()
    if not uri:
        raise HTTPException(
            status_code=503,
            detail="MONGODB_URI is not configured",
        )
    if _mongo_client is None:
        _mongo_client = MongoClient(uri, serverSelectionTimeoutMS=20000)
    db_name = (os.environ.get("MONGODB_DB") or "sumdoc").strip() or "sumdoc"
    return _mongo_client[db_name]["documents"]


def _mongo_error_detail(exc: BaseException) -> str:
    raw = str(exc)
    low = raw.lower()
    if "authentication failed" in low or "bad auth" in low:
        return (
            f"{raw} "
            "Atlas rejected the database user/password in MONGODB_URI. "
            "In Atlas: Database Access — confirm username and reset password if needed, "
            "then paste the new connection string. "
            "If the password contains @ # : / ? % use URL encoding in the URI "
            "(e.g. @ → %40). Restart uvicorn after editing server/.env."
        )
    if "replicasetnoprimary" in low or "no replica set members" in low:
        return (
            f"{raw} "
            "Often caused by bad credentials on some cluster nodes; fix MONGODB_URI auth first. "
            "Also check Atlas Network Access allows your IP (or 0.0.0.0/0 for local dev only)."
        )
    return raw


def require_user_id(
    x_user_id: str | None = Depends(user_id_header),
) -> str:
    uid = (x_user_id or "").strip()
    if not uid:
        raise HTTPException(status_code=401, detail="Missing x-user-id header")
    return uid


def _serialize_document(doc: dict[str, Any]) -> dict[str, Any]:
    out = dict(doc)
    oid = out.pop("_id", None)
    if oid is not None:
        out["id"] = str(oid)
    ca = out.get("createdAt")
    if isinstance(ca, datetime):
        if ca.tzinfo is None:
            ca = ca.replace(tzinfo=timezone.utc)
        out["createdAt"] = ca.astimezone(timezone.utc).isoformat()
    return out


def _normalize_env_secret(raw: str | None) -> str:
    if not raw:
        return ""
    s = raw.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        s = s[1:-1].strip()
    return s


def _get_env_api_key() -> str:
    return _normalize_env_secret(os.environ.get("API_KEY"))


def _get_env_openrouter_key() -> str:
    return _normalize_env_secret(os.environ.get("OPENROUTER_API_KEY"))


def _openrouter_model() -> str:
    return os.environ.get("OPENROUTER_MODEL", "").strip() or DEFAULT_OPENROUTER_MODEL


def _format_openai_error(exc: BaseException) -> str:
    if isinstance(exc, APIError):
        body = exc.body
        if isinstance(body, dict):
            err = body.get("error")
            if isinstance(err, dict) and err.get("message"):
                return str(err["message"])
            if isinstance(err, str):
                return err
        return str(exc.message)
    return str(exc)


def _raise_openai_as_http(e: BaseException) -> None:
    if isinstance(e, AuthenticationError):
        hint = _format_openai_error(e)
        raise HTTPException(
            status_code=502,
            detail=(
                f"OpenRouter rejected OPENROUTER_API_KEY ({hint}). "
                "That is the key in server/.env labeled OPENROUTER_API_KEY — not API_KEY and not VITE_API_KEY. "
                "Open https://openrouter.ai/keys , create a new key (starts with sk-or-v1-), paste it with no quotes, save .env, and restart uvicorn."
            ),
        ) from e
    if isinstance(e, APIError):
        raise HTTPException(
            status_code=502,
            detail=f"AI service error: {_format_openai_error(e)}",
        ) from e
    raise HTTPException(status_code=502, detail=f"AI service error: {e}") from e


async def verify_api_key(api_key: str | None = Depends(api_key_header)) -> None:
    expected = _get_env_api_key()
    if not expected:
        raise HTTPException(status_code=503, detail="Server API key is not configured")
    got = (api_key or "").strip()
    if not got or got != expected:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _strip_data_url(b64: str) -> str:
    s = b64.strip()
    if s.startswith("data:") and "," in s:
        return s.split(",", 1)[1]
    return s


def _decode_base64(b64: str) -> bytes:
    try:
        raw = _strip_data_url(b64)
        return base64.b64decode(raw, validate=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 payload: {e}") from e


def _extract_pdf(data: bytes) -> str:
    try:
        doc = fitz.open(stream=data, filetype="pdf")
        parts: list[str] = []
        for page in doc:
            parts.append(page.get_text() or "")
        doc.close()
        return "\n".join(parts).strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {e}") from e


def _extract_docx(data: bytes) -> str:
    try:
        document = Document(io.BytesIO(data))
        return "\n".join(p.text for p in document.paragraphs if p.text).strip()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read DOCX: {e}") from e


def _normalize_tesseract_cmd_env() -> str:
    raw = (os.environ.get("TESSERACT_CMD") or "").strip()
    if not raw:
        return ""
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "\"'":
        raw = raw[1:-1].strip()
    return raw


def _windows_tesseract_paths() -> list[Path]:
    bases: list[str] = []
    for key in ("ProgramW6432", "ProgramFiles", "ProgramFiles(x86)"):
        v = (os.environ.get(key) or "").strip()
        if v:
            bases.append(v)
    bases.extend(
        [
            r"C:\Program Files",
            r"C:\Program Files (x86)",
        ],
    )
    seen: set[str] = set()
    out: list[Path] = []
    for b in bases:
        if b.lower() in seen:
            continue
        seen.add(b.lower())
        out.append(Path(b) / "Tesseract-OCR" / "tesseract.exe")
    return out


def _configure_tesseract_executable(pytesseract_mod: Any) -> None:
    """Set pytesseract.tesseract_cmd from env, PATH, or default Windows install location."""
    override = _normalize_tesseract_cmd_env()
    if override:
        pytesseract_mod.pytesseract.tesseract_cmd = override
        return

    if shutil.which("tesseract"):
        return

    if os.name == "nt":
        for candidate in _windows_tesseract_paths():
            try:
                if candidate.is_file():
                    pytesseract_mod.pytesseract.tesseract_cmd = str(candidate)
                    logger.info("Using Tesseract at %s", candidate)
                    return
            except OSError:
                continue

    hint_linux = "Install with: apt install tesseract-ocr tesseract-ocr-eng (Debian/Ubuntu)."
    hint_win = (
        "Install Tesseract for Windows (e.g. https://github.com/UB-Mannheim/tesseract/wiki ) "
        "or add it to PATH, or set TESSERACT_CMD to the full path of tesseract.exe ."
    )
    hint = hint_win if os.name == "nt" else hint_linux
    raise RuntimeError(
        "Tesseract OCR is not installed or not on PATH. "
        f"{hint}"
    )


def _ocr_image_sync(data: bytes) -> str:
    """Lightweight OCR via Tesseract (no PyTorch). Install `tesseract-ocr` on the host."""
    import pytesseract

    _configure_tesseract_executable(pytesseract)

    try:
        img = Image.open(io.BytesIO(data))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        text = pytesseract.image_to_string(img, lang="eng")
    except pytesseract.TesseractNotFoundError as e:
        raise RuntimeError(
            "Tesseract failed to run. If the binary moved, set TESSERACT_CMD to tesseract.exe "
            "(Windows) or `which tesseract` (Linux)."
        ) from e
    return (text or "").strip()


async def extract_text(file_type: str, data: bytes) -> str:
    ft = file_type.lower().strip()
    if ft == "pdf":
        return _extract_pdf(data)
    if ft == "docx":
        return _extract_docx(data)
    if ft == "image":
        loop = asyncio.get_running_loop()
        try:
            return await loop.run_in_executor(None, lambda: _ocr_image_sync(data))
        except RuntimeError as e:
            logger.warning("OCR failed: %s", e)
            raise HTTPException(
                status_code=503,
                detail=str(e),
            ) from e
    raise HTTPException(
        status_code=400,
        detail="fileType must be one of: pdf, docx, image",
    )


def _parse_model_json(content: str) -> dict[str, Any]:
    s = (content or "").strip()
    if s.startswith("```"):
        lines = s.split("\n")
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        start, end = s.find("{"), s.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(s[start : end + 1])
            except json.JSONDecodeError as e2:
                logger.warning("Model JSON parse failed; raw prefix: %s", s[:200])
                raise HTTPException(
                    status_code=502,
                    detail=f"Model returned invalid JSON: {e2}",
                ) from e2
        logger.warning("Model JSON parse failed; raw prefix: %s", s[:200])
        raise HTTPException(
            status_code=502,
            detail="Model did not return parseable JSON.",
        ) from None


ANALYSIS_SYSTEM = """You analyze document text. Respond with a single JSON object only.
No markdown, no code fences, no explanation before or after the JSON.

Required JSON shape:
{
  "summary": string (concise overview of the document),
  "entities": {
    "names": string[],
    "dates": string[],
    "organizations": string[],
    "amounts": string[]
  },
  "sentiment": "Positive" | "Neutral" | "Negative" (overall tone of the document),
  "suggestedQuestions": string[] (3 to 5 short questions the user might ask about this document)
}

Use empty arrays where nothing applies. Keep strings concise."""


class EntitiesModel(BaseModel):
    names: list[str] = Field(default_factory=list)
    dates: list[str] = Field(default_factory=list)
    organizations: list[str] = Field(default_factory=list)
    amounts: list[str] = Field(default_factory=list)


class AnalyzeRequest(BaseModel):
    fileName: str
    fileType: str
    fileBase64: str


class AnalyzeResponse(BaseModel):
    status: str
    fileName: str
    summary: str
    entities: EntitiesModel
    sentiment: str
    extractedText: str
    suggestedQuestions: list[str] = Field(default_factory=list)


class ChatRequest(BaseModel):
    message: str
    documentText: str


class ChatResponse(BaseModel):
    reply: str


class SaveDocumentRequest(BaseModel):
    userId: str
    fileName: str
    fileType: str
    summary: str
    entities: dict[str, Any] = Field(default_factory=dict)
    sentiment: str
    createdAt: str | None = None
    extractedText: str = ""
    suggestedQuestions: list[str] = Field(default_factory=list)
    imageBase64: str = ""


def _assistant_text(message: Any) -> str:
    if message is None:
        return ""
    content = getattr(message, "content", None)
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text" and isinstance(block.get("text"), str):
                    parts.append(block["text"])
                elif isinstance(block.get("text"), str):
                    parts.append(block["text"])
            else:
                t = getattr(block, "text", None)
                if isinstance(t, str):
                    parts.append(t)
        return "".join(parts)
    return str(content)


def _openai_client() -> AsyncOpenAI:
    key = _get_env_openrouter_key()
    if not key:
        raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not configured")
    return AsyncOpenAI(
        base_url=OPENROUTER_BASE,
        api_key=key,
        default_headers={
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "SumDoc",
        },
    )


async def _call_openrouter_json(user_content: str) -> dict[str, Any]:
    client = _openai_client()
    try:
        completion = await client.chat.completions.create(
            model=_openrouter_model(),
            messages=[
                {"role": "system", "content": ANALYSIS_SYSTEM},
                {"role": "user", "content": user_content},
            ],
            temperature=0.2,
        )
    except Exception as e:
        logger.exception("OpenRouter request failed")
        _raise_openai_as_http(e)

    choice = completion.choices[0] if completion.choices else None
    content = _assistant_text(choice.message if choice else None)
    return _parse_model_json(content)


def _sanitize_chat_plain_text(text: str) -> str:
    """Strip common markdown from chat replies; normalize bullets for readability."""
    if not text:
        return ""
    s = text.replace("**", "").replace("__", "")
    s = re.sub(r"(?m)^[ \t]*[*•][ \t]+", "- ", s)
    s = re.sub(r"(?m)^[ \t]*#{1,6}[ \t]+", "", s)
    s = re.sub(r"`([^`]+)`", r"\1", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


CHAT_SYSTEM = """You are a helpful assistant answering questions about a document.
Use only the provided document text and reasonable inferences from it.
If the answer is not in the document, say so briefly.

Formatting (you must follow this):
- Plain text only. Never use markdown: no **asterisks** for bold or emphasis, no *italic*, no # headings, no backticks, no code fences.
- When you list several facts (contact fields, dates, amounts, steps, etc.), write a one-line intro only if it helps, then put each item on its own line as a bullet using "- " at the start of the line (hyphen and space).
- Do not repeat the same information twice (for example, a paragraph and then an "Answer:" block with the same content).
- Keep the reply concise and easy to scan."""


async def _call_openrouter_chat(document_text: str, user_message: str) -> str:
    client = _openai_client()
    user_block = f"""Document text:
---
{document_text[:120000]}
---

User question: {user_message}"""
    try:
        completion = await client.chat.completions.create(
            model=_openrouter_model(),
            messages=[
                {"role": "system", "content": CHAT_SYSTEM},
                {"role": "user", "content": user_block},
            ],
            temperature=0.3,
        )
    except Exception as e:
        logger.exception("OpenRouter chat failed")
        _raise_openai_as_http(e)
    choice = completion.choices[0] if completion.choices else None
    text = _assistant_text(choice.message if choice else None)
    cleaned = _sanitize_chat_plain_text(text)
    return cleaned or "(No reply)"


app = FastAPI(title="Document Analysis API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup_openrouter_check() -> None:
    k = _get_env_openrouter_key()
    if not k:
        logger.error(
            "OPENROUTER_API_KEY is empty — set it in server/.env (from https://openrouter.ai/keys )",
        )
    elif not k.startswith("sk-or-v1-"):
        logger.warning(
            "OPENROUTER_API_KEY should start with sk-or-v1-. "
            "If OpenRouter returns 'User not found', create a new key at https://openrouter.ai/keys",
        )


@app.post("/api/document-analyze", response_model=AnalyzeResponse)
async def document_analyze(
    body: AnalyzeRequest,
    _: None = Depends(verify_api_key),
) -> AnalyzeResponse:
    try:
        data = _decode_base64(body.fileBase64)
        extracted = await extract_text(body.fileType, data)
        if not extracted:
            extracted = "(No text could be extracted from this file.)"

        truncated_for_model = extracted[:100000]
        payload = await _call_openrouter_json(
            f"File name: {body.fileName}\n\nDocument text:\n{truncated_for_model}"
        )

        entities_raw = payload.get("entities") or {}
        entities = EntitiesModel(
            names=list(entities_raw.get("names") or []),
            dates=list(entities_raw.get("dates") or []),
            organizations=list(entities_raw.get("organizations") or []),
            amounts=list(entities_raw.get("amounts") or []),
        )
        sentiment = str(payload.get("sentiment") or "Neutral")
        if sentiment not in ("Positive", "Neutral", "Negative"):
            sentiment = "Neutral"
        sq = payload.get("suggestedQuestions") or []
        if not isinstance(sq, list):
            sq = []

        return AnalyzeResponse(
            status="success",
            fileName=body.fileName,
            summary=str(payload.get("summary") or ""),
            entities=entities,
            sentiment=sentiment,
            extractedText=extracted[:200000],
            suggestedQuestions=[str(x) for x in sq if x][:8],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("document_analyze failed")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}") from e


@app.post("/api/document-chat", response_model=ChatResponse)
async def document_chat(
    body: ChatRequest,
    _: None = Depends(verify_api_key),
) -> ChatResponse:
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="message is required")
    try:
        reply = await _call_openrouter_chat(body.documentText or "", body.message.strip())
        return ChatResponse(reply=reply)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("document_chat failed")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}") from e


@app.post("/api/save-document")
async def save_document(
    body: SaveDocumentRequest,
    _: None = Depends(verify_api_key),
    x_user_id: str = Depends(require_user_id),
) -> dict[str, str]:
    if x_user_id != body.userId.strip():
        raise HTTPException(
            status_code=403,
            detail="userId in body must match x-user-id header",
        )
    now = datetime.now(timezone.utc)
    doc: dict[str, Any] = {
        "userId": body.userId.strip(),
        "fileName": body.fileName,
        "fileType": body.fileType,
        "summary": body.summary,
        "entities": body.entities,
        "sentiment": body.sentiment,
        "createdAt": now,
        "extractedText": body.extractedText or "",
        "suggestedQuestions": list(body.suggestedQuestions or []),
    }
    ft = body.fileType.lower().strip()
    img = (body.imageBase64 or "").strip()
    if ft == "image" and img:
        _validate_image_base64_for_storage(img)
        doc["imageBase64"] = img
    try:
        coll = _documents_collection()
        result = coll.insert_one(doc)
        return {"status": "success", "id": str(result.inserted_id)}
    except PyMongoError as e:
        logger.exception("MongoDB save failed")
        raise HTTPException(
            status_code=502,
            detail=f"Could not save document: {_mongo_error_detail(e)}",
        ) from e


@app.get("/api/documents")
async def list_documents(
    userId: str,
    _: None = Depends(verify_api_key),
    x_user_id: str = Depends(require_user_id),
) -> list[dict[str, Any]]:
    if x_user_id != userId.strip():
        raise HTTPException(
            status_code=403,
            detail="userId query must match x-user-id header",
        )
    try:
        coll = _documents_collection()
        cursor = (
            coll.find({"userId": userId.strip()}, {"imageBase64": 0})
            .sort("createdAt", -1)
        )
        return [_serialize_document(d) for d in cursor]
    except PyMongoError as e:
        logger.exception("MongoDB list failed")
        raise HTTPException(
            status_code=502,
            detail=f"Could not load documents: {_mongo_error_detail(e)}",
        ) from e


@app.get("/api/document/{document_id}")
async def get_document(
    document_id: str,
    userId: str,
    _: None = Depends(verify_api_key),
    x_user_id: str = Depends(require_user_id),
) -> dict[str, Any]:
    if x_user_id != userId.strip():
        raise HTTPException(
            status_code=403,
            detail="userId query must match x-user-id header",
        )
    try:
        oid = ObjectId(document_id)
    except InvalidId as e:
        raise HTTPException(status_code=400, detail="Invalid document id") from e
    try:
        coll = _documents_collection()
        doc = coll.find_one({"_id": oid, "userId": userId.strip()})
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")
        return _serialize_document(doc)
    except HTTPException:
        raise
    except PyMongoError as e:
        logger.exception("MongoDB get document failed")
        raise HTTPException(
            status_code=502,
            detail=f"Could not load document: {_mongo_error_detail(e)}",
        ) from e


@app.delete("/api/document/{document_id}")
async def delete_document(
    document_id: str,
    userId: str,
    _: None = Depends(verify_api_key),
    x_user_id: str = Depends(require_user_id),
) -> dict[str, str]:
    if x_user_id != userId.strip():
        raise HTTPException(
            status_code=403,
            detail="userId query must match x-user-id header",
        )
    try:
        oid = ObjectId(document_id)
    except InvalidId as e:
        raise HTTPException(status_code=400, detail="Invalid document id") from e
    try:
        coll = _documents_collection()
        result = coll.delete_one({"_id": oid, "userId": userId.strip()})
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Document not found")
        return {"status": "success"}
    except HTTPException:
        raise
    except PyMongoError as e:
        logger.exception("MongoDB delete failed")
        raise HTTPException(
            status_code=502,
            detail=f"Could not delete document: {_mongo_error_detail(e)}",
        ) from e
