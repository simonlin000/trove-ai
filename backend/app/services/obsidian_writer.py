"""Obsidian writer — write articles pulled from the sync API to a local vault.

Model: ONE-SHOT SNAPSHOT.
  - Each article is synced to disk at most ONCE per local machine.
  - After the first write, the local file is NEVER touched by this writer —
    not on server update, not on AI re-processing. The user is free to edit
    the .md in Obsidian without fear of being overwritten.

"Already synced" detection is dual-OR:
  - id in sync_state.json   OR   a .md file in the vault has `trove_id: <id>`
Either signal alone is enough; together they survive both Obsidian-side
deletions AND accidental sync_state.json loss.

Design: docs/obsidian-sync-design.md
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, Optional, Set

import httpx

logger = logging.getLogger("trove.obsidian")

# Subfolder names by source_platform (uniform with frontend platform labels)
PLATFORM_FOLDER: Dict[str, str] = {
    "toutiao": "头条",
    "douyin": "抖音",
    "xiaohongshu": "小红书",
    "xhs": "小红书",
    "bilibili": "B站",
    "wechat": "公众号",
    "weixin": "公众号",
    "note": "笔记",
    "spark": "Spark",
    "pdf": "上传",
    "word": "上传",
    "excel": "上传",
    "powerpoint": "上传",
    "image": "上传",
    "text": "上传",
    "web": "上传",
    "epub": "上传",
    "markdown": "上传",
    "upload": "上传",
}
DEFAULT_FOLDER = "其他"
SUBROOT = "Trove"  # under the user-provided vault root


def _slugify_for_filename(s: str, maxlen: int = 120) -> str:
    """Filesystem-safe filename. Keeps the ORIGINAL title — only strips chars
    that filesystems forbid. Collapses whitespace runs to a single space (so
    Obsidian explorer shows the title naturally) instead of '-' so the title
    reads exactly like the article."""
    if not s:
        return ""
    s = re.sub(r"[\\/:\*\?\"<>\|\n\r\t]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s[:maxlen] if s else ""


def _yaml_escape(s: str) -> str:
    """Conservative YAML scalar escaping for frontmatter values."""
    if s is None:
        return ""
    s = str(s).replace("\\", "\\\\").replace("\"", "\\\"")
    s = s.replace("\n", " ").replace("\r", " ")
    return s


def _yaml_list(items: Iterable[str]) -> str:
    cleaned = [str(x).replace("\n", " ").replace("[", "(").replace("]", ")") for x in items]
    return "[" + ", ".join(cleaned) + "]"


# ============================================================
#  Sync state — index of which article ids we've already written
# ============================================================

class SyncState:
    def __init__(self, path: Path):
        self.path = path
        self.last_sync_at: Optional[str] = None
        self.synced: Dict[str, dict] = {}  # article_id -> {file, synced_at}

    @classmethod
    def load(cls, path: Path) -> "SyncState":
        self = cls(path)
        if path.is_file():
            try:
                raw = json.loads(path.read_text(encoding="utf-8"))
                self.last_sync_at = raw.get("last_sync_at")
                self.synced = raw.get("synced") or {}
            except Exception as e:
                logger.warning(f"sync_state corrupt, ignoring: {e}")
        return self

    def save(self) -> None:
        payload = {
            "version": 1,
            "last_sync_at": self.last_sync_at,
            "synced": self.synced,
        }
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, self.path)

    def is_synced(self, article_id: str) -> bool:
        return article_id in self.synced

    def mark_synced(self, article_id: str, relative_file: str) -> None:
        self.synced[article_id] = {
            "file": relative_file,
            "synced_at": datetime.now(timezone.utc).isoformat(),
        }


# ============================================================
#  Frontmatter scan — rebuild "synced" set from existing vault files
# ============================================================

_FRONTMATTER_ID_RE = re.compile(r"^trove_id:\s*([0-9a-fA-F-]{20,})\s*$", re.MULTILINE)


def scan_existing_ids(root: Path) -> Set[str]:
    """Walk vault root, return set of trove_id values found in .md frontmatter.
    Used as a fallback when sync_state.json is missing or corrupted."""
    found: Set[str] = set()
    if not root.is_dir():
        return found
    for p in root.rglob("*.md"):
        try:
            with p.open("r", encoding="utf-8", errors="ignore") as f:
                head = f.read(2048)  # frontmatter is at the very top
            m = _FRONTMATTER_ID_RE.search(head)
            if m:
                found.add(m.group(1))
        except Exception:
            continue
    return found


# ============================================================
#  File writing
# ============================================================

def _resolve_subfolder(platform: Optional[str]) -> str:
    if not platform:
        return DEFAULT_FOLDER
    return PLATFORM_FOLDER.get(platform.lower(), DEFAULT_FOLDER)


def _compute_filename(article: dict) -> str:
    """Filename is just the original title. Collisions handled at write time
    by appending ` (2).md`, ` (3).md`, etc. Empty-title articles fall back to
    a short id-based name so they're still distinguishable."""
    title = _slugify_for_filename(article.get("title") or "")
    if title:
        return f"{title}.md"
    id8 = str(article["id"]).replace("-", "")[:8]
    return f"trove-{id8}.md"


def _related_wikilinks(related_ids: list[str], id_to_filename: Dict[str, str]) -> list[str]:
    """Build [[wikilink]] strings for related articles. Skip ids we don't have a
    file for yet (they may sync in a later batch — Obsidian shows them as
    unresolved links, which is fine and gets resolved automatically once they
    appear)."""
    lines = []
    for rid in related_ids:
        # Use the basename without .md as wikilink target
        fname = id_to_filename.get(rid)
        if fname:
            link = fname[:-3] if fname.endswith(".md") else fname
        else:
            # Unresolved link — use raw id (will resolve when synced later)
            link = f"trove-{rid[:8]}"
        lines.append(f"- [[{link}]]")
    return lines


def render_article_md(article: dict, id_to_filename: Dict[str, str]) -> str:
    """Render the full .md content for one article."""
    title = article.get("title") or "Untitled"
    summary = (article.get("summary") or "").strip()
    key_points = article.get("key_points") or []
    tags = article.get("tags") or []
    related = article.get("related_article_ids") or []
    source_url = article.get("source_url") or ""
    source_platform = article.get("source_platform") or ""
    author = article.get("author") or ""
    content_type = article.get("content_type") or "article"
    clean_content = (article.get("clean_content") or "").strip()
    reading_time = article.get("reading_time") or 0
    created_at = article.get("created_at") or ""
    updated_at = article.get("updated_at") or ""

    # --- Frontmatter ---
    fm_lines = [
        "---",
        f'trove_id: {article["id"]}',
        f'title: "{_yaml_escape(title)}"',
    ]
    if source_url:
        fm_lines.append(f'source_url: "{_yaml_escape(source_url)}"')
    if source_platform:
        fm_lines.append(f'source_platform: {source_platform}')
    if author:
        fm_lines.append(f'author: "{_yaml_escape(author)}"')
    if content_type:
        fm_lines.append(f'content_type: {content_type}')
    if reading_time:
        fm_lines.append(f'reading_time: {reading_time}')
    if tags:
        fm_lines.append(f'tags: {_yaml_list(tags)}')
    if summary:
        fm_lines.append(f'summary: "{_yaml_escape(summary)}"')
    fm_lines.append(f'created_at: {created_at}')
    fm_lines.append(f'updated_at: {updated_at}')
    fm_lines.append(f'synced_at: {datetime.now(timezone.utc).isoformat()}')
    fm_lines.append("---")

    # --- Body ---
    body_lines = ["", f"# {title}", ""]

    if summary:
        body_lines += ["> [!info] 摘要", f"> {summary}", ""]

    if key_points:
        body_lines += ["## 关键点", ""]
        for kp in key_points:
            body_lines.append(f"- {kp}")
        body_lines.append("")

    body_lines += ["## 正文", "", clean_content, ""]

    if related:
        wikilinks = _related_wikilinks(related, id_to_filename)
        if wikilinks:
            body_lines += ["## 相关"] + wikilinks + [""]

    if source_url:
        body_lines += ["---", f"原文链接: {source_url}"]

    return "\n".join(fm_lines + body_lines)


def write_article(
    vault_root: Path,
    article: dict,
    id_to_filename: Dict[str, str],
) -> str:
    """Write one article. Returns the path (relative to Trove AI subroot)."""
    subfolder = _resolve_subfolder(article.get("source_platform"))
    folder = vault_root / SUBROOT / subfolder
    folder.mkdir(parents=True, exist_ok=True)
    filename = _compute_filename(article)
    # Handle filename collision — never overwrite existing files. We keep the
    # base filename and just suffix " (2)", " (3)", etc. So same-title articles
    # land as "标题.md", "标题 (2).md", "标题 (3).md".
    target = folder / filename
    suffix_n = 2
    while target.exists():
        target = folder / _next_collision_filename(filename, suffix_n)
        suffix_n += 1
    content = render_article_md(article, id_to_filename)
    tmp = target.with_suffix(target.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, target)
    return str(target.relative_to(vault_root))


def _next_collision_filename(base_name: str, n: int) -> str:
    """`name.md` + n=2 → `name (2).md`. Used when first choice already exists."""
    if base_name.endswith(".md"):
        return f"{base_name[:-3]} ({n}).md"
    return f"{base_name} ({n}).md"


# ============================================================
#  Sync loop
# ============================================================

class ObsidianSyncer:
    """Pull articles from upstream and write them to local vault, one-shot.

    Usage:
        syncer = ObsidianSyncer(upstream_url, user_token, vault_root)
        await syncer.run_once()           # one pass
        await syncer.run_forever(interval=300)
    """

    def __init__(
        self,
        upstream_url: str,
        user_token: str,
        vault_root: Path,
        page_size: int = 200,
    ):
        self.upstream = upstream_url.rstrip("/")
        self.vault_root = vault_root
        self.page_size = page_size
        self.state_path = vault_root / SUBROOT / "_meta" / "sync_state.json"
        self.headers = {"Authorization": f"Bearer {user_token}"}
        self._stopping = False

    async def stop(self):
        self._stopping = True

    def _load_state_with_scan(self) -> SyncState:
        """Load sync_state.json, then UNION with frontmatter scan of vault.
        Either signal alone marks an article as 'already synced'."""
        state = SyncState.load(self.state_path)
        scanned = scan_existing_ids(self.vault_root / SUBROOT)
        for sid in scanned:
            if sid not in state.synced:
                # Mark as synced without a known file path (we discovered it on disk)
                state.synced[sid] = {
                    "file": "(discovered-via-scan)",
                    "synced_at": datetime.now(timezone.utc).isoformat(),
                }
        return state

    async def _fetch_page(
        self,
        client: httpx.AsyncClient,
        since: Optional[str],
        cursor: Optional[str],
    ) -> dict:
        params: Dict[str, str] = {"limit": str(self.page_size)}
        if since:
            params["since"] = since
        if cursor:
            params["cursor"] = cursor
        r = await client.get(
            f"{self.upstream}/api/sync/articles",
            params=params,
            headers=self.headers,
        )
        if r.status_code == 401:
            raise RuntimeError("Sync token rejected (401). Re-issue from /settings.")
        r.raise_for_status()
        return r.json()

    async def run_once(self) -> dict:
        """One full sweep. Returns summary: {pulled, written, skipped}."""
        state = self._load_state_with_scan()
        pulled = 0
        written = 0
        skipped = 0
        # Build id->filename map for wikilink resolution within this run
        id_to_filename: Dict[str, str] = {
            sid: os.path.basename(info.get("file") or "")
            for sid, info in state.synced.items()
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            since = state.last_sync_at  # may be None on first run
            cursor: Optional[str] = None
            server_time = None
            while not self._stopping:
                page = await self._fetch_page(client, since, cursor)
                server_time = page.get("server_time") or server_time
                articles = page.get("articles") or []
                pulled += len(articles)

                # First pass: build id->filename for THIS batch (for related links)
                for a in articles:
                    if a["id"] in id_to_filename:
                        continue
                    # Pre-compute filename so related links inside this batch resolve
                    id_to_filename[a["id"]] = _compute_filename(a)

                # Second pass: write
                for a in articles:
                    aid = a["id"]
                    if state.is_synced(aid):
                        skipped += 1
                        continue
                    try:
                        rel = write_article(self.vault_root, a, id_to_filename)
                        state.mark_synced(aid, rel)
                        written += 1
                        logger.info(f"wrote {rel}")
                    except Exception as e:
                        logger.error(f"write failed for {aid}: {e}")

                cursor = page.get("next_cursor")
                if not cursor:
                    break

        if server_time:
            state.last_sync_at = server_time
        state.save()
        return {"pulled": pulled, "written": written, "skipped": skipped}

    async def run_forever(self, interval: int = 300):
        logger.info(
            f"Obsidian sync started — vault={self.vault_root} interval={interval}s"
        )
        while not self._stopping:
            try:
                summary = await self.run_once()
                logger.info(
                    f"sync round: pulled={summary['pulled']} "
                    f"written={summary['written']} skipped={summary['skipped']}"
                )
            except Exception as e:
                logger.exception(f"sync round failed: {e}")
            # Sleep with quick cancellation
            slept = 0
            while slept < interval and not self._stopping:
                await asyncio.sleep(1)
                slept += 1
