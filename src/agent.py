"""
src/agent.py

Orchestrates the full credit follow-up pipeline:
  triage -> generate emails (LLM) -> send -> update records -> report.

"""

import json

from langchain_core.messages import HumanMessage
from langchain_groq import ChatGroq
from langgraph.prebuilt import create_react_agent

from src import config, logger
from src.idempotency import is_recently_sent, get_last_send_time
from src.triage import TIER_LEGAL
from src.dead_letter import DeadLetterQueue, DLQ_ALERT_THRESHOLD
from src.tools import ALL_TOOLS, get_pending_invoices, process_invoice, generate_run_report

import os


_AGENT_SYSTEM_PROMPT = """You are an autonomous finance credit follow-up agent for a company.

Your workflow has exactly three phases:

PHASE 1 - Get the invoice list:
  Call get_pending_invoices once. This returns the full list of invoices needing follow-up.

PHASE 2 - Process each invoice one at a time:
  For EACH invoice_no in the list, call process_invoice(invoice_no).
  - process_invoice handles email generation, sending, and record update internally.
  - Do NOT call generate_followup_email, send_email, or update_invoice_record separately.
  - Do NOT call get_pending_invoices again after phase 1.
  - Process invoices one at a time, in order.

PHASE 3 - Final report:
  After ALL invoices have been processed, call generate_run_report once.

CRITICAL RULES:
- Use process_invoice for every invoice — never the three individual tools.
- Do not skip any invoice from the list.
- Do not call generate_run_report until every invoice has been processed.
"""


def _build_agent(verbose: bool = True):
    """
    Construct and return the LangGraph ReAct agent with all tools attached.

    """
    llm = ChatGroq(
        model=config.LLM_MODEL,
        api_key=config.GROQ_API_KEY,
        temperature=0,
        max_tokens=512,
    )
    return create_react_agent(
        model=llm,
        tools=ALL_TOOLS,
        prompt=_AGENT_SYSTEM_PROMPT,
    )


def run_agent(limit: int = None, verbose: bool = True) -> dict:
    """
    Args:
        limit: Maximum number of invoices to process in this run. If None, process all.
        verbose: If True, prints progress for each invoice.

    Returns:
        dict with keys: total_processed, total_sent, total_skipped,
        total_errors, log, report_file.
    """
    # Clear stale log entries from any previous run in this process
    logger.reset()

    # Initialise the persistent dead-letter queue
    dlq = DeadLetterQueue(os.path.join(config.OUTPUT_DIR, "dlq.json"))

    # ── Phase 1: retrieve the triaged invoice list ───────────────────────────
    invoices = json.loads(get_pending_invoices.invoke(""))
    
    if limit is not None:
        invoices = invoices[:limit]

    total = len(invoices)
    failed_invoices: list[dict] = []

    if verbose:
        print(f"\n[AGENT] {total} invoices to process.\n")

    # ── Phase 2: process each invoice sequentially ───────────────────────────
    for i, inv in enumerate(invoices, 1):
        inv_no = inv["invoice_no"]
        tier   = inv.get("urgency_tier", "?")

        if verbose:
            print(f"[AGENT] ({i}/{total}) {inv_no}  tier={tier}")

        # ── Stage 5 halt: stop before any LLM / email work ───────────────
        if tier == TIER_LEGAL:
            msg = (
                f"HALTED invoice_id={inv_no} | >30 days overdue (Stage 5). "
                f"Manual legal/finance review required — no email sent."
            )
            logger.log_action(inv_no, "stage5_halt", "HALTED", msg)
            if verbose:
                print(f"         -> {msg}")
            continue

        # ── Idempotency guard: skip if already emailed within window ─────
        if is_recently_sent(inv_no, config.OUTPUT_DIR):
            last_send = get_last_send_time(inv_no, config.OUTPUT_DIR) or "unknown"
            msg = f"SKIPPED (idempotent) invoice_id={inv_no} last_send_time={last_send}"
            logger.log_action(inv_no, "idempotency_check", "skipped", msg)
            if verbose:
                print(f"         -> {msg}")
            continue

        result = json.loads(process_invoice.invoke(inv_no))

        # ── DLQ tracking: success vs failure ─────────────────────────────
        send_status = result.get("send_status") or result.get("status", "")
        is_success = send_status in ("sent", "dry_run")
        is_failure = (
            result.get("llm_error")
            or result.get("send_error")
            or send_status == "error"
            or result.get("status") == "error"
        )

        if is_success:
            dlq.reset(inv_no)
        elif is_failure:
            error_msg = (
                result.get("llm_error")
                or result.get("send_error")
                or result.get("reason", "unknown error")
            )
            count = dlq.increment(inv_no, error=str(error_msg))

            if count >= DLQ_ALERT_THRESHOLD:
                alert_msg = (
                    f"\u26a0 Invoice {inv_no} has failed {count} consecutive runs. "
                    f"Last error: {error_msg}"
                )
                logger.log_action(inv_no, "dlq_alert", "DLQ_ALERT", alert_msg)
                if verbose:
                    print(f"         \u26a0 DLQ ALERT: Invoice {inv_no} has failed {count} consecutive runs")

        if verbose:
            subj   = result.get("email_subject", "")[:60]
            print(f"         -> {send_status}  |  {subj}")

            # Surface the SMTP error so operators know what went wrong
            send_err = result.get("send_error")
            if send_err:
                print(f"         !! SEND FAILED: {send_err}")

            # Surface LLM/Groq API errors
            llm_err = result.get("llm_error")
            if llm_err:
                print(f"         !! LLM FAILED: {llm_err}")

        # Track invoices that failed LLM generation
        if result.get("llm_error") or result.get("reason", "").startswith("LLM generation failed"):
            failed_invoices.append({
                "invoice_no": inv_no,
                "error": result.get("llm_error") or result.get("reason", "unknown"),
            })

    # ── Log LLM failure summary ──────────────────────────────────────────────
    if failed_invoices:
        fail_count = len(failed_invoices)
        inv_list = ", ".join(f["invoice_no"] for f in failed_invoices)
        msg = f"{fail_count} invoice(s) failed LLM generation: {inv_list}"
        logger.log_action("SYSTEM", "llm_failure_summary", "error", msg)

        if verbose:
            print(f"\n[AGENT] ⚠ {msg}")

    # ── Phase 3: flush the report ────────────────────────────────────────────
    report_path = logger.flush_report(config.OUTPUT_DIR)
    summary = logger.get_summary()
    summary["report_file"] = report_path
    summary["failed_invoices"] = failed_invoices
    return summary
