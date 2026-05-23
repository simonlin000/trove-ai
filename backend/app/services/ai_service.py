import httpx
import json
import logging
import re
from typing import Optional, Dict, Any
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Local deterministic embedding model (fastembed: ONNX runtime, no torch needed)
# BAAI/bge-small-en-v1.5: 384-dimensional, small (~130MB), fast, MIT license
EMBEDDING_MODEL = None


def _get_embedding_model():
    global EMBEDDING_MODEL
    if EMBEDDING_MODEL is None:
        try:
            logger.info("Loading embedding model BAAI/bge-small-en-v1.5 via fastembed...")
            EMBEDDING_MODEL = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
            logger.info("Embedding model loaded.")
        except Exception as e:
            logger.warning(f"Local embedding model load failed: {e}")
            EMBEDDING_MODEL = False  # Sentinel to avoid retrying
    if EMBEDDING_MODEL is False:
        raise RuntimeError("Local embedding model not available")
    return EMBEDDING_MODEL


def generate_local_embedding(text: str) -> list:
    """Generate a deterministic embedding vector using local ONNX model.
    Same input always produces the same output.
    """
    model = _get_embedding_model()
    # fastembed returns a generator of numpy arrays
    embeddings = list(model.embed([text[:8000]]))
    return embeddings[0].tolist()


# ============================================================
#  LLM JSON parsing — robust against malformed output
# ============================================================

_CODE_FENCE_RE = re.compile(r"^```(?:json)?\s*\n?|```\s*$", re.MULTILINE)


def _extract_json_object(text: str) -> Optional[str]:
    """Extract the first complete top-level {...} block from LLM text.

    Strips markdown code fences anywhere, then walks the text counting braces
    (respecting JSON string syntax) to find a balanced object. Returns None
    if no opening brace exists.
    """
    if not text:
        return None
    text = _CODE_FENCE_RE.sub("", text).strip()

    start = text.find("{")
    if start < 0:
        return None

    depth = 0
    in_string = False
    escape = False
    for i in range(start, len(text)):
        ch = text[i]
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    # Unbalanced — return what we have so json-repair can attempt completion.
    return text[start:]


def _parse_llm_json(text: str) -> Optional[Dict[str, Any]]:
    """Parse LLM JSON output with multi-stage repair. Returns None if unrepairable.

    Stages:
      1. Extract balanced {...} block.
      2. json.loads direct.
      3. json_repair.repair_json (handles unescaped inner quotes, trailing
         commas, unquoted keys, single quotes, etc.).
    """
    candidate = _extract_json_object(text)
    if candidate is None:
        return None

    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        pass

    try:
        from json_repair import repair_json
        repaired = repair_json(candidate, return_objects=False)
        result = json.loads(repaired)
        if isinstance(result, dict):
            logger.info("LLM JSON repaired via json_repair")
            return result
        return None
    except Exception as e:
        logger.warning(f"json_repair also failed: {e}")
        return None


def _sanitize_parsed_article(d: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce LLM-parsed article dict into the strict shapes we store.

    json_repair sometimes folds trailing top-level fields into an unclosed
    array (e.g. key_points), producing mixed-type lists like
    [str, str, str, 0, {"tags": [...], "source_platform": ...}]. Frontend
    React renders these as children and throws #31. We strip non-strings,
    cap counts, and lift any embedded scalar fields back to the top level.
    """
    if not isinstance(d, dict):
        return d

    # If key_points contains a trailing object holding the *other* fields,
    # promote those fields up first (so we don't lose tags/author/etc).
    kp = d.get("key_points")
    if isinstance(kp, list):
        for elem in kp:
            if isinstance(elem, dict):
                for promote_key in ("tags", "author", "source_platform", "estimated_reading_minutes", "title", "summary"):
                    if promote_key in elem and not d.get(promote_key):
                        d[promote_key] = elem[promote_key]
        d["key_points"] = [str(x).strip() for x in kp if isinstance(x, str) and str(x).strip()][:7]
    else:
        d["key_points"] = []

    tags = d.get("tags")
    if isinstance(tags, list):
        d["tags"] = [str(t).strip() for t in tags if isinstance(t, (str, int, float)) and str(t).strip()][:10]
    else:
        d["tags"] = []

    for skey in ("title", "summary", "source_platform", "author"):
        v = d.get(skey)
        if not isinstance(v, str):
            d[skey] = "" if v is None else str(v)

    rt = d.get("estimated_reading_minutes")
    if not isinstance(rt, int):
        try:
            d["estimated_reading_minutes"] = int(rt) if rt is not None else 5
        except (TypeError, ValueError):
            d["estimated_reading_minutes"] = 5

    return d


class LLMService:
    """Generic OpenAI-compatible LLM client used for article processing
    (title / summary / key-points / tag extraction), embeddings, RAG, etc.

    The actual provider is read dynamically from config_store.json (managed
    via the web Settings page). Any provider that speaks the OpenAI Chat
    Completions API works: OpenAI, DeepSeek, SiliconFlow, 讯飞星辰, 智谱,
    MiniMax, etc."""

    def __init__(self):
        # API key and base are now read dynamically from config_manager.
        # These instance attributes are kept for backward-compatible fallback only.
        from app.config_manager import get_llm_config
        cfg = get_llm_config()
        self.api_key = cfg.get('api_key', '')
        self.api_base = cfg.get('api_base', 'https://api.deepseek.com/v1').rstrip('/')
        self.model = cfg.get('model', 'deepseek-chat')

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def _chat(self, messages: list, temperature: float = 0.3) -> str:
        """Generic chat completion call using configured LLM provider."""
        from app.config_manager import get_llm_config
        cfg = get_llm_config()
        api_base = cfg.get('api_base', 'https://api.deepseek.com/v1').rstrip('/')
        api_key = cfg.get('api_key', '')
        model = cfg.get('model', 'deepseek-chat')
        
        url = f"{api_base}/chat/completions"
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": 4096,
        }

        logger.info(f"LLM API call: url={url}, model={model}, key_len={len(api_key) if api_key else 0}")

        last_err: Exception | None = None
        for attempt in range(3):  # 1 try + 2 retries
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    resp = await client.post(url, headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    }, json=payload)
                logger.info(f"LLM API response status: {resp.status_code} (attempt={attempt+1})")

                if 500 <= resp.status_code < 600:
                    last_err = Exception(f"LLM API 5xx: status={resp.status_code}, body={resp.text[:300]}")
                    logger.warning(f"{last_err} -- will retry")
                elif resp.status_code != 200:
                    raise Exception(f"LLM API error: status={resp.status_code}, body={resp.text[:300]}")
                else:
                    data = resp.json()
                    if "choices" in data and len(data["choices"]) > 0:
                        msg = data["choices"][0].get("message", {})
                        content = msg.get("content", "") or msg.get("reasoning_content", "")
                        if content:
                            return content
                    if "reply" in data:
                        return data["reply"]
                    logger.error(f"Unexpected LLM response format: {json.dumps(data)[:500]}")
                    raise Exception(f"Unexpected response format: {json.dumps(data)[:200]}")

            except (httpx.ConnectError, httpx.ReadTimeout, httpx.ConnectTimeout, httpx.RemoteProtocolError) as e:
                last_err = Exception(f"LLM API network error ({type(e).__name__}): {str(e)}")
                logger.warning(f"{last_err} -- will retry")
            except httpx.HTTPError as e:
                logger.error(f"HTTP error calling LLM (non-retryable): {e}")
                raise Exception(f"LLM API HTTP error: {str(e)}")

            # backoff before next retry
            if attempt < 2:
                import asyncio
                await asyncio.sleep(2 ** attempt)  # 1s, 2s

        logger.error(f"LLM API failed after 3 attempts: {last_err}")
        raise last_err or Exception("LLM API failed after retries")

    async def parse_article(self, content: str, url: str, raw_html: str = "") -> Dict[str, Any]:
        """
        Parse raw article content and extract structured information.
        Returns: title, summary, key_points, tags, source_platform, author
        """
        # Build richer content for AI: use both plain_text and raw_html metadata
        content_snippet = ""
        if content and len(content) > 100:
            content_snippet = content[:8000]  # More content for better summary
        elif raw_html and len(raw_html) > 100:
            # Extract text from raw HTML
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(raw_html, 'lxml')
            text = soup.get_text(separator='\n', strip=True)
            content_snippet = text[:8000]
        
        if not content_snippet:
            content_snippet = content or ""

        system_prompt = """你是一位专业的内容分析专家和知识管理顾问。你的任务是将任意文章转化为高质量的个人知识库条目。
分析文章内容时，你需要：
1. 深入理解文章的核心论点、论证逻辑和结论
2. 提取关键概念和知识点
3. 总结要足够详细，让读者不读原文也能了解80%的核心内容
4. 标签要有层次：既要有宽泛的领域标签，也要有精确的技术/概念标签

严格按照要求的JSON格式返回，不要添加任何额外的文字说明。
在JSON字符串值内部如需引用文字，**必须使用中文标点「」**而非英文双引号"，否则会破坏 JSON 语法。"""

        user_prompt = f"""请深入分析以下文章，生成高质量的知识库条目。

文章URL: {url}

文章内容（Markdown/纯文本）:
{content_snippet}

请以JSON格式返回（确保是合法的JSON对象，不要包含markdown代码块标记）：
{{
    "title": "文章标题（提取原标题，不要修改；若原标题不完整可根据内容补充）",
    "summary": "150-300字的详细摘要。不只是结论，要包含：1)文章讨论的核心问题是什么 2)主要分析/论证过程 3)最终结论或观点。让读者不读原文也能掌握80%的核心内容。",
    "key_points": ["核心观点1（一句话概括并包含具体信息）", "核心观点2", "核心观点3", "核心观点4", "核心观点5"],
    "tags": ["领域标签(2-3字)", "技术/概念标签(2-6字)", "具体标签(2-6字)", "标签4", "标签5", "标签6", "标签7"],
    "source_platform": "来源平台(wechat/toutiao/jianshu/csdn/medium/bilibili/xhs/douyin/other)",
    "author": "作者名/公众号名（如无则填unknown）",
    "estimated_reading_minutes": 5
}}"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]
        try:
            result = await self._chat(messages)
        except Exception as e:
            raise Exception(f"AI parse failed: {str(e)}")

        parsed = _parse_llm_json(result)
        if parsed is None:
            # Graceful degradation: even repair couldn't extract a dict.
            # Don't blow up — return a minimal dict so background processing can
            # still mark the article as processed (just without AI enrichment).
            logger.error(
                f"AI parse unrepairable, falling back to minimal dict. "
                f"Raw head: {result[:300] if result else 'empty'}"
            )
            return {
                "title": "",
                "summary": "",
                "key_points": [],
                "tags": [],
                "source_platform": "other",
                "author": "unknown",
                "estimated_reading_minutes": 5,
            }
        parsed = _sanitize_parsed_article(parsed)
        logger.info(f"Successfully parsed article: title={(parsed.get('title') or 'N/A')[:50]}")
        return parsed

    async def generate_summary(self, content: str) -> str:
        """Generate a concise summary of the article."""
        system_prompt = "你是一位专业的内容编辑，擅长提炼文章核心内容。"
        user_prompt = f"请用三句话概括以下文章的核心内容：\n\n{content[:5000]}\n\n直接返回摘要文本。"
        return await self._chat([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ])

    async def extract_key_points(self, content: str) -> list:
        """Extract key points from the article."""
        system_prompt = "你是一位专业的内容分析师，擅长提取文章关键观点。"
        user_prompt = f"请从以下文章中提取3-5个核心观点，每个观点一句话概括。\n\n{content[:5000]}\n\n以JSON数组格式返回，如：['观点1', '观点2', '观点3']。只返回JSON数组。"
        try:
            result = await self._chat([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ])
            result = result.strip()
            if result.startswith("```json"):
                result = result[7:]
            if result.startswith("```"):
                result = result[3:]
            if result.endswith("```"):
                result = result[:-3]
            return json.loads(result)
        except:
            return []

    async def generate_tags(self, content: str, title: str) -> list:
        """Generate relevant tags for the article."""
        system_prompt = "你是一位知识管理专家，擅长为文章打标签分类。"
        user_prompt = f"请为以下文章生成3-5个相关标签（每个标签2-4个字）。\n\n标题：{title}\n内容摘要：{content[:3000]}\n\n以JSON数组格式返回，如：['人工智能', '深度学习']。只返回JSON数组。"
        try:
            result = await self._chat([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ])
            result = result.strip()
            if result.startswith("```json"):
                result = result[7:]
            if result.startswith("```"):
                result = result[3:]
            if result.endswith("```"):
                result = result[:-3]
            return json.loads(result)
        except:
            return []

    async def generate_knowledge_graph(self, articles: list) -> Dict[str, Any]:
        """
        Generate knowledge graph relationships between articles.
        articles: list of {id, title, summary}
        """
        articles_text = "\n".join([
            "ID:{id}|Title:{title}|Summary:{summary}".format(
                id=a['id'], title=a['title'],
                summary=a.get('summary','')[:200]
            )
            for a in articles
        ])

        system_prompt = "你是一位知识图谱专家，擅长分析文章之间的关系。"
        user_prompt = f"""分析以下文章之间的关系，构建知识图谱：

{articles_text}

请找出文章之间的关联关系（related=相关, prerequisite=前置知识, extends=延伸阅读, contradicts=观点对立），返回JSON：
{{
    "edges": [
        {{"source": "源文章ID", "target": "目标文章ID", "relation_type": "关系类型", "relation_desc": "关系描述", "weight": 0.8}}
    ]
}}
只返回JSON，最多30条边。"""

        try:
            result = await self._chat([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ], temperature=0.3)
            result = result.strip()
            if result.startswith("```json"):
                result = result[7:]
            if result.startswith("```"):
                result = result[3:]
            if result.endswith("```"):
                result = result[:-3]
            return json.loads(result)
        except:
            return {"edges": []}

    async def generate_learning_path(self, topic: str, articles: list) -> Dict[str, Any]:
        """Generate a learning path from articles on a given topic."""
        articles_text = "\n".join([
            "ID:{id}|Title:{title}|Summary:{summary}".format(
                id=a['id'], title=a['title'],
                summary=a.get('summary','')[:150]
            )
            for a in articles
        ])

        system_prompt = "你是一位知识管理专家，擅长设计学习路线。"
        user_prompt = f"""为主题「{topic}」设计最佳学习路线。

可用文章：
{articles_text}

请按学习先后顺序排列文章ID，并生成学习路线描述。返回JSON：
{{
    "title": "学习路线标题",
    "description": "路线描述",
    "ordered_articles": ["文章ID1", "文章ID2", ...]
}}
只返回JSON。"""

        try:
            result = await self._chat([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ], temperature=0.5)
            result = result.strip()
            if result.startswith("```json"):
                result = result[7:]
            if result.startswith("```"):
                result = result[3:]
            if result.endswith("```"):
                result = result[:-3]
            return json.loads(result)
        except:
            return {"title": topic, "description": "", "ordered_articles": [a['id'] for a in articles]}

    async def get_embedding(self, text: str, emb_type: str = "db") -> list:
        """Get embedding vector using configured provider (prefer API if available)."""
        from app.config_manager import get_embedding_config
        
        emb_cfg = get_embedding_config()
        provider = emb_cfg.get("provider", "local")
        api_key = emb_cfg.get("api_key", "")
        api_base = emb_cfg.get("api_base", "")
        model = emb_cfg.get("model", "BAAI/bge-m3")
        
        # Use API if provider is not local and we have a key
        if provider != "local" and api_key and api_base:
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.post(
                        f"{api_base}/embeddings",
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": model,
                            "input": text,
                            "encoding_format": "float",
                        },
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        emb = data.get("data", [{}])[0].get("embedding", [])
                        if emb:
                            return emb
                    logger.warning(f"API embedding failed ({resp.status_code}), falling back to local")
            except Exception as e:
                logger.warning(f"API embedding error: {e}, falling back to local")
        
        # Fallback to local model
        return generate_local_embedding(text)

    async def generate_mindmap(self, content: str, title: str) -> Dict[str, Any]:
        """Generate a hierarchical mind map from article content.

        Uses AI to deeply analyze the article and extract a tree structure
        with a central root node, 3-5 major branches, and 2-4 sub-points each.
        """
        system_prompt = "你是一位专业的知识结构分析师，擅长将复杂内容转化为层次分明的思维导图。请严格按照JSON格式返回，不要添加任何额外文字。"

        user_prompt = f"""请深入分析以下文章，提取其核心知识结构，生成一个层次分明的思维导图。

文章标题：{title}

文章内容：
{content[:8000]}

要求：
1. 深入分析文章的核心主题和逻辑结构
2. 将核心主题作为根节点（root label），尽量精炼概括
3. 根据文章结构创建3-5个主要分支作为根节点的children
4. 每个主要分支下添加2-4个子要点作为children
5. 严格按照以下JSON格式返回，不要包含markdown代码块标记：
{{
    "title": "文章标题",
    "root": {{
        "label": "核心主题",
        "children": [
            {{
                "label": "主要分支1",
                "children": [
                    {{"label": "子要点1", "children": []}},
                    {{"label": "子要点2", "children": []}}
                ]
            }}
        ]
    }}
}}"""

        try:
            result = await self._chat([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ], temperature=0.5)

            # Parse JSON from response, handle markdown code blocks
            result = result.strip()
            if result.startswith("```json"):
                result = result[7:]
            if result.startswith("```"):
                result = result[3:]
            if result.endswith("```"):
                result = result[:-3]
            result = result.strip()

            parsed = json.loads(result)
            logger.info(f"Mindmap generated for article: {title[:50]}")
            return parsed
        except json.JSONDecodeError as e:
            logger.error(f"Mindmap JSON decode error: {e}, raw: {result[:300] if 'result' in dir() else 'N/A'}")
            return {
                "title": title,
                "root": {
                    "label": title,
                    "children": [],
                },
            }
        except Exception as e:
            logger.error(f"Mindmap generation failed: {e}")
            return {
                "title": title,
                "root": {
                    "label": title,
                    "children": [],
                },
            }


llm_service = LLMService()
