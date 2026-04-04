import asyncio
import base64
import io
import json
import logging
import re
import os
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
from pydantic import BaseModel, Field

_SERVER_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_SERVER_ROOT / ".env")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
# OpenRouter slug uses "4.5" (dot), not "4-5". Override with OPENROUTER_MODEL in .env if needed.
DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5"

_easyocr_reader = None

api_key_header = APIKeyHeader(name="x-api-key", auto_error=False)


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


def _ocr_image_sync(data: bytes) -> str:
    global _easyocr_reader
    import easyocr
    import numpy as np

    if _easyocr_reader is None:
        _easyocr_reader = easyocr.Reader(["en"], gpu=False)
    img = Image.open(io.BytesIO(data)).convert("RGB")
    arr = np.array(img)
    result = _easyocr_reader.readtext(arr)
    lines = [item[1] for item in result if item[1]]
    return "\n".join(lines).strip()


async def extract_text(file_type: str, data: bytes) -> str:
    ft = file_type.lower().strip()
    if ft == "pdf":
        return _extract_pdf(data)
    if ft == "docx":
        return _extract_docx(data)
    if ft == "image":
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: _ocr_image_sync(data))
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
            "X-Title": "Document Analyzer",
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
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
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
