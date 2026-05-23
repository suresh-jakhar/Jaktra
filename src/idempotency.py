import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

logger = logging.getLogger("IDEMPOTENCY")


def is_recently_sent(
    invoice_id: str,
    audit_log_path: str,
    window_hours: int = 20,
) -> bool:

    cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=window_hours)
    report_dir = Path(audit_log_path)

    if not report_dir.is_dir():
        return False

    for report_file in sorted(report_dir.glob("run_report_*.json"), reverse=True):
        try:
            data = json.loads(report_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            logger.warning("Skipping unreadable report: %s", report_file)
            continue

        log_entries = data.get("log", [])
        for entry in log_entries:
            if (
                entry.get("invoice_no") == invoice_id
                and entry.get("action") == "email_sent"
                and entry.get("result") in ("sent", "dry_run")
            ):
                try:
                    entry_time = datetime.fromisoformat(entry["timestamp"])
                except (KeyError, ValueError):
                    continue

                if entry_time >= cutoff:
                    return True


        if log_entries:
            try:
                first_ts = datetime.fromisoformat(log_entries[0]["timestamp"])
                if first_ts < cutoff:
                    break
            except (KeyError, ValueError):
                pass

    return False


def get_last_send_time(
    invoice_id: str,
    audit_log_path: str,
    window_hours: int = 20,
) -> str | None:

    cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=window_hours)
    report_dir = Path(audit_log_path)

    if not report_dir.is_dir():
        return None

    for report_file in sorted(report_dir.glob("run_report_*.json"), reverse=True):
        try:
            data = json.loads(report_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            continue

        for entry in data.get("log", []):
            if (
                entry.get("invoice_no") == invoice_id
                and entry.get("action") == "email_sent"
                and entry.get("result") in ("sent", "dry_run")
            ):
                try:
                    entry_time = datetime.fromisoformat(entry["timestamp"])
                except (KeyError, ValueError):
                    continue

                if entry_time >= cutoff:
                    return entry["timestamp"]

    return None
