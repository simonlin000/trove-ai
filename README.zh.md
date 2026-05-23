<div align="center">

# Trove AI — 拾遗

**为中文互联网打造的稍后阅读 + AI 知识库。**

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![后端: FastAPI](https://img.shields.io/badge/后端-FastAPI-009688)](https://fastapi.tiangolo.com)
[![前端: Next.js 14](https://img.shields.io/badge/前端-Next.js%2014-black)](https://nextjs.org)
[![pgvector](https://img.shields.io/badge/向量-pgvector-336791)](https://github.com/pgvector/pgvector)
[![全端兼容: PC · Pad · 移动端](https://img.shields.io/badge/全端兼容-PC%20·%20Pad%20·%20移动端-007aff)]()
[![Status: active](https://img.shields.io/badge/状态-持续更新-success.svg)]()

[English README](README.md) · [自部署指南](docs/SELF_HOST.md) · [Obsidian 插件](https://github.com/weaiw/trove-sync-obsidian)

</div>

---

## 为什么用 Trove AI?

你收藏了 1000 篇文章。你只重新读过 5 篇。

问题不是你存太多——问题是现在的工具把"收藏"和"阅读"当成了同一件事。微信收藏把它们埋了。**收藏 ≠ 阅读。** 这个落差,就是全部问题的根源。

**Pocket 在 2024 年关停。Omnivore 也关停了。** 用户精心收藏的内容,一夜之间全没了。

**Trove AI 是一个可自部署的 AI 第二大脑**,把"先存下,晚点看"重新变回"真的读完、真的记住"。第一手为中文互联网而做(微信公众号 / 知乎 / 抖音 / 小红书 / B 站 / 头条 / 掘金 / CSDN),内置微信 Bot 入口 / 自动知识图谱 / Obsidian 单向同步。

它由你部署。也由你掌握。

---

## 核心亮点

<table>
<tr>
<td width="50%" valign="top">

#### 📥 全平台采集
微信公众号 · 头条 · 抖音 · 小红书 · B 站 · Medium · CSDN · 掘金,以及任何支持 OpenGraph 的网页。
入库方式:浏览器一键收藏 · 微信 Bot 转发 · 粘贴正文 · 上传文件(PDF/DOCX/EPUB)· 一句话灵感 Spark 生成。

</td>
<td width="50%" valign="top">

#### 🧠 AI 替你干活
每篇文章自动生成:AI 提取标题 · 5 句话摘要 · 3-5 个关键点 · 自动标签 · 平台感知作者识别 · 1024 维向量嵌入 · 思维导图 · 视频转译。

</td>
</tr>
<tr>
<td width="50%" valign="top">

#### 🔍 语义搜索 + RAG 问答
问 *"我读过哪些关于提示词工程的文章?"* → 直接从**你的库**里给出答案 + 引用,而不是从公网搜。

</td>
<td width="50%" valign="top">

#### 🕸 自动生长的知识图谱
每篇新文章自动找到最近的 3 篇语义相邻文章。眼看着自己的知识自己连成网。

</td>
</tr>
<tr>
<td width="50%" valign="top">

#### 🛤 学习路径
一句话描述方向 → AI 从你的库里挑文章、排序、组织成结构化学习路径。

</td>
<td width="50%" valign="top">

#### 💬 微信 Bot 入口
转发文章 URL 给你的 bot → 5 秒内进库 + 自动摘要 + 自动打标签 + 推荐"和你以前看过的相关"。

</td>
</tr>
<tr>
<td width="50%" valign="top">

#### 📝 一次性快照同步 Obsidian
配套插件把你所有文章导出成本地 Markdown,**永不覆盖你的本地编辑**。哪天 Trove 没了,你硬盘里的数据还在。

</td>
<td width="50%" valign="top">

#### 🏢 多租户,生产级架构
JWT 鉴权 · 数据按用户隔离 · 同步 Token 可一键撤销 · 服务 Token 支持 X-Act-As-User 代理 · 完整用户管理。

</td>
</tr>
<tr>
<td width="50%" valign="top">

#### 📂 知识库基本功扎实
文件夹层级 · 标签系统 · 归档 · 收藏 · 回收站 · 周期回顾提醒 · 每篇阅读底部相关推荐。

</td>
<td width="50%" valign="top">

#### 🌐 万物可收
网页链接 · 粘贴正文 · PDF · Word · Excel · PPT · EPUB · CSV · 自己写的笔记 · Spark 一句话生成全文。

</td>
</tr>
<tr>
<td width="50%" valign="top">

#### 📱 全端兼容
**PC · iPad · 移动端**全部原生适配。阅读器触控优化 · 知识图谱手势友好 · 移动端优先排版。在通勤 / 沙发 / 桌前任何场景都顺手。

</td>
<td width="50%" valign="top">

#### 🌗 浅色 / 深色 / 跟随系统
按系统偏好自动切换,也可固定模式。阅读字体长时间使用不疲劳。

</td>
</tr>
</table>

---

## 截图

> ⚠️ 截图待补,放到 `docs/screenshots/` 即可。

| 主页 | 阅读器 | 知识图谱 | 设置 |
|---|---|---|---|
| _(待补)_ | _(待补)_ | _(待补)_ | _(待补)_ |

---

## 适合谁用?

- **产品经理 / 研究者** —— 收藏夹堆成山,真正读过的不到 5%
- **工程师 / 终身学习者** —— 希望每周收藏的标签最终能沉淀成体系
- **隐私敏感的用户** —— 不想阅读习惯被存在某个创业公司服务器上
- **被 Pocket / Omnivore 关停坑过的人** —— 想要数据主权
- **内容策展者** —— 想搭建结构化个人知识库
- **自部署爱好者** —— 喜欢自己跑自己基础设施的人
- **跨设备阅读者** —— 手机通勤、iPad 沙发、笔记本桌前来回切,希望三端都顺手

---

## 与同类产品对比

|  | Trove AI | Pocket | Omnivore | Readwise | Hoarder/Karakeep | Memos |
|---|---|---|---|---|---|---|
| 开源 | ✅ AGPL-3.0 | ❌ | ✅(曾经) | ❌ | ✅ MIT | ✅ MIT |
| 自部署 | ✅ Docker | ❌ | ✅(项目关闭) | ❌ | ✅ Docker | ✅ Docker |
| **中文平台支持** | **✅ 6+ 深度解析** | ❌ | 弱 | ❌ | 弱 | N/A |
| AI 摘要 | ✅ 任意厂商 | ❌ 基础 | ✅ | ✅ | ✅ | ❌ |
| 知识图谱 | ✅ 自动 | ❌ | ❌ | ❌ | ❌ | ❌ |
| 学习路径 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 微信 Bot | ✅ 内置 | ❌ | ❌ | ❌ | ❌ | ❌ |
| Obsidian 同步 | ✅ 插件 | ❌ | ✅ | ✅ 付费 | ❌ | ❌ |
| **全端响应式** | ✅ 原生 | ✅ | 一般 | ✅ | 一般 | 一般 |
| 多租户 | ✅ | N/A | ✅ | N/A | 一般 | 一般 |
| 项目状态 | ✅ 持续更新 | ⛔ **2024 关停** | ⛔ **2024 关停** | ✅ 付费在售 | ✅ 持续更新 | ✅ 持续更新 |

Trove AI 是**唯一**同时拥有这些能力的产品:深度中文平台支持 · 微信 Bot · 自动知识图谱 · Obsidian 同步 · 自部署 · 全端响应式 UI。任何一项是刚需,其它替代品都不能满足你。

---

## 快速开始(5 分钟)

### 前置要求

- **Docker** ≥ 24.0,带 Compose v2(用 `docker compose ...`,不是 `docker-compose`)
- 大约 **4 GB 内存**
- 大约 **5 GB 磁盘**

就这些。宿主机不需要 Python 或 Node。

### 步骤

```bash
# 1. 克隆
git clone https://github.com/weaiw/trove-ai.git
cd trove-ai

# 2. 配置密钥
cp .env.example .env
# 编辑 .env,至少设置:
#   POSTGRES_PASSWORD=$(openssl rand -base64 24)
#   SECRET_KEY=$(openssl rand -base64 48)

# 3.(可选)预填 LLM 配置,也可以等启动后在网页 UI 里设
cp backend/app/config_store.example.json backend/app/config_store.json

# 4. 启动
docker compose up -d

# 5. 打开
open http://localhost
```

首次启动会自动创建超管账号,密码在 backend 日志里:

```bash
docker compose logs backend | grep -i admin
```

完整自部署指南 + 故障排查:**[`docs/SELF_HOST.md`](docs/SELF_HOST.md)**。

### 云端部署

任何支持 Docker 的虚拟机都行。已实测:
- **腾讯云 Lighthouse / CVM**(国内用户首选)
- AWS EC2 t3.medium
- DigitalOcean 4GB
- Hetzner CX22

HTTPS 自己用 **Caddy / Traefik / Nginx** 反代,或者直接挂 Cloudflare Tunnel。

---

## 架构

```
        ┌──────────────────────────────────────────────────────┐
        │      任意设备 — PC · iPad · 手机 · 浏览器             │
        │   • 网页 App · 微信 Bot · Obsidian 插件               │
        └─────────────────────────┬────────────────────────────┘
                                  │
                          ┌───────▼───────┐
                          │  Nginx :80    │
                          └───┬────────┬──┘
                              │        │
                  ┌───────────▼──┐  ┌──▼────────────┐
                  │  前端        │  │  后端         │
                  │  Next.js 14  │  │  FastAPI      │
                  │  响应式      │  │  async        │
                  └──────────────┘  └───┬────────────┘
                                        │
                  ┌─────────────────────┼─────────────────────┐
                  │                     │                     │
        ┌─────────▼──────────┐ ┌────────▼───────┐  ┌──────────▼────────┐
        │  PostgreSQL 16     │ │  Redis 7       │  │ 外部 API          │
        │  + pgvector        │ │  (缓存)        │  │ LLM + 嵌入        │
        │  • articles        │ │                │  │ • DeepSeek        │
        │  • embeddings 1024 │ │                │  │ • 讯飞 / OpenAI   │
        │  • knowledge_edges │ │                │  │ • SiliconFlow     │
        │  • users + tokens  │ │                │  │ • 任意 兼容厂商   │
        └────────────────────┘ └────────────────┘  └───────────────────┘
```

### 技术栈

| 层 | 技术 | 选这个的理由 |
|----|------|------|
| 前端 | **Next.js 14** + TypeScript + Tailwind | App router · 服务端组件 · 响应式优先 |
| 后端 | **FastAPI** + SQLAlchemy async + pydantic | 原生 async · 类型安全 · 自动生成 OpenAPI 文档 |
| 数据库 | **PostgreSQL 16** + **pgvector** | 一个 DB 既存关系数据又存向量 |
| 缓存 | **Redis 7** | session / 队列 |
| 爬虫 | **Playwright** + **curl_cffi** + httpx | 突破中文反爬(TLS 指纹 / XHR 拦截 / JS VM 绕过) |
| LLM | 任意 **OpenAI 兼容** | DeepSeek · 讯飞星辰 · OpenAI · SiliconFlow · MiniMax · 智谱 · ... |
| 嵌入 | **SiliconFlow bge-m3** (1024 维) 或本地 fastembed (384 维) | 云端质量,带本地兜底 |
| 反代 | **Nginx** | 单一入口 · 静态资源加速 |

---

## 配置

所有用户面对的配置都通过网页 UI 完成:

**设置页** → AI 对话模型 / 嵌入模型 / 系统缓存

| 什么 | 在哪里 |
|------|--------|
| LLM 厂商 + Key + 模型 | 系统管理 → AI 对话模型 |
| 嵌入厂商 + Key + 模型 | 系统管理 → 嵌入模型 |
| 缓存清理 / 重建 | 系统管理 → 系统缓存 |
| Obsidian 同步 Token | 个人设置 → Obsidian 备份 |
| 微信 Bot 绑定 | 个人设置 → 微信 |
| 周期回顾配置 | 个人设置 → 周期回顾 |

### 环境变量

| 变量 | 必填 | 用途 |
|------|------|------|
| `POSTGRES_PASSWORD` | ✅ | 数据库密码 |
| `SECRET_KEY` | ✅ | JWT 签名密钥(≥ 32 位随机字符) |
| `OPENAI_API_KEY` | ❌ | 可选,UI 没配时的兜底 |
| `DEEPSEEK_API_KEY` | ❌ | 可选兜底 |
| `SILICONFLOW_API_KEY` | ❌ | 可选兜底 |
| `MINIMAX_API_KEY` | ❌ | 可选兜底 |
| `SERVICE_TOKENS` | ❌ | `tokenA:userA,tokenB:userB` — 给 bot 用 |
| `LINKMIND_PUBLIC_BASE` | ❌ | bot 深链接所用的公网地址 |

完整模板见 `.env.example`。

---

## API 端点速查

| 端点 | 用途 |
|------|------|
| `POST /api/auth/login` | 用户登录 → JWT |
| `POST /api/articles` | 按 URL 添加文章 |
| `POST /api/articles/upload` | 上传文件(PDF / Word / EPUB / 等) |
| `POST /api/articles/notes` | 写一篇笔记 |
| `POST /api/articles/spark` | 一句话 → AI 生成文章 |
| `POST /api/assistant/ask` | 基于你库的 RAG 问答 |
| `GET /api/knowledge/graph` | 知识图谱数据 |
| `POST /api/learning/paths/generate` | 生成学习路径 |
| `POST /api/sync/issue-token` | 签发长期 Obsidian 同步 Token |
| `GET /api/sync/articles` | 分页获取同步文章 |
| `POST /api/sync/revoke-all-tokens` | 撤销所有同步 Token |

完整 OpenAPI 文档:启动后 `http://localhost/api/docs`。

---

## Obsidian 同步插件

插件仓库:**[weaiw/trove-sync-obsidian](https://github.com/weaiw/trove-sync-obsidian)**(MIT)

**一次性快照到本地 vault。** 永不覆盖你的本地修改。哪天产品没了,你的数据还在。

使用流程:

1. 网页 → **个人设置 → Obsidian 备份 → 生成本地同步 Token**
2. 从 [Releases](https://github.com/weaiw/trove-sync-obsidian/releases/latest) 下载插件
3. 解压到 `<your-vault>/.obsidian/plugins/trove-sync/`
4. Obsidian → 社区插件 → 启用 **Trove AI Sync**
5. 粘贴 Token + 服务器地址 → 点 **Sync Now**

插件用「sync_state.json ∪ frontmatter 扫描」双重 OR 判定"已同步",两边丢任意一边都不会重复同步。

---

## 文档

- [`docs/SELF_HOST.md`](docs/SELF_HOST.md) — 完整自部署指南 + 故障排查
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — 贡献指南
- API 文档:`/api/docs`(FastAPI 自动生成)

---

## 路线图

### v1.0 — 当前版本
- ✅ 全平台采集(8+ 来源)
- ✅ AI 处理流水线(摘要 / 关键点 / 标签 / 嵌入 / 思维导图)
- ✅ RAG 问答 + 语义搜索
- ✅ 自动知识图谱 + 学习路径
- ✅ 微信 Bot 入口
- ✅ Obsidian 同步插件
- ✅ 多租户 + 可撤销同步 Token
- ✅ Docker 自部署
- ✅ PC / pad / 移动端响应式 UI

### v1.1
- 🔜 浏览器扩展(任意标签一键收藏)
- 🔜 图片本地下载(完全离线备份)
- 🔜 Pocket / Omnivore 导入
- 🔜 文章去重增强
- 🔜 PWA 支持(手机"添加到主屏幕")

### v1.2
- 更多 LLM 厂商(Claude · Gemini · 豆包原生)
- 用户主题与语言偏好
- 批量重新处理文章(用新 AI Prompt)
- 文章版本历史

### v2 — 研究中
- Obsidian 社区市场提交
- 多 vault Obsidian 同步
- Notion · Logseq · Reflect 导出
- 音频播客生成
- 每日 / 每周摘要邮件

---

## 常见问题

<details>
<summary><strong>不付钱买 LLM API 能用吗?</strong></summary>

可以——嵌入有本地纯 CPU 兜底(`BAAI/bge-small-en-v1.5`,384 维)。
LLM 功能(摘要/标签/RAG)至少要一个免费层 API:
- **DeepSeek** — 最便宜,约 ¥2 / 100 万 token
- **讯飞 / 智谱** — 都有免费额度
- **OpenAI / Claude / Gemini** — 按量付费
- **MiniMax / SiliconFlow** — 比较慷慨的免费层
</details>

<details>
<summary><strong>运行成本大概多少?</strong></summary>

约 **¥30-70/月** 一台小 VPS + LLM API 用量。
个人用量 < 1000 篇/月 + 用 DeepSeek,LLM 成本约 ¥15-35/月。
想完全免费:用本地嵌入,跳过 AI 摘要功能。
</details>

<details>
<summary><strong>能从 Pocket / Omnivore / Readwise 迁移吗?</strong></summary>

直接导入器在 v1.1 加。当前 workaround:
- Pocket 导出 → URL 列表 → 批量粘贴到 `/api/articles/batch`
- Omnivore → markdown 导出 → 用 `/api/articles/upload`
</details>

<details>
<summary><strong>会不会偷偷把我的数据发给第三方?</strong></summary>

只发给**你自己显式配置**的 LLM 厂商。API key 和 base URL 完全由你掌控。
要完全断网运行:只用本地嵌入,关掉 LLM 功能。
没有第三方分析、没有遥测、前端没有任何第三方 JS。
</details>

<details>
<summary><strong>手机端真的好用吗?</strong></summary>

是的——移动端优先设计,响应式排版。阅读器、文章库、搜索、知识图谱全部触控优化。
v1.1 加 PWA,可以"添加到 iOS / Android 主屏幕"用得像原生 App。
</details>

<details>
<summary><strong>不会写代码能部署吗?</strong></summary>

会用 Docker 基本命令就行。[`docs/SELF_HOST.md`](docs/SELF_HOST.md) 一步步带你走。
遇到问题开 issue,社区一般一天内会回。
</details>

<details>
<summary><strong>多用户的数据怎么隔离?</strong></summary>

`articles` / `tags` / `folders` / `knowledge_edges` / `learning_paths` / `wechat_accounts` 每行都有 `user_id`。
所有查询都按 `current_user.id` 过滤。JWT 鉴权 + 每用户可撤销同步 Token。
跨租户泄露在 ORM 层就被机械性阻断。
</details>

<details>
<summary><strong>文章删了能恢复吗?</strong></summary>

进每用户回收站(`deleted_at` 列)。30 天后自动彻底删除,期间可恢复。
Obsidian 插件**绝不**传播删除——你硬盘上的文件不会因为线上删了而消失。
</details>

<details>
<summary><strong>能商用吗?</strong></summary>

可以,在 AGPL-3.0 下:你可以收费提供托管服务,**前提是把你的改动开源**给你的用户。
想做闭源 SaaS 部署,联系维护者获取商业授权。
</details>

---

## 贡献

见 [`CONTRIBUTING.md`](CONTRIBUTING.md)。

特别欢迎:
- 新平台解析器(parser_service.py)
- 翻译(English · 日本語 · 其他)
- UI 打磨与无障碍优化
- 带复现步骤的 bug 报告
- 不同 LLM 厂商的对比测试

---

## 致谢

- 用 **[Hermes](https://hermes.ai)** AI 编程助手 + **[DeepSeek](https://www.deepseek.com)** 作为 LLM 大脑 vibe-code 出来——共消耗 **27 亿 token**,0 行人写代码
- 后端:[FastAPI](https://fastapi.tiangolo.com) · [SQLAlchemy](https://www.sqlalchemy.org) · [pgvector](https://github.com/pgvector/pgvector) · [Playwright](https://playwright.dev) · [curl_cffi](https://github.com/lexiforest/curl_cffi)
- 前端:[Next.js](https://nextjs.org) · [Tailwind](https://tailwindcss.com) · [lucide-react](https://lucide.dev) · [react-flow](https://reactflow.dev)
- 嵌入:[BAAI/bge-m3](https://huggingface.co/BAAI/bge-m3) · [fastembed](https://github.com/qdrant/fastembed)
- 灵感来自 **Pocket** · **Omnivore** · **Readwise**——也因为前两个的关停而暴起做这件事

---

## License

主仓:**[AGPL-3.0](LICENSE)**。
Obsidian 插件:[MIT](https://github.com/weaiw/trove-sync-obsidian/blob/main/LICENSE)。

闭源 SaaS 商业部署,联系维护者获取商业授权。

---

<div align="center">

如果 Trove AI 帮你的知识库免于又一次创业公司关停, **请给个 ⭐ —— 不花钱,但能让项目被更多人看到。**

</div>
