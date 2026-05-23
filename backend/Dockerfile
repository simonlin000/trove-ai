FROM python:3.11-slim

WORKDIR /app

# China mirrors — without these, builds on Tencent Cloud take hours (cross-border to deb.debian.org)
RUN sed -i 's|deb.debian.org|mirrors.tencent.com|g; s|security.debian.org|mirrors.tencent.com|g' /etc/apt/sources.list.d/debian.sources

ENV PIP_INDEX_URL=https://mirrors.tencent.com/pypi/simple/ \
    PIP_TRUSTED_HOST=mirrors.tencent.com \
    PLAYWRIGHT_DOWNLOAD_HOST=https://registry.npmmirror.com/-/binary/playwright

RUN apt-get update && apt-get install -y --no-install-recommends     build-essential libpq-dev curl libcurl4-openssl-dev     libnss3 libnspr4 libatk-bridge2.0-0 libdrm2 libdbus-1-3     libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3     libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2     libatspi2.0-0 libcups2 nodejs &&     rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN python3 -m playwright install --with-deps chromium

RUN python3 -c "from markitdown import MarkItDown" 2>/dev/null ||     pip install --no-cache-dir "markitdown[all] @ git+https://github.com/microsoft/markitdown.git"

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
