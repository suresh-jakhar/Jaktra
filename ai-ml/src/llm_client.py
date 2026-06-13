import time
import litellm
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from dataclasses import dataclass
from src.exceptions import LLMGenerationError
from api.config import settings

@dataclass
class LLMResponse:
    content: str
    model: str
    provider: str
    prompt_tokens: int
    completion_tokens: int
    generation_ms: float
    used_fallback: bool

_RETRYABLE_LITELLM_ERRORS = (
    litellm.exceptions.RateLimitError,
    litellm.exceptions.APIConnectionError,
    litellm.exceptions.InternalServerError,
    litellm.exceptions.ServiceUnavailableError,
)

class LLMClient:
    def __init__(self):
        self.primary = {
            "model": f"{settings.LLM_PROVIDER}/{settings.LLM_MODEL}",
            "api_key": settings.LLM_API_KEY,
        }
        self.fallback = None
        if getattr(settings, "LLM_FALLBACK_PROVIDER", None) and getattr(settings, "LLM_FALLBACK_MODEL", None):
            self.fallback = {
                "model": f"{settings.LLM_FALLBACK_PROVIDER}/{settings.LLM_FALLBACK_MODEL}",
                "api_key": getattr(settings, "LLM_FALLBACK_API_KEY", None),
            }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=8),
        retry=retry_if_exception_type(_RETRYABLE_LITELLM_ERRORS),
        reraise=True
    )
    async def _invoke_with_retry(self, messages, provider_config, temperature):
        start_time = time.perf_counter()
        response = await litellm.acompletion(
            messages=messages,
            temperature=temperature,
            **provider_config
        )
        duration_ms = (time.perf_counter() - start_time) * 1000
        return response, duration_ms

    async def generate(self, messages: list, temperature: float = 0.4) -> LLMResponse:
        litellm_messages = []
        for msg in messages:
            role = "user"
            msg_type = getattr(msg, "type", "")
            if msg_type == "system":
                role = "system"
            litellm_messages.append({"role": role, "content": getattr(msg, "content", str(msg))})

        try:
            response, duration_ms = await self._invoke_with_retry(litellm_messages, self.primary, temperature)
            used_fallback = False
            provider_used = self.primary["model"].split("/")[0]
        except Exception as primary_error:
            if isinstance(primary_error, litellm.exceptions.BadRequestError):
                raise LLMGenerationError(f"Bad Request: {primary_error}") from primary_error

            if self.fallback:
                try:
                    response, duration_ms = await self._invoke_with_retry(litellm_messages, self.fallback, temperature)
                    used_fallback = True
                    provider_used = self.fallback["model"].split("/")[0]
                except Exception as fallback_error:
                    raise LLMGenerationError(f"Primary and fallback failed. Fallback error: {fallback_error}") from fallback_error
            else:
                raise LLMGenerationError(f"Primary failed and no fallback configured: {primary_error}") from primary_error

        prompt_tokens = 0
        completion_tokens = 0
        if hasattr(response, "usage") and response.usage:
            prompt_tokens = getattr(response.usage, "prompt_tokens", 0)
            completion_tokens = getattr(response.usage, "completion_tokens", 0)

        return LLMResponse(
            content=response.choices[0].message.content,
            model=response.model,
            provider=provider_used,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            generation_ms=duration_ms,
            used_fallback=used_fallback
        )

llm_client = LLMClient()
