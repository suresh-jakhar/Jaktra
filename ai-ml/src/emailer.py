import smtplib
from dataclasses import dataclass
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid

from src import config
from src.exceptions import HaltViolationError


@dataclass(frozen=True, slots=True)
class SendResult:
    """Typed result from send_email(); success must be checked before updating the ledger."""

    success: bool
    error: str | None
    status: str          # "sent" | "error"
    to: str
    timestamp: str


def send_email(to: str, subject: str, body: str, urgency_tier: str | None = None) -> SendResult:
    """
    Send a plain-text email.

    Args:
        to:           Recipient email address.
        subject:      Email subject line.
        body:         Plain-text email body.
        urgency_tier: Optional urgency tier from triage. If ``"legal_escalation"``
                      (Stage 5), a :class:`HaltViolationError` is raised as a
                      belt-and-suspenders safety check.

    Returns:
        SendResult with an explicit ``success`` flag that callers MUST check
        before updating followup_count or email_sent in the ledger.

    Raises:
        HaltViolationError: If urgency_tier is ``"legal_escalation"``.
    """
    # Belt-and-suspenders: never email a Stage 5 invoice
    if urgency_tier == "legal_escalation":
        raise HaltViolationError(
            f"Attempted to email a Stage 5 (legal_escalation) invoice to {to}. "
            f"Subject: {subject[:80]}. This is a safety violation."
        )

    timestamp = datetime.now(tz=timezone.utc).isoformat()


    # Build the MIME message
    msg = MIMEText(body, "plain")
    msg["Subject"] = subject
    msg["From"] = f"{config.SMTP_SENDER_NAME} <{config.SMTP_USER}>"
    msg["To"] = to
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid()
    msg["Reply-To"] = config.SMTP_USER

    try:
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
            server.sendmail(config.SMTP_USER, [to], msg.as_string())

        return SendResult(
            success=True,
            error=None,
            status="sent",
            to=to,
            timestamp=timestamp,
        )

    except Exception as exc:
        return SendResult(
            success=False,
            error=str(exc),
            status="error",
            to=to,
            timestamp=timestamp,
        )
