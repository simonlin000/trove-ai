"""Tool-using research agent — LLM with function calling drives a ReAct loop
over a small set of library tools (search_library / read_article / list_recent).

Compared to [[research_agent.py]] (fixed 4-stage sequential pipeline), this
agent **decides itself** which tool to call next based on what it has learned
so far. The user sees the model's tool selection — the "agent thinking" — not
just stage names. This is the structural pattern behind ChatGPT/Claude Code
tool use.

LLM: hardcoded SiliconFlow DeepSeek-V3 (function-calling capable) to decouple
from whatever the user configured as their primary LLM (which may be a code
model not great at tool use).
"""
import asyncio
import json
import logging
import os
from typing import AsyncIterator, Dict, List, Optional, TypedDict
from uuid import UUID

import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai_service import llm_service

logger = logging.getLogger("trove.tool-agent")

MAX_STEPS = 8                  # hard cap on tool-loop iterations
MAX_TOOL_RESULT_CHARS = 4000   # truncate large tool outputs before feeding back to LLM
LIBRARY_TOP_K = 5

# Use DeepSeek-V3 via SiliconFlow for reliable function calling.
SF_MODEL = "deepseek-ai/DeepSeek-V3"
SF_BASE = "https://api.siliconflow.cn/v1"


class AgentEvent(TypedDict, total=False):
    stage: str       # start / thought / tool_call / tool_result / final / error
    message: str
    data: dict


def _emit(stage: str, message: str, data: Optional[dict] = None) -> AgentEvent:
    out: AgentEvent = {"stage": stage, "message": message}
    if data is not None:
        out["data"] = data
    return out


# ── Tool schemas (OpenAI-compatible function-calling format) ──────────
TOOL_SCHEMAS = [
    {
        "type": "function",
        "function": {
            "name": "search_library",
            "description": (
                "Semantic search over the user's personal knowledge library. Use when "
                "you need to find articles by topic/concept. Returns top-K most "
                "relevant articles with their snippets."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query in natural Chinese or English",
                    },
                    "top_k": {
                        "type": "integer",
                        "description": "How many articles to return",
                        "default": 5,
                    },
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "read_article",
            "description": (
                "Fetch the FULL content of one specific article by its id. Use AFTER "
                "search_library when a snippet looks relevant but you need the whole "
                "article to draw a conclusion."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "article_id": {
                        "type": "string",
                        "description": "UUID returned by search_library",
                    },
                },
                "required": ["article_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_recent_articles",
            "description": (
                "List the user's most recently saved articles (titles + summaries). "
                "Use when the user asks about their reading habits, what they have been "
                "into lately, or for a broad overview not driven by a specific topic."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "days": {"type": "integer", "default": 30},
                    "limit": {"type": "integer", "default": 15},
                },
            },
        },
    },
]


# ── Tool implementations ─────────────────────────────────────────────
async def _tool_search_library(
    db: AsyncSession, user_id: UUID, query: str, top_k: int = LIBRARY_TOP_K
) -> dict:
    emb = await llm_service.get_embedding(query, emb_type="query")
    emb_str = "[" + ",".join(str(v) for v in emb) + "]"
    sql = text(f"""
        SELECT id, title, clean_content, raw_content,
               (embedding <-> '{emb_str}'::vector) AS distance
        FROM articles
        WHERE embedding IS NOT NULL AND user_id = :user_id
        ORDER BY embedding <-> '{emb_str}'::vector
        LIMIT :top_k
    """)
    r = await db.execute(sql, {"top_k": top_k, "user_id": user_id})
    results = []
    for row in r.fetchall():
        article_id, title, clean, raw, distance = row
        content = (clean or raw or "").strip()
        snippet = content[:600] + ("…" if len(content) > 600 else "")
        results.append({
            "article_id": str(article_id),
            "title": title or "Untitled",
            "snippet": snippet,
            "distance": round(float(distance), 4),
        })
    return {"count": len(results), "results": results}


async def _tool_read_article(db: AsyncSession, user_id: UUID, article_id: str) -> dict:
    from app.models import Article
    try:
        uid = UUID(article_id)
    except ValueError:
        return {"error": "invalid article_id (not a UUID)"}
    r = await db.execute(
        select(Article).where(Article.id == uid, Article.user_id == user_id)
    )
    article = r.scalar_one_or_none()
    if not article:
        return {"error": "article not found in this user's library"}
    content = (article.clean_content or article.raw_content or "").strip()
    if len(content) > MAX_TOOL_RESULT_CHARS:
        content = content[:MAX_TOOL_RESULT_CHARS] + "…"
    return {
        "article_id": str(article.id),
        "title": article.title or "Untitled",
        "author": article.author or "",
        "source_platform": article.source_platform or "",
        "summary": article.summary or "",
        "content": content,
    }


async def _tool_list_recent(
    db: AsyncSession, user_id: UUID, days: int = 30, limit: int = 15
) -> dict:
    from datetime import datetime, timedelta, timezone
    since = datetime.now(timezone.utc) - timedelta(days=days)
    from app.models import Article
    r = await db.execute(
        select(Article)
        .where(Article.user_id == user_id, Article.created_at >= since)
        .order_by(Article.created_at.desc())
        .limit(limit)
    )
    arts = list(r.scalars().all())
    out = []
    for a in arts:
        out.append({
            "article_id": str(a.id),
            "title": a.title or "Untitled",
            "source_platform": a.source_platform or "",
            "summary": (a.summary or "")[:150],
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })
    return {"count": len(out), "days": days, "results": out}


async def _execute_tool(
    name: str, args: dict, db: AsyncSession, user_id: UUID
) -> dict:
    try:
        if name == "search_library":
            return await _tool_search_library(
                db, user_id, args["query"], args.get("top_k", LIBRARY_TOP_K)
            )
        if name == "read_article":
            return await _tool_read_article(db, user_id, args["article_id"])
        if name == "list_recent_articles":
            return await _tool_list_recent(
                db, user_id, args.get("days", 30), args.get("limit", 15)
            )
        return {"error": f"unknown tool: {name}"}
    except KeyError as e:
        return {"error": f"missing required argument: {e}"}
    except Exception as e:
        logger.exception(f"tool {name} crashed: {e}")
        return {"error": f"{type(e).__name__}: {e}"}


# ── LLM call helper (function calling) ───────────────────────────────
async def _call_llm_with_tools(
    messages: list, tools: list
) -> dict:
    """One round-trip to the LLM. Returns the raw `message` object."""
    from app.config_manager import get_effective_config
    cfg = get_effective_config("embedding")  # same SF account
    api_key = cfg.get("api_key", "") or os.getenv("SILICONFLOW_API_KEY", "")
    if not api_key:
        raise RuntimeError("SiliconFlow api_key missing (embedding group)")

    payload = {
        "model": SF_MODEL,
        "messages": messages,
        "tools": tools,
        "tool_choice": "auto",
        "temperature": 0.3,
        "max_tokens": 2048,
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{SF_BASE}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )
        if resp.status_code != 200:
            raise RuntimeError(
                f"SF chat HTTP {resp.status_code}: {resp.text[:400]}"
            )
        data = resp.json()
        choice = (data.get("choices") or [{}])[0]
        return choice.get("message") or {}


# ── Main agent loop ──────────────────────────────────────────────────
SYSTEM_PROMPT = """你是用户的个人研究助理 Agent。你可以调用工具，在用户的个人知识库里搜索、阅读文章，并对工具返回的证据做综合推理。

工具使用原则：
1. **不要凭记忆回答** —— 用户问的问题必须基于他们自己库里的内容。**永远先调 search_library / list_recent_articles**。
2. **多步推理** —— search_library 给你 snippet 不够时，对最相关的几条调 read_article 拿全文。
3. **聚合不重复** —— 不要对同一查询反复调用同一工具。每次调用应该探索**新角度**或**深入某一篇**。
4. **达到充分信息后**直接给最终答案；不要无意义凑步数。

最终答案要求：
- 中文输出，结构化（开头核心结论 → 分点展开 → 引用）
- 每个论点后用 [《文章标题》] 标注来源；不要编造材料以外的内容
- 300-500 字，便于阅读
- 如果库里材料不足，**明说"库里材料不足"**而不是编造

你最多有 8 个工具调用回合。请高效。"""


async def run_tool_agent(
    db: AsyncSession,
    query: str,
    user_id: UUID,
) -> AsyncIterator[AgentEvent]:
    """Yield progress events through the tool-using agent loop."""
    yield _emit("start", "🤖 智能体启动，将自主选择工具…")

    messages: List[Dict] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": query},
    ]
    tool_call_count = 0

    try:
        for step in range(MAX_STEPS):
            assistant_msg = await _call_llm_with_tools(messages, TOOL_SCHEMAS)
            tool_calls = assistant_msg.get("tool_calls") or []

            # If the model output reasoning content before tool calls, surface it
            content = (assistant_msg.get("content") or "").strip()
            if content and tool_calls:
                yield _emit("thought", f"💭 {content[:120]}")

            if not tool_calls:
                # Final answer
                answer = content or "（模型未给出最终答案）"
                yield _emit("final", "完成", data={
                    "answer": answer,
                    "steps": step + 1,
                    "tool_calls": tool_call_count,
                })
                return

            # Re-attach the assistant message containing tool_calls (REQUIRED by API)
            messages.append({
                "role": "assistant",
                "content": content,
                "tool_calls": tool_calls,
            })

            # Execute every requested tool call (could be multiple in parallel)
            for tc in tool_calls:
                tool_call_count += 1
                fn = tc.get("function") or {}
                name = fn.get("name", "")
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except Exception:
                    args = {}
                yield _emit(
                    "tool_call",
                    f"🔧 调用 {name}（{_summarize_args(args)}）",
                    data={"name": name, "args": args},
                )
                result = await _execute_tool(name, args, db, user_id)
                yield _emit(
                    "tool_result",
                    _summarize_result(name, result),
                )
                # Feed result back to LLM
                result_str = json.dumps(result, ensure_ascii=False)
                if len(result_str) > MAX_TOOL_RESULT_CHARS:
                    result_str = result_str[:MAX_TOOL_RESULT_CHARS] + '..."}'
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.get("id", ""),
                    "content": result_str,
                })

        yield _emit("error", f"⚠️ 智能体执行 {MAX_STEPS} 步仍未给最终答案，已停止")
    except Exception as e:
        logger.exception(f"tool_agent crashed: {e}")
        yield _emit("error", f"⚠️ 智能体出错：{type(e).__name__}: {e}")


def _summarize_args(args: dict) -> str:
    """Compact one-liner for the progress message."""
    if not args:
        return ""
    parts = []
    for k, v in args.items():
        if isinstance(v, str) and len(v) > 30:
            v = v[:30] + "…"
        parts.append(f"{k}={v}")
    return ", ".join(parts)


def _summarize_result(name: str, result: dict) -> str:
    if "error" in result:
        return f"⚠️ {name} 错误：{result['error']}"
    if name == "search_library":
        cnt = result.get("count", 0)
        if cnt == 0:
            return "🔍 search_library：库里没找到相关文章"
        titles = "、".join(
            r.get("title", "")[:18] for r in (result.get("results") or [])[:3]
        )
        return f"🔍 search_library：{cnt} 篇 — {titles}"
    if name == "read_article":
        t = result.get("title", "Untitled")[:30]
        return f"📖 read_article：《{t}》"
    if name == "list_recent_articles":
        return f"📅 list_recent_articles：{result.get('count', 0)} 篇近 {result.get('days', 30)} 天"
    return f"✓ {name}"
