"""Audio/video transcription via SiliconFlow SenseVoice.

OpenAI-compatible endpoint:
    POST {base}/v1/audio/transcriptions
    multipart: file=<mp4/mp3/wav>, model=FunAudioLLM/SenseVoiceSmall

We reuse the embedding-group api_key in config_store (same SiliconFlow account)
to avoid maintaining a separate key.
"""
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class TranscriptionService:
    DEFAULT_MODEL = "FunAudioLLM/SenseVoiceSmall"
    MAX_FILE_SIZE_MB = 80  # be conservative; SF rejects very large uploads
    DOWNLOAD_TIMEOUT_S = 90
    TRANSCRIBE_TIMEOUT_S = 240

    def __init__(self):
        from app.config_manager import get_effective_config
        cfg = get_effective_config("embedding")  # same SF account
        self.api_key = cfg.get("api_key", "") or os.getenv("SILICONFLOW_API_KEY", "")
        self.api_base = (cfg.get("api_base") or "https://api.siliconflow.cn/v1").rstrip("/")

    @property
    def available(self) -> bool:
        return bool(self.api_key)

    async def transcribe_url(
        self,
        video_url: str,
        referer: Optional[str] = None,
    ) -> Optional[str]:
        """Download a video/audio URL, transcribe, return text.

        Returns None on any failure (missing key, download too large, SF error).
        Callers should treat None as "transcription unavailable, skip" and
        proceed with existing content.
        """
        if not self.available:
            logger.warning("transcription: no SF api_key; skipping")
            return None

        suffix = ".mp4"  # SenseVoice accepts mp4/wav/mp3; we default to mp4
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp_path = Path(tmp.name)

        try:
            if not await self._download(video_url, tmp_path, referer):
                return None
            return await self._transcribe_local(tmp_path)
        finally:
            tmp_path.unlink(missing_ok=True)

    async def _download(self, url: str, dest: Path, referer: Optional[str]) -> bool:
        headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        }
        if referer:
            headers["Referer"] = referer
        try:
            async with httpx.AsyncClient(
                timeout=self.DOWNLOAD_TIMEOUT_S, follow_redirects=True
            ) as client:
                async with client.stream("GET", url, headers=headers) as resp:
                    if resp.status_code != 200:
                        logger.warning(
                            f"transcribe download HTTP {resp.status_code} for {url[:100]}"
                        )
                        return False
                    size = 0
                    cap = self.MAX_FILE_SIZE_MB * 1024 * 1024
                    with open(dest, "wb") as f:
                        async for chunk in resp.aiter_bytes(64 * 1024):
                            f.write(chunk)
                            size += len(chunk)
                            if size > cap:
                                logger.warning(
                                    f"transcribe abort: file >{self.MAX_FILE_SIZE_MB}MB"
                                )
                                return False
            logger.info(f"transcribe downloaded {size // 1024} KB from {url[:80]}")
            return True
        except Exception as e:
            logger.warning(f"transcribe download failed: {e}")
            return False

    async def _transcribe_local(self, path: Path) -> Optional[str]:
        try:
            with open(path, "rb") as f:
                file_bytes = f.read()
        except Exception as e:
            logger.warning(f"read local file failed: {e}")
            return None

        try:
            async with httpx.AsyncClient(timeout=self.TRANSCRIBE_TIMEOUT_S) as client:
                files = {"file": (path.name, file_bytes, "video/mp4")}
                data = {"model": self.DEFAULT_MODEL}
                resp = await client.post(
                    f"{self.api_base}/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    files=files,
                    data=data,
                )
            if resp.status_code != 200:
                logger.warning(
                    f"SF transcribe HTTP {resp.status_code}: {resp.text[:200]}"
                )
                return None
            j = resp.json()
            text = (j.get("text") or "").strip()
            if not text:
                logger.warning(f"SF transcribe returned empty text: {j}")
                return None
            logger.info(f"SF transcribe OK: {len(text)} chars")
            return text
        except Exception as e:
            logger.exception(f"SF transcribe call error: {e}")
            return None


transcription_service = TranscriptionService()
