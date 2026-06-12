import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR: Path = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env")

GROQ_API_KEY: str = os.getenv("GROQ_API_KEY") or os.getenv("LLM_API_KEY", "")
LLM_MODEL: str = os.getenv("LLM_MODEL", "llama-3.1-8b-instant")

SERVICE_HOST: str = os.getenv("SERVICE_HOST", "0.0.0.0")
SERVICE_PORT: int = int(os.getenv("SERVICE_PORT", "8000"))
SERVICE_KEY: str = os.getenv("SERVICE_KEY", "default-key")
