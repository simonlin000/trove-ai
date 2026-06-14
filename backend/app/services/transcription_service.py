"""Audio/video transcription via SiliconFlow SenseVoice or local faster-whisper.

Prefers SiliconFlow when SILICONFLOW_API_KEY is set.
Falls back to local faster-whisper (tiny model) otherwise.
"""
import logging
import os
import tempfile
from pathlib import Path
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# Lazy-loaded local whisper model
_whisper_model = None
_whisper_model_name = None
_whisper_preload_done = False

def _get_whisper_model(model_name: str = "tiny"):
    global _whisper_model, _whisper_model_name
    if _whisper_model is None or _whisper_model_name != model_name:
        from faster_whisper import WhisperModel
        # Use Chinese mirror — Docker container can't reach huggingface.co
        os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
        logger.info(f"whisper: downloading/loading model '{model_name}' (first time, ~1GB)...")
        _whisper_model = WhisperModel(model_name, device="cpu", compute_type="int8")
        _whisper_model_name = model_name
        logger.info(f"whisper model loaded: {model_name}")
    return _whisper_model

def preload_whisper():
    """Preload whisper model at startup so first request doesn't timeout."""
    global _whisper_preload_done
    if _whisper_preload_done:
        return
    _whisper_preload_done = True
    try:
        _get_whisper_model("tiny")
        logger.info("whisper preload complete")
    except Exception as e:
        logger.warning(f"whisper preload failed (will retry on first use): {e}")


class TranscriptionService:
    DEFAULT_MODEL = "FunAudioLLM/SenseVoiceSmall"
    WHISPER_MODEL = "tiny"  # small, fast, works for Chinese
    MAX_FILE_SIZE_MB = 300  # enough for long videos (4h at 80kbps ≈ 144MB)
    DOWNLOAD_TIMEOUT_S = 180
    TRANSCRIBE_TIMEOUT_S = 300

    def __init__(self):
        from app.config_manager import get_effective_config
        cfg = get_effective_config("embedding")  # same SF account
        self.api_key = cfg.get("api_key", "") or os.getenv("SILICONFLOW_API_KEY", "")
        self.api_base = (cfg.get("api_base") or "https://api.siliconflow.cn/v1").rstrip("/")

    @property
    def available(self) -> bool:
        # Always available: either SF API or local whisper
        return True

    async def transcribe_url(
        self,
        video_url: str,
        referer: Optional[str] = None,
    ) -> Optional[str]:
        """Download a video/audio URL, transcribe, return text.

        Returns None on any failure (download too large, SF error, whisper error).
        Callers should treat None as "transcription unavailable, skip" and
        proceed with existing content.
        """
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
        # Prefer SiliconFlow if key is set
        if self.api_key:
            return await self._transcribe_siliconflow(path)
        # Fallback to local faster-whisper
        return await self._transcribe_whisper(path)

    async def _transcribe_siliconflow(self, path: Path) -> Optional[str]:
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

    async def _transcribe_whisper(self, path: Path) -> Optional[str]:
        """Transcribe using local faster-whisper (runs in thread pool)."""
        import asyncio
        path = Path(path)  # ensure Path object
        try:
            logger.info(f"whisper: starting transcription for {path.name}")
            model = _get_whisper_model(self.WHISPER_MODEL)
            loop = asyncio.get_running_loop()
            segments, info = await loop.run_in_executor(
                None, lambda: list(model.transcribe(str(path), language="zh", beam_size=5))
            )
            text = " ".join(s.text.strip() for s in segments if s.text.strip())
            if text:
                logger.info(f"whisper OK: {len(text)} chars, lang={info.language}")
                return text
            logger.warning("whisper returned empty text")
            return None
        except Exception as e:
            logger.exception(f"whisper transcribe error: {e}")
            return None


transcription_service = TranscriptionService()
