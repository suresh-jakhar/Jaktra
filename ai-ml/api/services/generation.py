import json
import groq
from langchain_groq import ChatGroq
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from api.config import settings as config
from src.security import sanitize_input
from api.services.output_parser import _parse_email_output
from prompts.email_prompt import get_prompt_for_tier
from api.logging import logger
import time

def _get_llm() -> ChatGroq:
    """Return a ChatGroq instance configured from api.config."""
    return ChatGroq(
        model=config.LLM_MODEL,
        api_key=config.LLM_API_KEY,
        temperature=0.4,
    )

_RETRYABLE_GROQ_ERRORS = (
    groq.RateLimitError,
    groq.APIConnectionError,
    groq.InternalServerError,
)

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=8),
    retry=retry_if_exception_type(_RETRYABLE_GROQ_ERRORS),
    reraise=True,
)
def _invoke_llm_with_retry(llm, messages):
    """Call the LLM with up to 3 retries on transient Groq errors."""
    return llm.invoke(messages)

def generate_followup_content(invoice_data: dict) -> dict:
    """
    Core logic extracted from the legacy generate_followup_email tool.
    Selects the prompt based on urgency tier, formats with invoice data, 
    and invokes the LLM.
    """
    invoice_no = invoice_data.get("invoice_no", "UNKNOWN")
    urgency_tier = invoice_data.get("urgency_tier", "first_followup")
    
    prompt = get_prompt_for_tier(urgency_tier)

    sender_name = getattr(config, "SMTP_SENDER_NAME", "Finance Department")
    payment_link = invoice_data.get("payment_link") or getattr(config, "PAYMENT_LINK", "")
    bank_details = getattr(config, "BANK_DETAILS", "")

    messages = prompt.format_messages(
        client_name=sanitize_input(invoice_data.get("client_name", "")),
        invoice_no=sanitize_input(invoice_no),
        invoice_amount=sanitize_input(str(invoice_data.get("invoice_amount", ""))),
        due_date=sanitize_input(str(invoice_data.get("due_date", ""))[:10]),
        days_overdue=invoice_data.get("days_overdue", 0),
        followup_count=invoice_data.get("followup_count", 0),
        sender_name=sender_name,
        payment_link=payment_link,
        bank_details=bank_details,
        format_instruction=(
            "\nRespond with ONLY the email in this exact format — no extra commentary:\n"
            "\nSubject: <subject line>\n\nBody:\n<email body>"
        ),
    )

    llm = _get_llm()
    start_time = time.perf_counter()
    try:
        response = _invoke_llm_with_retry(llm, messages)
    except groq.GroqError as exc:
        return {
            "status": "error",
            "invoice_no": invoice_no,
            "reason": f"LLM generation failed: {exc}",
        }
    
    generation_ms = (time.perf_counter() - start_time) * 1000
    raw_text: str = response.content.strip()
    
    token_count = 0
    if hasattr(response, "response_metadata") and "token_usage" in response.response_metadata:
        token_count = response.response_metadata["token_usage"].get("total_tokens", 0)

    subject, body = _parse_email_output(raw_text)

    logger.info(
        "generation_complete",
        invoice_id=invoice_no,
        tier=urgency_tier,
        channel="email",
        model=config.LLM_MODEL,
        provider=config.LLM_PROVIDER,
        generation_ms=round(generation_ms, 2),
        token_count=token_count
    )

    return {
        "invoice_no": invoice_no,
        "subject": subject,
        "body": body,
        "metadata": {
            "tier_used": urgency_tier,
            "model": config.LLM_MODEL,
            "generation_ms": round(generation_ms, 2),
            "token_count": token_count
        }
    }
