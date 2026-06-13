import time
from api.config import settings as config
from src.security import sanitize_input, validate_email_output
from api.logging import logger
from src.prompt_registry import registry, TierNotAutomatableError
from src.llm_client import llm_client
from src.exceptions import LLMGenerationError

async def generate_followup_content(invoice_data: dict) -> dict:
    """
    Core logic extracted from the legacy generate_followup_email tool.
    Selects the prompt based on urgency tier, formats with invoice data, 
    and invokes the LLM using the multi-provider litellm client.
    """
    invoice_no = invoice_data.get("invoice_no", "UNKNOWN")
    urgency_tier = invoice_data.get("urgency_tier", "first_followup")
    channel = invoice_data.get("channel", "email")
    
    try:
        prompt = registry.get_prompt(channel, urgency_tier)
    except TierNotAutomatableError:
        raise ValueError(f"{urgency_tier} does not have an automated email prompt.")
    except Exception as e:
        raise ValueError(str(e))

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

    try:
        response = await llm_client.generate(messages, temperature=config.LLM_TEMPERATURE)
    except LLMGenerationError as exc:
        return {
            "status": "error",
            "invoice_no": invoice_no,
            "reason": str(exc),
        }
    
    raw_text: str = response.content.strip()
    subject, body = validate_email_output(raw_text)

    logger.info(
        "generation_complete",
        invoice_id=invoice_no,
        tier=urgency_tier,
        channel=channel,
        model=response.model,
        provider=response.provider,
        generation_ms=round(response.generation_ms, 2),
        token_count=response.completion_tokens + response.prompt_tokens,
        used_fallback=response.used_fallback
    )

    return {
        "invoice_no": invoice_no,
        "subject": subject,
        "body": body,
        "metadata": {
            "tier_used": urgency_tier,
            "model": response.model,
            "generation_ms": round(response.generation_ms, 2),
            "token_count": response.completion_tokens + response.prompt_tokens
        }
    }
