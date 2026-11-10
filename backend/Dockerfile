FROM python:3.12-slim

WORKDIR /app

# System packages: ffmpeg + fonts (Nanum and Noto CJK are SIL OFL 1.1)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-nanum \
    fonts-nanum-extra \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Optional user-supplied fonts (not distributed with this repo — see docs/ASSETS.md)
RUN mkdir -p /usr/share/fonts/truetype/custom
COPY fonts/ /usr/share/fonts/truetype/custom/
RUN fc-cache -fv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PYTHONPATH=/app

EXPOSE 8000
