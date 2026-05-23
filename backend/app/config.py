from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Trove AI"
    debug: bool = True

    # Database — override via DATABASE_URL env in docker-compose (set from .env)
    database_url: str = "postgresql+asyncpg://trove:trove@localhost:5432/trove"
    database_url_sync: str = "postgresql://trove:trove@localhost:5432/trove"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # NOTE: LLM and embedding API config is NOT here. It's loaded dynamically
    # from `backend/app/config_store.json` (managed via web UI: Settings →
    # AI 对话模型 / 嵌入模型). Env vars like OPENAI_API_KEY / MINIMAX_API_KEY
    # only act as fallbacks when nothing is configured in the store.

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
