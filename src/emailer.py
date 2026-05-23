import smtplib
from dataclasses import dataclass
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid

from src import config


@dataclass(frozen=True, slots=True)
class SendResult:
    """Typed result from send_email(); success must be checked before updating the ledger."""

    success: bool
    error: str | None
    status: str          # "sent" | "dry_run" | "error"
    to: str
    timestamp: str
    body_preview: str = ""  # populated only for dry_run


def send_email(to: str, subject: str, body: str) -> SendResult:
    """
    Send a plain-text email, or simulate the send in dry-run mode.

    Args:
        to:      Recipient email address.
        subject: Email subject line.
        body:    Plain-text email body.

    Returns:
        SendResult with an explicit ``success`` flag that callers MUST check
        before updating followup_count or email_sent in the ledger.
    """
    timestamp = datetime.now(tz=timezone.utc).isoformat()

    if config.DRY_RUN:
        print(f"[DRY RUN] to={to} | subject={subject[:80]}")
        return SendResult(
            success=True,
            error=None,
            status="dry_run",
            to=to,
            timestamp=timestamp,
            body_preview=body[:200],
        )

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
