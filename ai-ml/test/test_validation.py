"""
test_validation.py  -  Step 10: Testing & Validation

Unified validation script covering all 7 checks from the implementation plan:
  1. data_loader   - dtypes + live days_overdue recalculation
  2. triage        - edge-case tier assignment
  3. emailer       - dry-run mode dict
  4. tools         - each tool called individually
  5. agent (e2e)   - real Groq LLM call for 5 invoices, full tool chain
  6. run_report    - JSON file written to outputs/
  7. CSV update    - followup_count + last_followup_date persisted

Run with:  python test_validation.py
"""

import json
import os
import shutil
import tempfile
from datetime import date

import pandas as pd

# ---- helpers ----------------------------------------------------------------

_PASS = 0
_FAIL = 0

def ok(msg: str) -> None:
    global _PASS
    _PASS += 1
    print(f"    PASS  {msg}")

def fail(msg: str) -> None:
    global _FAIL
    _FAIL += 1
    print(f"    FAIL  {msg}")

def check(condition: bool, pass_msg: str, fail_msg: str) -> None:
    if condition:
        ok(pass_msg)
    else:
        fail(fail_msg)

def section(n: int, title: str) -> None:
    print(f"\n[{n}] {title}")


# =============================================================================
# Test 1 - data_loader.py
# =============================================================================
print("=" * 62)
print("  STEP 10 - TESTING & VALIDATION")
print("=" * 62)

section(1, "data_loader - dtypes + live days_overdue recalculation")

from src.config import DATA_PATH, GROQ_API_KEY
import src.config as cfg
from src.data_loader import load_invoices, save_invoices

df = load_invoices(DATA_PATH)

check(len(df) == 9,
      f"Loaded {len(df)} rows",
      f"Expected 9 rows, got {len(df)}")

check(str(df["due_date"].dtype).startswith("datetime64"),
      f"due_date is datetime64 ({df['due_date'].dtype})",
      f"due_date wrong dtype: {df['due_date'].dtype}")

check(str(df["last_followup_date"].dtype).startswith("datetime64"),
      f"last_followup_date is datetime64 ({df['last_followup_date'].dtype})",
      f"last_followup_date wrong dtype: {df['last_followup_date'].dtype}")

check(str(df["invoice_amount"].dtype).startswith("float"),
      f"invoice_amount is float ({df['invoice_amount'].dtype})",
      f"invoice_amount wrong dtype: {df['invoice_amount'].dtype}")

check(str(df["followup_count"].dtype).startswith("int"),
      f"followup_count is int ({df['followup_count'].dtype})",
      f"followup_count wrong dtype: {df['followup_count'].dtype}")

# Verify days_overdue is live (recalculated from today, not stale CSV value)
today_ts = pd.Timestamp(date.today())
for i in range(min(5, len(df))):
    row = df.iloc[i]
    expected = max(int((today_ts - row["due_date"]).days), 0)
    actual = int(row["days_overdue"])
    if expected != actual:
        fail(f"Row {i}: days_overdue stale (got {actual}, expected {expected})")
        break
else:
    ok("days_overdue dynamically recalculated for first 5 rows")


# =============================================================================
# Test 2 - triage.py - edge-case tier assignment
# =============================================================================
section(2, "triage - edge-case tier assignment")

from src.triage import (
    triage_invoices,
    _assign_tier,
    TIER_WARM,
    TIER_FIRM,
    TIER_SERIOUS,
    TIER_STERN,
    TIER_LEGAL
)

cases = [
    # (days_overdue, followup_count, expected_tier, label)
    (0,  0, TIER_WARM,            "days=0,  fc=0  -> warm"),
    (5,  1, TIER_WARM,            "days=5,  fc=1  -> warm"),
    (15, 0, TIER_SERIOUS,         "days=15, fc=0  -> serious"),
    (16, 0, TIER_SERIOUS,         "days=16, fc=0  -> serious"),
    (30, 0, TIER_STERN,           "days=30, fc=0  -> stern"),
    (0,  2, TIER_WARM,            "days=0,  fc=2  -> warm"),
    (31, 0, TIER_LEGAL,           "days=31, fc=0  -> legal"),
    (60, 0, TIER_LEGAL,           "days=60, fc=0  -> legal"),
    (0,  4, TIER_WARM,            "days=0,  fc=4  -> warm"),
    (61, 0, TIER_LEGAL,           "days=61, fc=0  -> legal"),
    (0,  5, TIER_WARM,            "days=0,  fc=5  -> warm"),
    (90, 5, TIER_LEGAL,           "days=90, fc=5  -> legal"),
]

for days, fc, expected, label in cases:
    row = pd.Series({"days_overdue": days, "followup_count": fc})
    got = _assign_tier(row)
    check(got == expected, label, f"{label} [got '{got}']")

triaged = triage_invoices(df)
check(len(triaged) > 0,
      f"triage_invoices: {len(triaged)} actionable invoices returned",
      "triage_invoices returned empty DataFrame")
check("urgency_tier" in triaged.columns,
      "urgency_tier column present",
      "urgency_tier column missing")
check((triaged["payment_status"] == "Paid").sum() == 0,
      "All Paid invoices excluded",
      "Paid invoices found in triaged result")
check(triaged["days_overdue"].iloc[0] >= triaged["days_overdue"].iloc[-1],
      "Sorted by days_overdue descending",
      "Sort order wrong")


# =============================================================================
# Test 3 - emailer.py - dry-run mode dict
# =============================================================================
section(3, "emailer - dry-run mode, correct response dict")

from src import emailer

result = emailer.send_email("test@example.com", "Test Subject", "Test body content.")
check(result.status == "dry_run",         "status == 'dry_run'",         f"status was '{result.status}'")
check(result.to == "test@example.com",    "'to' key correct",            f"to was '{result.to}'")
check(hasattr(result, "timestamp"),       "'timestamp' attribute present",     "'timestamp' missing")

r2 = emailer.send_email("a@b.com", "S", "X" * 300)
check(r2.status == "dry_run", "r2 status is dry_run", f"status was '{r2.status}'")

# SMTP exception safety (live mode)
from unittest.mock import patch, MagicMock
orig_dry = cfg.DRY_RUN
cfg.DRY_RUN = False
with patch("smtplib.SMTP") as mock_smtp:
    ms = MagicMock()
    mock_smtp.return_value.__enter__ = MagicMock(return_value=ms)
    mock_smtp.return_value.__exit__ = MagicMock(return_value=False)
    ms.login.side_effect = Exception("SMTP auth failed")
    err = emailer.send_email("x@y.com", "S", "B")
cfg.DRY_RUN = orig_dry
check(err.status == "error", "SMTP error caught -> status='error'", f"status was '{err.status}'")
check(hasattr(err, "error"), "error object has 'error' property", "'error' property missing")


# =============================================================================
# Test 4 - tools.py - each tool called individually
# =============================================================================
section(4, "tools - each tool called and inspected")

from src.tools import (
    ALL_TOOLS, get_pending_invoices, get_invoice_details,
    send_email as tool_send_email, update_invoice_record, generate_run_report,
)
import src.logger as logger
logger.reset()

check(len(ALL_TOOLS) >= 6,
      f"ALL_TOOLS has {len(ALL_TOOLS)} tools: {[t.name for t in ALL_TOOLS]}",
      f"Expected at least 6 tools, got {len(ALL_TOOLS)}")

# get_pending_invoices
raw = get_pending_invoices.invoke("")
data = json.loads(raw)
check(isinstance(data, list) and len(data) > 0,
      f"get_pending_invoices -> {len(data)} invoices",
      "get_pending_invoices returned empty or wrong type")
req_keys = {"invoice_no", "client_name", "invoice_amount", "days_overdue", "urgency_tier"}
check(all(req_keys.issubset(r.keys()) for r in data),
      "All required keys present in every record",
      "Some records missing required keys")

# get_invoice_details - known
sample_inv = data[0]["invoice_no"]
det = json.loads(get_invoice_details.invoke(sample_inv))
check("error" not in det,        f"get_invoice_details({sample_inv}) -> OK", f"Unexpected error: {det}")
check("urgency_tier" in det,     f"urgency_tier in details: {det.get('urgency_tier')}", "urgency_tier missing")

# get_invoice_details - unknown
unk = json.loads(get_invoice_details.invoke("INV-DOES-NOT-EXIST"))
check("error" in unk, "Unknown invoice -> error dict returned", "Expected error dict for unknown invoice")

# send_email (dry-run)
sr = json.loads(tool_send_email.invoke({
    "invoice_no": sample_inv, "subject": "Test", "body": "Test", "to_email": "x@y.com"
}))
check(sr["status"] == "dry_run", f"send_email tool -> status=dry_run", f"status was '{sr['status']}'")

# update_invoice_record - use temp CSV copy
_tmp = tempfile.mktemp(suffix=".csv")
shutil.copy(DATA_PATH, _tmp)
orig_path = cfg.DATA_PATH
cfg.DATA_PATH = _tmp
df_b = load_invoices(_tmp)
first_pending = df_b[df_b["payment_status"] == "Pending"].iloc[0]["invoice_no"]
before_fc = int(df_b[df_b["invoice_no"] == first_pending]["followup_count"].iloc[0])
upd = json.loads(update_invoice_record.invoke(first_pending))
check(upd["status"] == "ok", f"update_invoice_record({first_pending}) -> ok", f"status was '{upd.get('status')}'")
df_a = load_invoices(_tmp)
after_fc = int(df_a[df_a["invoice_no"] == first_pending]["followup_count"].iloc[0])
check(after_fc == before_fc + 1, f"followup_count {before_fc} -> {after_fc}", f"Count not incremented: {after_fc}")
cfg.DATA_PATH = orig_path
os.unlink(_tmp)

# generate_run_report
rr = json.loads(generate_run_report.invoke(""))
check(all(k in rr for k in ("total_processed","total_sent","total_skipped","total_errors","log")),
      "generate_run_report -> all summary keys present",
      "Missing keys in run report")


# =============================================================================
# Test 5 - agent - real Groq LLM, 5-invoice end-to-end dry-run
# =============================================================================
section(5, "agent - real Groq LLM, 5-invoice end-to-end dry-run")

if not GROQ_API_KEY:
    print("    SKIP  GROQ_API_KEY not set - skipping live LLM test")
else:
    from src.tools import generate_followup_email
    logger.reset()

    _tmp5 = tempfile.mktemp(suffix=".csv")
    shutil.copy(DATA_PATH, _tmp5)
    cfg.DATA_PATH = _tmp5

    print("\n[5] agent - real Groq LLM, 5-invoice end-to-end dry-run")
    # Take up to 5 actionable invoices that are NOT legal_escalation
    raw_samples = json.loads(get_pending_invoices.invoke(""))
    sample_5 = [inv for inv in raw_samples if inv.get("urgency_tier") != "legal_escalation"][:5]
    print(f"    INFO  {len(sample_5)}-invoice run: {[i['invoice_no'] for i in sample_5]}")

    generated, sent, updated = [], [], []
    for inv in sample_5:
        inv_no = inv["invoice_no"]
        if inv.get("urgency_tier") == "legal_escalation": continue

        email_raw = generate_followup_email.invoke(inv_no)
        email = json.loads(email_raw)
        if "error" not in email and email.get("subject"):
            generated.append(inv_no)

        s = json.loads(tool_send_email.invoke({
            "invoice_no": inv_no,
            "subject": email.get("subject", "Follow-up"),
            "body": email.get("body", ""),
            "to_email": email.get("to_email", ""),
        }))
        if s.get("status") == "dry_run":
            sent.append(inv_no)

        u = json.loads(update_invoice_record.invoke(inv_no))
        if u.get("status") == "ok":
            updated.append(inv_no)

    check(len(generated) > 0, f"LLM generated emails for valid invoices",          f"Only {len(generated)} generated")
    check(len(sent) > 0,      f"Emails dry-run dispatched",                   f"Only {len(sent)} sent")
    check(len(updated) > 0,   f"Invoice records updated",                     f"Only {len(updated)} updated")

    valid_samples = [inv for inv in sample_5 if inv.get("urgency_tier") != "legal_escalation"]
    if valid_samples:
        first_email = json.loads(generate_followup_email.invoke(valid_samples[0]["invoice_no"]))
        check("subject" in first_email and bool(first_email["subject"]),
              f"Non-empty subject: '{first_email.get('subject','')[:55]}'",
              "Subject missing or empty")
        check("body" in first_email and len(first_email.get("body","")) > 50,
              f"Body has content ({len(first_email.get('body',''))} chars)",
              "Body too short or missing")
        body_clean = first_email.get("body","").replace(",", "")
        amount_int = int(float(valid_samples[0]["invoice_amount"]))
        check(str(amount_int) in body_clean,
              f"Invoice amount {valid_samples[0]['invoice_amount']} present",
              "Invoice amount missing from body")

    cfg.DATA_PATH = DATA_PATH
    os.unlink(_tmp5)


# =============================================================================
# Test 6 - outputs/run_report_*.json created after run
# =============================================================================
section(6, "run_report - JSON file written to outputs/")

from src.config import OUTPUT_DIR

logger.reset()
logger.log_action("SYSTEM", "validation_run", "ok", "Step 10 check")
rp = logger.flush_report(OUTPUT_DIR)

check(os.path.isfile(rp),
      f"Report file created: {os.path.basename(rp)}",
      f"Report file not found: {rp}")
check(os.path.basename(rp).startswith("run_report_"),
      "Filename starts with 'run_report_'",
      f"Unexpected filename: {os.path.basename(rp)}")
check(os.path.basename(rp).endswith(".json"),
      "Filename ends with '.json'",
      "File is not .json")

with open(rp, encoding="utf-8") as f:
    written = json.load(f)
check(all(k in written for k in ("total_processed","total_sent","total_skipped","total_errors","log")),
      "All required JSON keys in report",
      "Missing keys in written report")
check(isinstance(written["log"], list),
      f"'log' is a list ({len(written['log'])} entries)",
      "'log' is not a list")


# =============================================================================
# Test 7 - CSV updated: followup_count + last_followup_date
# =============================================================================
section(7, "CSV update - followup_count + last_followup_date persisted")

from src.updater import update_followup
TODAY = date.today().isoformat()

_tmp7 = tempfile.mktemp(suffix=".csv")
shutil.copy(DATA_PATH, _tmp7)

rt_df = load_invoices(_tmp7)
# Just use the first pending invoice for the update test
pending_df = rt_df[rt_df["payment_status"] == "Pending"]
target_inv = pending_df.iloc[0]["invoice_no"]
before_fc7 = int(rt_df.loc[rt_df["invoice_no"] == target_inv, "followup_count"].iloc[0])

update_followup(target_inv, rt_df)
save_invoices(rt_df, _tmp7)

rt_df2 = load_invoices(_tmp7)
after_fc7   = int(rt_df2.loc[rt_df2["invoice_no"] == target_inv, "followup_count"].iloc[0])
after_date7 = str(rt_df2.loc[rt_df2["invoice_no"] == target_inv, "last_followup_date"].iloc[0])[:10]
row_count   = len(rt_df2)

check(after_fc7 == before_fc7 + 1,
      f"followup_count persisted: {before_fc7} -> {after_fc7} for {target_inv}",
      f"followup_count wrong: {before_fc7} -> {after_fc7}")
check(after_date7 == TODAY,
      f"last_followup_date set to today: {after_date7}",
      f"last_followup_date wrong: {after_date7}")
check(row_count == 9,
      f"Row count preserved: {row_count}",
      f"Row count changed: {row_count}")
check(list(rt_df2.columns) == list(rt_df.columns),
      "Column order preserved after round-trip",
      "Column order changed after save/reload")

os.unlink(_tmp7)


# =============================================================================
# Final summary
# =============================================================================
print()
print("=" * 62)
print(f"  RESULTS: {_PASS} passed | {_FAIL} failed")
print("=" * 62)
if _FAIL == 0:
    print("  ALL VALIDATIONS PASSED - Step 10 complete.")
else:
    print(f"  {_FAIL} CHECKS FAILED - review output above.")
    raise SystemExit(1)
