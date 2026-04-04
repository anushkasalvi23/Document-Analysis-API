# Slim deploy image for Railway (no EasyOCR / PyTorch — uses system Tesseract).
FROM python:3.12-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src ./src

ENV PYTHONUNBUFFERED=1

# Railway sets PORT
CMD sh -c 'uvicorn src.main:app --host 0.0.0.0 --port ${PORT:-8000}'
