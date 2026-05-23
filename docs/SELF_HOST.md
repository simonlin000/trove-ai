# Self-hosting Trove AI

A complete walkthrough for deploying Trove AI on your own server (or laptop).

## 0. Prerequisites

- **Docker** ≥ 24.0 with **Docker Compose v2** (`docker compose`, not `docker-compose`)
- ~ **4 GB RAM** free (Playwright + embedding model are the heaviest pieces)
- ~ **5 GB disk** for the base images + your data
- A domain or IP for the LLM/embedding API providers you'll use

That's it. No Python or Node required on the host — everything builds inside containers.

## 1. Clone

```bash
git clone https://github.com/YOUR_USERNAME/trove-ai.git
cd trove-ai
```

## 2. Configure environment

```bash
cp .env.example .env
```

Open `.env` and **at minimum** set:

| Variable | What to put | How to generate |
|----------|-------------|-----------------|
| `POSTGRES_PASSWORD` | A strong DB password | `openssl rand -base64 24` |
| `SECRET_KEY` | JWT signing secret | `openssl rand -base64 48` |

Optional (you can also set these later via web UI):

- `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `SILICONFLOW_API_KEY` / `MINIMAX_API_KEY`

## 3. (Optional) Pre-fill LLM/embedding config

```bash
cp backend/app/config_store.example.json backend/app/config_store.json
# Edit it OR leave it as-is and configure through the web UI later
```

The web UI (Settings → AI 对话模型 / 嵌入模型) writes to this file. Anything you put
here is overridden by what the UI saves.

## 4. Start

```bash
docker compose up -d
```

First build takes 5–10 minutes (Playwright browser download dominates).

Verify everything is up:

```bash
docker compose ps
curl -I http://localhost
```

## 5. First login

Trove AI creates a default super-admin user on first DB init. Check the backend
logs:

```bash
docker compose logs backend | grep -i "admin"
```

Or create one yourself by exec-ing into the backend container and using the
auth API. (Better instructions live in `docs/USER_MANAGEMENT.md` if/when added.)

## 6. Reverse proxy + HTTPS

The bundled nginx serves port 80. To expose on the public internet:

- Front it with **Caddy / Traefik / Cloudflare Tunnel** for automatic TLS
- Or use a managed PaaS that handles TLS termination

If you change the public URL, set `TROVE_PUBLIC_BASE` in `.env`:

```env
TROVE_PUBLIC_BASE=https://trove.yourdomain.com
```

(Used by the WeChat bot — if you don't use it, ignore.)

## 7. Common operations

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Restart one service after a config change
docker compose restart backend

# Pull updates
git pull
docker compose build
docker compose up -d

# Backup the DB
docker compose exec postgres pg_dump -U trove trove > backup.sql

# Restore
docker compose exec -T postgres psql -U trove trove < backup.sql
```

## 8. Configuring LLM / embedding

You have two options, in priority order:

1. **Via web UI** (recommended): Settings → AI 对话模型 / 嵌入模型. Persisted to
   `backend/app/config_store.json`. Test connection button validates before save.
2. **Via env vars** (fallback): `OPENAI_API_KEY=...` in `.env`. Lower priority.

Supported providers (any OpenAI-compatible endpoint works):
- **LLM**: OpenAI, DeepSeek, SiliconFlow, 讯飞星辰, 智谱, Minimax
- **Embedding**: OpenAI, SiliconFlow, or local `BAAI/bge-small-en-v1.5` (no API key needed)

## 9. WeChat bot (optional)

Out-of-the-box, the WeChat bot worker is **commented out** in `docker-compose.yml`.
To enable:

1. Sign up for [iLinkai](https://ilinkai.weixin.qq.com) and obtain bot credentials
2. Seed `wechat_accounts` table for your user via the `/api/wechat/bind/*` endpoints
3. Set `SERVICE_TOKEN_WECHAT_BOT` in `.env`
4. Uncomment the `wechat-bot` service in `docker-compose.yml`
5. `docker compose up -d wechat-bot`

## 10. Troubleshooting

| Symptom | Check |
|---------|-------|
| Frontend 502 | `docker compose logs backend` — backend probably failed to start |
| "Cannot connect to DB" | `POSTGRES_PASSWORD` mismatch between `.env` and existing volume; if you changed it after first run, you need to `docker compose down -v` (⚠️ destroys data) |
| LLM test always fails | Check `api_base` doesn't have trailing slash; verify provider is reachable from inside container with `docker compose exec backend curl https://...` |
| Embedding model takes forever | Local fallback downloads ~150 MB on first use; persists across restarts |
| Migrations show `InFailedSQLTransactionError` warnings | Cosmetic; subsequent statements roll forward fine |

## 11. Updating

Trove AI doesn't have semver yet. To update:

```bash
git pull
docker compose build
docker compose up -d
```

Backend migrations run automatically on backend start. DB schema changes that
require manual intervention will be flagged in release notes.

## 12. Uninstall

```bash
docker compose down -v       # ⚠️ -v drops the postgres volume — your data is gone
rm -rf .env backend/app/config_store.json
```
