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

    # Proxy & Custom CA
    proxy_enabled: bool = Field(default=False, alias="PROXY_ENABLED")
    http_proxy: str | None = Field(default=None, alias="HTTP_PROXY")
    https_proxy: str | None = Field(default=None, alias="HTTPS_PROXY")
    no_proxy: str = Field(default="localhost,127.0.0.1", alias="NO_PROXY")
    ca_cert_path: str | None = Field(default=None, alias="CA_CERT_PATH")
    ssl_cert_file: str | None = Field(default=None, alias="SSL_CERT_FILE")
    requests_ca_bundle: str | None = Field(default=None, alias="REQUESTS_CA_BUNDLE")
    insecure_skip_verify: bool = Field(default=False, alias="INSECURE_SKIP_VERIFY")

    # Default App Storage
    app_data_dir: Path = Path.home() / ".memoai"

    def get_data_dir(self) -> Path:
        self.app_data_dir.mkdir(parents=True, exist_ok=True)
        return self.app_data_dir

    def get_certs_dir(self) -> Path:
        certs_dir = self.get_data_dir() / "certs"
        certs_dir.mkdir(parents=True, exist_ok=True)
        return certs_dir


settings = Settings()

