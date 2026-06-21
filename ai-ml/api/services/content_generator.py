from pydantic import BaseModel
from typing import Optional
from src.prompt_registry import PromptRegistry, TierNotAutomatableError, UnknownPromptError
from src.llm_client import LLMClient
from src.security import sanitize_input, validate_email_output, validate_sms_output, validate_whatsapp_output
from src.exceptions import LLMGenerationError
from api.config import settings
from api.logging import logger


class GenerationResult(BaseModel):
    subject: Optional[str] = None
    html_body: Optional[str] = None
    plain_body: Optional[str] = None
    metadata: dict


def _build_cta_instruction(payment_link: str, bank_details: str) -> str:
    """
    Build the CTA portion of the prompt only from what is actually available.
    If neither is provided, return an empty string so the LLM does not
    invent payment methods or account details.
    """
    parts = []
    if payment_link:
        parts.append(f"They can pay online at: {payment_link}")
    if bank_details:
        parts.append(f"Bank transfer details: {bank_details}")

    if not parts:
        # No payment info at all — tell the LLM explicitly
        return (
            "Note: No online payment link or bank details are available at this time. "
            "Ask them to contact us by reply email to arrange payment."
        )
    return "CTA: Provide the following payment options:\n" + "\n".join(f"- {p}" for p in parts)


def _plain_to_html(plain_body: str, sender_name: str) -> str:
    """
    Convert the LLM plain-text output into a well-structured, styled HTML email.
    Each blank-line-separated paragraph becomes its own <p> block.
    """
    # Split into paragraphs on blank lines
    paragraphs = [p.strip() for p in plain_body.split("\n\n") if p.strip()]

    # Build styled HTML
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

          <!-- Header -->
          <tr>
            <td style="background-color: #1e3a5f; padding: 28px 40px;">
              <p style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 600; letter-spacing: -0.3px;">
                Payment Reminder
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 36px 40px 24px 40px;">
{html_paragraphs}
            </td>
          </tr>

          <!-- Footer -->
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


class ContentGenerator:
    def __init__(self, prompt_registry: PromptRegistry, llm_client: LLMClient):
        self.prompts = prompt_registry
        self.llm = llm_client

    async def generate(self, request) -> GenerationResult:
        if request.channel not in ["email", "sms", "whatsapp"]:
            raise ValueError(f"UNSUPPORTED_CHANNEL: {request.channel}")

        try:
            prompt = self.prompts.get_prompt(request.channel, request.urgency_tier)
        except TierNotAutomatableError:
            raise ValueError(f"{request.urgency_tier} does not have an automated prompt.")
        except UnknownPromptError as e:
            raise ValueError(str(e))

        sender_name = getattr(settings, "SMTP_SENDER_NAME", "Finance Department")
        payment_link = getattr(request, "payment_link", None) or ""
        bank_details = getattr(request, "bank_details", None) or getattr(settings, "BANK_DETAILS", "") or ""

        # Build a conditional CTA — never pass empty strings to the prompt
        cta_instruction = _build_cta_instruction(payment_link, bank_details)

        # Build subject context — only include if the invoice has a description
        raw_subject = getattr(request, "invoice_subject", None)
        if raw_subject and str(raw_subject).strip():
            subject_context = f"- Invoice Description: {str(raw_subject).strip()}"
        else:
            subject_context = ""

        messages = prompt.format_messages(
            client_name=sanitize_input(getattr(request, "client_name", "")),
            invoice_no=sanitize_input(getattr(request, "invoice_no", "")),
            invoice_amount=sanitize_input(str(getattr(request, "invoice_amount", ""))),
            due_date=sanitize_input(str(getattr(request, "due_date", ""))[:10]),
            days_overdue=getattr(request, "days_overdue", 0),
            followup_count=getattr(request, "followup_count", 0),
            sender_name=sender_name,
            cta_instruction=cta_instruction,
            subject_context=subject_context,
        )

        llm_response = await self.llm.generate(messages, temperature=settings.LLM_TEMPERATURE)

        metadata = {
            "tier_used": request.urgency_tier,
            "model": llm_response.model,
            "generation_ms": round(llm_response.generation_ms, 2),
            "token_count": llm_response.completion_tokens + llm_response.prompt_tokens
        }

        logger.info(
            "generation_complete",
            invoice_id=request.invoice_id,
            tier=request.urgency_tier,
            channel=request.channel,
            model=llm_response.model,
            provider=llm_response.provider,
            generation_ms=round(llm_response.generation_ms, 2),
            token_count=llm_response.completion_tokens + llm_response.prompt_tokens,
            used_fallback=llm_response.used_fallback
        )

        if request.channel == "email":
            subject, body = validate_email_output(llm_response.content)
            html_body = _plain_to_html(body, sender_name)
            return GenerationResult(subject=subject, html_body=html_body, plain_body=body, metadata=metadata)
        elif request.channel == "sms":
            body = validate_sms_output(llm_response.content)
            return GenerationResult(subject=None, plain_body=body, metadata=metadata)
        elif request.channel == "whatsapp":
            body = validate_whatsapp_output(llm_response.content)
            return GenerationResult(subject=None, plain_body=body, metadata=metadata)
