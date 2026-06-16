"""Runtime configuration loaded from environment / .env."""
from __future__ import annotations

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    openai_api_key: str = ""
    openai_model: str = "gpt-5.2"
    # Reasoning effort for GPT-5 / o-series models: none | low | medium | high | xhigh.
    # "low" keeps the tool-routing assistant fast; ignored for non-reasoning models.
    openai_reasoning_effort: str = "low"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    data_seed: int = 20260615
    # "db" uses the real RWD SQLite warehouse; "synthetic" forces the generator.
    # "auto" (default) picks db when alfadev.db exists, else synthetic.
    data_source: str = "auto"

    @field_validator("openai_api_key", mode="before")
    @classmethod
    def _clean_api_key(cls, v: object) -> str:
        """Tolerate common .env paste mistakes: surrounding quotes/whitespace and a
        leading 'OPENAI_API_KEY=' accidentally included in the value (which would
        otherwise be sent to OpenAI verbatim and 401)."""
        s = str(v or "").strip().strip('"').strip("'").strip()
        if s.upper().startswith("OPENAI_API_KEY="):
            s = s.split("=", 1)[1].strip()
        return s

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openai_api_key.strip())

    @property
    def is_reasoning_model(self) -> bool:
        """GPT-5 family + o-series are reasoning models: they take reasoning_effort
        and reject the temperature parameter when reasoning is active."""
        m = self.openai_model.lower()
        return m.startswith(("gpt-5", "o1", "o3", "o4"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
