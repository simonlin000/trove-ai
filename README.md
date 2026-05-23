<div align="center">

# Trove AI

**Your personal AI knowledge base for the Chinese internet.**

Capture articles from WeChat / B站 / 头条 / 抖音 / 小红书, AI-summarize them,
search semantically, build a knowledge graph, and sync everything to Obsidian.

[Features](#features) · [Quick Start](#quick-start) · [Architecture](#architecture) · [Self-host](docs/SELF_HOST.md) · [中文](README.zh.md)

</div>

---

## Features

- 📥 **Multi-platform capture** — WeChat 公众号 · 头条 · 抖音 · 小红书 · B站 · Medium · CSDN · 掘金 and any URL with OpenGraph metadata
- 🧠 **AI processing** — title / summary / key-points / auto-tags / vector embedding generated on ingest
- 🔍 **Semantic search & RAG Q&A** — ask questions across your library, get answers with citations
- 🕸 **Knowledge graph** — articles auto-linked by similarity (related / prerequisite / extends)
- 🛤 **Learning paths** — AI-generated reading sequences by topic
- 💬 **WeChat bot ingress** *(optional)* — send a link to your bot, it lands in your library
- 📝 **Obsidian sync** — one-shot snapshot to a local vault; never overwrites your edits
- 🏢 **Multi-tenant** — JWT auth, per-user isolation, revocable sync tokens

## Screenshots

*(Add screenshots in `docs/screenshots/` — Dashboard / Library / Reader / Graph / Settings.)*

## Quick Start

```bash
# 1. Clone
git clone https://github.com/weaiw/trove-ai.git
cd trove-ai

# 2. Configure
cp .env.example .env
# Edit .env — set POSTGRES_PASSWORD and SECRET_KEY

cp backend/app/config_store.example.json backend/app/config_store.json
# (You can also leave this empty and configure LLM/embedding via web UI later)

# 3. Run
docker compose up -d

# 4. Open
open http://localhost
```

First admin user is auto-created on first run; check the backend logs for the username & password.

Full self-host guide: [`docs/SELF_HOST.md`](docs/SELF_HOST.md).

## Architecture

```
┌──────────────┐      ┌──────────────┐      ┌──────────────────┐
│   Frontend   │      │   Backend    │      │   PostgreSQL     │
│  (Next.js)   │─────▶│  (FastAPI)   │─────▶│   + pgvector     │
└──────────────┘      └──────┬───────┘      └──────────────────┘
                             │
                             ├─▶ LLM API (OpenAI / DeepSeek / 讯飞 / SiliconFlow …)
                             ├─▶ Embedding API (SiliconFlow bge-m3 / local fastembed)
                             └─▶ Redis (cache)

Optional: WeChat Bot worker · Obsidian Sync plugin (separate repo)
```

| Component | Tech |
|-----------|------|
| Frontend | Next.js 14 + TypeScript + Tailwind |
| Backend | FastAPI + SQLAlchemy async |
| DB | PostgreSQL 16 + pgvector |
| Cache | Redis 7 |
| Reverse proxy | Nginx |
| LLM | OpenAI-compatible (configurable per user) |
| Embedding | BAAI/bge-m3 (1024-dim) or local bge-small-en (384-dim) |

## Obsidian Sync Plugin

A companion Obsidian community plugin pulls your Trove AI articles into a local
vault as markdown files — a **one-shot snapshot**, never overwriting your edits.

Plugin repo: [trove-sync-obsidian](https://github.com/weaiw/trove-sync-obsidian)

Setup:
1. In Trove AI web → Personal Settings → Obsidian Backup → **Generate Sync Token**
2. Install the plugin in Obsidian
3. Paste the token + your server URL → click **Sync Now**

## Roadmap

- [ ] Obsidian plugin → community marketplace
- [ ] Local image download (fully-offline backup)
- [ ] More LLM providers (Claude, Gemini, …)
- [ ] Mobile-friendly UI polish
- [ ] Browser extension for one-click capture

## Contributing

Issues and PRs welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md).

## License

[AGPL-3.0](LICENSE). For commercial closed-source SaaS deployment, contact the
maintainer for a separate commercial license.
