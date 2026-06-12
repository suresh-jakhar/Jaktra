import json
import logging
from pathlib import Path

from src.data_loader import load_invoices, save_invoices

log = logging.getLogger("RECONCILER")


def _count_successful_sends(audit_log_path: str) -> dict[str, int]:

    counts: dict[str, int] = {}
    report_dir = Path(audit_log_path)

    if not report_dir.is_dir():
        return counts

    for report_file in report_dir.glob("run_report_*.json"):
        try:
            data = json.loads(report_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            log.warning("Skipping unreadable report: %s", report_file)
            continue

        for entry in data.get("log", []):
            if (
                entry.get("action") == "email_sent"
                and entry.get("result") in ("sent", "dry_run")
            ):
                inv = entry.get("invoice_no", "")
                if inv and inv != "SYSTEM":
                    counts[inv] = counts.get(inv, 0) + 1

    return counts


def reconcile_followup_counts(
    csv_path: str,
    audit_log_path: str,
    auto_correct: bool = True,
) -> dict:

    df = load_invoices(csv_path)
    audit_counts = _count_successful_sends(audit_log_path)

    mismatches: list[dict] = []

    for _, row in df.iterrows():
        inv_no = row["invoice_no"]
        csv_count = int(row["followup_count"])
        audit_count = audit_counts.get(inv_no, 0)

        if csv_count != audit_count:
            mismatches.append({
                "invoice_no": inv_no,
                "csv_count": csv_count,
                "audit_count": audit_count,
            })

    if auto_correct and mismatches:
        for m in mismatches:
            mask = df["invoice_no"] == m["invoice_no"]
            df.loc[mask, "followup_count"] = m["audit_count"]
        save_invoices(df, csv_path)

    return {
        "total_checked": len(df),
        "mismatches_found": len(mismatches),
        "corrections": mismatches,
    }
