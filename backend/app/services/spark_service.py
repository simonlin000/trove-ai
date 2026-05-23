"""
Spark Service - 一句话灵感→文章生成 pipeline.

Pipeline:
  Step 1: Topic expansion → 200-300 char overview
  Step 2: Outline generation → 3-5 sections as JSON
  Step 3: Section writing → 200-400 words per section
  Step 4: Final polish → complete markdown article
"""

import json
import logging
from typing import Any, Dict, List

from app.services.ai_service import _parse_llm_json, llm_service

logger = logging.getLogger(__name__)


def _parse_json_safe(raw: str, default: Any = None) -> Any:
    """Robust JSON parsing for AI responses. Uses the same multi-stage repair
    helper as ai_service.parse_article (handles fences, unescaped quotes,
    trailing commas via json-repair). Falls back to a plain attempt for arrays."""
    # First try the dict-oriented parser (handles most LLM oddities)
    parsed = _parse_llm_json(raw)
    if parsed is not None:
        return parsed
    # _parse_llm_json walks balanced { } and ignores arrays at top level — try
    # a direct decode after stripping fences for the array case.
    cleaned = raw.strip()
    for fence in ("```json", "```"):
        if cleaned.startswith(fence):
            cleaned = cleaned[len(fence):]
            break
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except Exception:
        try:
            from json_repair import repair_json
            return json.loads(repair_json(cleaned, return_objects=False))
        except Exception as e:
            logger.warning(f"JSON parse failed even with repair: {e}, raw[:200]: {cleaned[:200]}")
            return default


def _normalize_outline(outline: Any, sentence: str) -> List[Dict[str, Any]]:
    """Coerce whatever the LLM returned into the [{heading, key_points}, ...] shape.

    LLMs sometimes return:
    - list of strings: ["章节1", "章节2"]
    - dict with "sections" key: {"sections": [...]}
    - dict with chapters as keys: {"chapter1": [...], ...}
    """
    # Unwrap a top-level dict if it has a list child
    if isinstance(outline, dict):
        for k in ("sections", "outline", "chapters", "items"):
            if isinstance(outline.get(k), list):
                outline = outline[k]
                break
        else:
            # Treat dict-of-chapters as items
            outline = [{"heading": str(k), "key_points": v if isinstance(v, list) else []}
                       for k, v in outline.items()]

    if not isinstance(outline, list):
        return []

    normalized: List[Dict[str, Any]] = []
    for i, sec in enumerate(outline):
        if isinstance(sec, str):
            normalized.append({"heading": sec.strip() or f"章节{i+1}", "key_points": []})
        elif isinstance(sec, dict):
            heading = sec.get("heading") or sec.get("title") or sec.get("name") or f"章节{i+1}"
            kp = sec.get("key_points") or sec.get("points") or sec.get("keypoints") or []
            if not isinstance(kp, list):
                kp = [str(kp)]
            kp = [str(p) for p in kp if p]
            normalized.append({"heading": str(heading), "key_points": kp})
    return normalized


async def _step1_topic_expansion(sentence: str) -> str:
    """Expand a one-sentence topic into a 200-300 character overview."""
    system_prompt = (
        "你是一位知识渊博的学者和教育家。用户会给你一个概念或知识点，请你从多个维度展开讲解。"
    )
    user_prompt = (
        f"请围绕「{sentence}」这个概念，写一段200-300字的背景介绍，涵盖："
        "1)这个概念是什么 2)为什么重要 3)主要应用场景 4)当前发展状态。直接返回文字，不要标题。"
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    result = await llm_service._chat(messages, temperature=0.7)
    logger.info(f"Step 1 (topic expansion) completed. Length: {len(result)} chars")
    return result.strip()


async def _step2_outline(sentence: str, expanded_topic: str) -> List[Dict[str, Any]]:
    """Generate a structured outline with 3-5 sections from the expanded topic."""
    system_prompt = "你是一位结构化思维专家。基于前文对话题的分析，生成一个逻辑清晰的文章大纲。"
    user_prompt = (
        f"关于「{sentence}」，基于以下背景：\n{expanded_topic}\n\n"
        "请生成一个包含3-5个章节的文章大纲，每个章节需要标题和该节要讨论的2-3个关键点。"
        '以JSON数组格式返回：[{"heading": "章节标题", "key_points": ["要点1", "要点2"]}, ...]'
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    result = await llm_service._chat(messages, temperature=0.5)
    raw_outline = _parse_json_safe(result, default=[])
    outline = _normalize_outline(raw_outline, sentence)
    if not outline:
        # Fallback: create a minimal outline from the sentence
        logger.warning(f"Step 2 outline parse/normalize failed (raw type={type(raw_outline).__name__}), using fallback.")
        outline = [
            {"heading": f"理解{sentence}", "key_points": ["核心概念", "背景与意义"]},
            {"heading": "深入分析", "key_points": ["技术细节", "关键要素"]},
            {"heading": "应用与实践", "key_points": ["实际案例", "最佳实践"]},
            {"heading": "总结与展望", "key_points": ["核心要点回顾", "未来发展趋势"]},
        ]
    logger.info(f"Step 2 (outline) completed. Sections: {len(outline)}")
    return outline


async def _step3_write_section(sentence: str, heading: str, key_points: List[str]) -> str:
    """Write content for a single section (200-400 words)."""
    system_prompt = "你是一位专业的技术作家，擅长将复杂概念用通俗易懂的语言讲清楚。"
    key_points_str = ", ".join(key_points)
    user_prompt = (
        f"你正在写一篇关于「{sentence}」的文章。\n\n"
        f"当前章节：《{heading}》\n"
        f"需要讨论的要点：{key_points_str}\n\n"
        "请为这一章节撰写200-400字的正文内容。要求：1)逻辑清晰 2)用例子帮助理解 3)语言流畅自然。直接返回正文，不要标题。"
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    result = await llm_service._chat(messages, temperature=0.7)
    logger.info(f"Step 3 (section write) for '{heading}' completed. Length: {len(result)} chars")
    return result.strip()


async def _step4_polish(sentence: str, sections: List[Dict[str, Any]]) -> str:
    """Assemble and polish the final article from all sections."""
    # Build markdown from sections
    all_sections_md_parts = []
    for i, sec in enumerate(sections, 1):
        heading = sec.get("heading", f"章节{i}")
        content = sec.get("content", "")
        all_sections_md_parts.append(f"## {heading}\n\n{content}")
    all_sections_md = "\n\n".join(all_sections_md_parts)

    system_prompt = "你是一位资深编辑。请将以下各个章节组合成一篇完整、连贯的文章，确保过渡自然。"
    user_prompt = (
        f"标题：{sentence}\n\n"
        f"{all_sections_md}\n\n"
        "请润色以上文章，使各节之间的过渡更自然，修正可能的重复内容，保持专业但不晦涩。"
        "直接返回润色后的完整文章（Markdown格式）。"
    )
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]
    result = await llm_service._chat(messages, temperature=0.5)
    logger.info(f"Step 4 (polish) completed. Final length: {len(result)} chars")
    return result.strip()


async def generate_article(sentence: str) -> Dict[str, Any]:
    """
    Orchestrate the full spark pipeline: 一句话 → 完整文章.

    Returns a dict with:
        - title: str (the sentence used as title)
        - content: str (the final polished markdown article)
        - sections: list of {heading, key_points, content}
        - steps_completed: list of step names that completed
        - status: "completed" or "partial"
    """
    steps_completed: List[str] = []
    sections: List[Dict[str, Any]] = []

    # Step 1: Topic expansion
    try:
        expanded_topic = await _step1_topic_expansion(sentence)
        steps_completed.append("topic_expansion")
    except Exception as e:
        logger.error(f"Step 1 failed: {e}")
        expanded_topic = sentence
        steps_completed.append("topic_expansion_fallback")

    # Step 2: Outline generation
    try:
        outline = await _step2_outline(sentence, expanded_topic)
        steps_completed.append("outline")
    except Exception as e:
        logger.error(f"Step 2 failed: {e}")
        outline = [
            {"heading": f"关于{sentence}", "key_points": ["核心概念", "背景", "应用"]},
        ]
        steps_completed.append("outline_fallback")

    # Step 3: Write each section sequentially
    sections = []
    for i, sec in enumerate(outline):
        heading = sec.get("heading", f"章节{i+1}")
        key_points = sec.get("key_points", [])
        try:
            content = await _step3_write_section(sentence, heading, key_points)
        except Exception as e:
            logger.error(f"Step 3 failed for section '{heading}': {e}")
            content = f"（本节内容生成失败：{e}）"
        sections.append({
            "heading": heading,
            "key_points": key_points,
            "content": content,
        })
    steps_completed.append("sections_written")

    # Step 4: Polish
    try:
        final_content = await _step4_polish(sentence, sections)
        steps_completed.append("polished")
    except Exception as e:
        logger.error(f"Step 4 failed: {e}")
        # Fallback: assemble sections without polish
        parts = [f"# {sentence}\n"]
        for sec in sections:
            parts.append(f"## {sec['heading']}\n\n{sec['content']}")
        final_content = "\n\n".join(parts)
        steps_completed.append("polish_fallback")

    status = "completed" if "polished" in steps_completed and "polish_fallback" not in steps_completed else "partial"

    return {
        "title": sentence,
        "content": final_content,
        "sections": sections,
        "steps_completed": steps_completed,
        "status": status,
    }
