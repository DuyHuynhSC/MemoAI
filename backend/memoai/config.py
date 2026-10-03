import os
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Gemini
    gemini_api_key: str | None = Field(default=None, alias="GEMINI_API_KEY")
    gemini_asr_model: str = "gemini-2.5-flash"
    gemini_mt_model: str = "gemini-2.5-flash"

    # OpenAI-compatible / Local server (e.g. Qwen, Ollama, LM Studio, vLLM)
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    openai_base_url: str | None = Field(default=None, alias="OPENAI_BASE_URL")
    openai_asr_model: str = "whisper-1"
    openai_mt_model: str = "qwen2.5:latest"

    # Default App Storage
    app_data_dir: Path = Path.home() / ".memoai"

    def get_data_dir(self) -> Path:
        self.app_data_dir.mkdir(parents=True, exist_ok=True)
        return self.app_data_dir


settings = Settings()
