import time
from api.config import settings as config
from src.security import sanitize_input, validate_email_output
from api.logging import logger
from src.prompt_registry import registry, TierNotAutomatableError
from src.llm_client import llm_client
from src.exceptions import LLMGenerationError


def _build_cta_instruction(payment_link: str, bank_details: str) -> str:
    """
    Build a CTA instruction only from what is actually available.
    Prevents the LLM from hallucinating payment methods when none are configured.
    """
    parts = []
    if payment_link:
        parts.append(f"They can pay online at: {payment_link}")
    if bank_details:
        parts.append(f"Bank transfer details: {bank_details}")

    if not parts:
        return (
            "Note: No online payment link or bank details are available at this time. "
            "Ask them to contact us by reply email to arrange payment."
        )
    return "CTA: Provide the following payment options:\n" + "\n".join(f"- {p}" for p in parts)


def _plain_to_html(plain_body: str, sender_name: str) -> str:
    """Convert LLM plain-text to a styled HTML email."""
    paragraphs = [p.strip() for p in plain_body.split("\n\n") if p.strip()]
    html_paragraphs = "\n".join(
        f'    <p style="margin: 0 0 16px 0; color: #374151; line-height: 1.6;">{para.replace(chr(10), "<br>")}</p>'
        for para in paragraphs
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Reminder</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color: #1e3a5f; padding: 28px 40px;">
              <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 600; letter-spacing: -0.3px;">Payment Reminder</p>
            </td>
          </tr>
          <tr>
            <td style="padding: 36px 40px 24px 40px;">
{html_paragraphs}
            </td>
          </tr>
          <tr>
            <td style="background-color: #f3f4f6; padding: 20px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                This is an automated payment reminder. Please do not reply to this email if you have already settled this invoice.
                If you have any questions, contact {sender_name} directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


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
    payment_link = invoice_data.get("payment_link") or ""
    bank_details = getattr(config, "BANK_DETAILS", "") or ""

    cta_instruction = _build_cta_instruction(payment_link, bank_details)

    messages = prompt.format_messages(
        client_name=sanitize_input(invoice_data.get("client_name", "")),
        invoice_no=sanitize_input(invoice_no),
        invoice_amount=sanitize_input(str(invoice_data.get("invoice_amount", ""))),
        due_date=sanitize_input(str(invoice_data.get("due_date", ""))[:10]),
        days_overdue=invoice_data.get("days_overdue", 0),
        followup_count=invoice_data.get("followup_count", 0),
        sender_name=sender_name,
        cta_instruction=cta_instruction,
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

    html_body = _plain_to_html(body, sender_name)

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
        "html_body": html_body,
        "metadata": {
            "tier_used": urgency_tier,
            "model": response.model,
            "generation_ms": round(response.generation_ms, 2),
            "token_count": response.completion_tokens + response.prompt_tokens
        }
    }
