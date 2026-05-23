<div align="center">

# Trove AI

**中文互联网内容的个人 AI 知识库。**

把微信公众号、B 站、头条、抖音、小红书等多平台的文章收下来,AI 自动摘要、标签化、向量化,
支持语义搜索、知识图谱、RAG 问答,并一键同步到 Obsidian。

[功能](#功能) · [快速开始](#快速开始) · [架构](#架构) · [自部署](docs/SELF_HOST.md) · [English](README.md)

</div>

---

## 功能

- 📥 **多平台采集** — 微信公众号 · 头条 · 抖音 · 小红书 · B站 · 掘金 · CSDN · Medium · 任意 OpenGraph 链接
- 🧠 **AI 处理流水线** — 入库即生成标题/摘要/关键点/标签/向量嵌入
- 🔍 **语义搜索 + RAG 问答** — 跨库提问,带原文引用
- 🕸 **知识图谱** — 按相似度自动连边(相关/前置/延伸)
- 🛤 **学习路径** — AI 按主题生成阅读序列
- 💬 **微信 Bot 入口**(可选)— 给 bot 发链接,自动入库
- 📝 **Obsidian 同步** — 一次性快照到本地 vault,**永不覆盖你的修改**
- 🏢 **多租户** — JWT 鉴权 + 数据隔离 + 同步 Token 可一键吊销

## 截图

*(添加截图到 `docs/screenshots/` — 仪表板 / 文章库 / 阅读器 / 图谱 / 设置)*

## 快速开始

```bash
# 1. 克隆
git clone https://github.com/weaiw/trove-ai.git
cd trove-ai

# 2. 配置
cp .env.example .env
# 编辑 .env — 设置 POSTGRES_PASSWORD 和 SECRET_KEY

cp backend/app/config_store.example.json backend/app/config_store.json
# (LLM / embedding 也可以稍后在网页 设置 里配,不一定要预填)

# 3. 启动
docker compose up -d

# 4. 打开
open http://localhost
```

首次启动会自动建一个超管账号,在 backend 日志里能看到用户名 + 密码。

完整自部署指南见 [`docs/SELF_HOST.md`](docs/SELF_HOST.md)。

## 架构

```
┌──────────────┐      ┌──────────────┐      ┌──────────────────┐
│   前端       │      │   后端       │      │  PostgreSQL      │
│ (Next.js)    │─────▶│ (FastAPI)    │─────▶│  + pgvector      │
└──────────────┘      └──────┬───────┘      └──────────────────┘
                             │
                             ├─▶ LLM API(OpenAI / DeepSeek / 讯飞 / SiliconFlow ...)
                             ├─▶ Embedding(SiliconFlow bge-m3 / 本地 fastembed 兜底)
                             └─▶ Redis(缓存)

可选模块:微信 Bot · Obsidian Sync 插件(独立仓库)
```

| 组件 | 技术栈 |
|------|--------|
| 前端 | Next.js 14 + TypeScript + Tailwind |
| 后端 | FastAPI + SQLAlchemy async |
| 数据库 | PostgreSQL 16 + pgvector |
| 缓存 | Redis 7 |
| 反向代理 | Nginx |
| LLM | OpenAI 兼容(可在网页配置任意厂商) |
| 嵌入 | BAAI/bge-m3 (1024 维) 或本地 bge-small-en (384 维) |

## Obsidian 同步插件

配套的 Obsidian 社区插件把你 Trove AI 的文章一次性同步成本地 vault 的 markdown ——
**一次性快照,绝不覆盖你在 Obsidian 里的修改**。

插件仓库:[trove-sync-obsidian](https://github.com/weaiw/trove-sync-obsidian)

使用步骤:
1. 网页 Trove AI → 个人设置 → Obsidian 备份 → **生成本地同步 Token**
2. Obsidian 装上插件
3. 粘贴 Token + 填服务器地址 → 点 **Sync Now**

## 路线图

- [ ] Obsidian 插件提交社区市场
- [ ] 图片本地下载(完全离线备份)
- [ ] 更多 LLM 厂商(Claude、Gemini ...)
- [ ] 移动端 UI 优化
- [ ] 浏览器扩展一键收藏

## 贡献

欢迎 issue + PR,见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

## License

[AGPL-3.0](LICENSE)。商业闭源 SaaS 部署请联系维护者获取商业授权。
