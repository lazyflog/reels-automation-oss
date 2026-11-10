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

# Optional user-supplied fonts (not distributed with this repo — see docs/FONTS.md)
RUN mkdir -p /usr/share/fonts/truetype/custom
COPY fonts/ /usr/share/fonts/truetype/custom/
RUN fc-cache -fv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Optional vmake.ai plugin (watermark removal). Only installed when the user has
# placed the vmake SDK into plugins/vmake/sdk/ — see plugins/vmake/README.md.
RUN if [ -f plugins/vmake/sdk/__init__.py ]; then \
        pip install --no-cache-dir -r plugins/vmake/requirements.txt; \
    fi

ENV PYTHONPATH=/app

EXPOSE 8000
