from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # Service
    SERVICE_HOST: str = "0.0.0.0"
    SERVICE_PORT: int = 8000
    SERVICE_KEY: str = Field(alias="SERVICE_KEY", default="suresh-service-key-9876")
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # "json" or "text"

    # LLM — Primary
    LLM_PROVIDER: str = "groq"
    LLM_MODEL: str = "llama-3.1-8b-instant"
    LLM_API_KEY: str  # required
    LLM_TEMPERATURE: float = 0.4
    LLM_MAX_TOKENS: int = 1024
    LLM_TIMEOUT_SECONDS: int = 30

    # LLM — Fallback (optional)
    LLM_FALLBACK_PROVIDER: str | None = None
    LLM_FALLBACK_MODEL: str | None = None
    LLM_FALLBACK_API_KEY: str | None = None

    # Risk Scoring
    RISK_MODEL_PATH: str = "models/risk_scorer.joblib"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
