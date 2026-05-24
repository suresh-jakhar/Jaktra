import os
import json
import time
import sys
import logging
import threading
from datetime import datetime, timedelta, timezone
import pytz
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from src.agent import run_agent
from src import config, logger as app_logger

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger("SCHEDULER")

_is_running = threading.Event()

MISSED_RUN_THRESHOLD_HOURS = 26
LAST_RUN_STATE_FILE = os.path.join(config.OUTPUT_DIR, "last_run.json")


def _load_last_run_timestamp() -> datetime | None:
    """
    Read the last_run_timestamp from the state file.

    Returns:
        A timezone-aware datetime (UTC) if the file exists and is valid,
        otherwise None.
    """
    try:
        with open(LAST_RUN_STATE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        ts = data.get("last_run_timestamp")
        if ts is None:
            return None
        dt = datetime.fromisoformat(ts)
        # Ensure UTC-aware
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (FileNotFoundError, json.JSONDecodeError, ValueError, KeyError):
        return None


def _save_last_run_timestamp() -> None:
    """
    Write the current UTC timestamp to the state file after a successful run.
    """
    os.makedirs(os.path.dirname(LAST_RUN_STATE_FILE), exist_ok=True)
    data = {
        "last_run_timestamp": datetime.now(tz=timezone.utc).isoformat(),
    }
    with open(LAST_RUN_STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    logger.info(f"Last-run timestamp saved to {LAST_RUN_STATE_FILE}")


def _check_missed_run() -> bool:
    """
    Check whether the last successful run is too old or missing.

    If a missed run is detected:
      - Logs a MISSED_RUN_DETECTED warning (structured via app_logger)
      - Prints a prominent operator alert to stdout
      - Does NOT trigger an automatic catch-up run

    Returns:
        True if a missed run was detected, False otherwise.
    """
    now = datetime.now(tz=timezone.utc)
    last_run = _load_last_run_timestamp()

    if last_run is None:
        # State file missing or corrupt
        gap_hours = float("inf")
        expected_time = "UNKNOWN (no state file)"
        reason = "missing"
    else:
        gap = now - last_run
        gap_hours = gap.total_seconds() / 3600
        expected_time = last_run.isoformat()

    if last_run is not None and gap_hours <= MISSED_RUN_THRESHOLD_HOURS:
        logger.info(
            f"Last run was {gap_hours:.1f}h ago — within the "
            f"{MISSED_RUN_THRESHOLD_HOURS}h threshold. No alert needed."
        )
        return False

    # Log warning
    actual_time = now.isoformat()
    gap_display = f"{gap_hours:.1f}" if gap_hours != float("inf") else "N/A (no prior run)"

    app_logger.log_action(
        invoice_no="SYSTEM",
        action="MISSED_RUN_DETECTED",
        result="warning",
        reason=(
            f"Expected run at {expected_time}, "
            f"actual startup at {actual_time}, "
            f"gap={gap_display}h"
        ),
    )

    logger.warning(
        f"MISSED_RUN_DETECTED — last_run={expected_time}, "
        f"now={actual_time}, gap={gap_display}h"
    )

    # Prominent operator alert
    alert_lines = [
        "",
        "!" * 60,
        "!  ⚠  MISSED RUN DETECTED",
        "!" * 60,
        f"!  Last successful run : {expected_time}",
        f"!  Current time        : {actual_time}",
        f"!  Gap                 : {gap_display} hours",
        "!",
        "!  The scheduler missed one or more scheduled runs.",
        "!  Invoices may have aged without follow-up emails.",
        "!",
        "!  ACTION REQUIRED:",
        "!    Run manually:  python main.py --now",
        "!" * 60,
        "",
    ]
    for line in alert_lines:
        print(line)

    return True


def scheduled_job():
    """The task that runs on the schedule."""
    _is_running.set()
    logger.info("--- TRIGGERING AUTOMATED RUN ---")
    try:
        summary = run_agent(verbose=True)
        logger.info(f"--- RUN COMPLETE: Sent {summary['total_sent']} emails. ---")
        _save_last_run_timestamp()
    except Exception as e:
        logger.error(f"Scheduled run failed: {str(e)}")
    finally:
        _is_running.clear()

def get_next_run_time(hour, minute, timezone_str):
    """Calculate the next occurrence of the scheduled time."""
    tz = pytz.timezone(timezone_str)
    now = datetime.now(tz)
    next_run = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    
    if next_run <= now:
        next_run += timedelta(days=1)
    return next_run

def countdown_monitor(hour, minute, timezone_str):
    """Background thread to print a live ticking clock in the terminal."""
    try:
        while True:
            if _is_running.is_set():
                time.sleep(1)
                continue
                
            next_run = get_next_run_time(hour, minute, timezone_str)
            diff = next_run - datetime.now(pytz.timezone(timezone_str))
            
            total_seconds = int(diff.total_seconds())
            if total_seconds < 0:
                time.sleep(1)
                continue

            hours, remainder = divmod(total_seconds, 3600)
            minutes, seconds = divmod(remainder, 60)
            
            sys.stdout.write(f"\r[SCHEDULER] Next run in: {hours:02d}h {minutes:02d}m {seconds:02d}s (at {next_run.strftime('%H:%M')} {timezone_str})   ")
            sys.stdout.flush()
            
            time.sleep(1)
    except Exception as e:
        pass

def start_scheduler():
    """Initialize and start the background scheduler with countdown."""
    tz_name = config.TIMEZONE
    hour = config.SCHEDULE_HOUR
    minute = config.SCHEDULE_MINUTE

    _check_missed_run()

    db_path = os.path.join(config.OUTPUT_DIR, "jobs.sqlite")
    jobstores = {
        "default": SQLAlchemyJobStore(url=f"sqlite:///{db_path}"),
    }

    scheduler = BackgroundScheduler(jobstores=jobstores, timezone=tz_name)
    trigger = CronTrigger(hour=hour, minute=minute, timezone=tz_name)
    
    scheduler.add_job(
        scheduled_job,
        trigger=trigger,
        id="daily_finance_followup",
        name=f"Daily Finance Follow-up ({tz_name})",
        misfire_grace_time=3600,      # honour misfired triggers up to 1 hour old
        max_instances=1,              # prevent overlapping runs
        replace_existing=True,        # update the persisted job on restart
    )
    
    scheduler.start()
    
    logger.info("="*60)
    logger.info(f" FINANCE AGENT SCHEDULER ACTIVE ")
    logger.info(f" Timezone : {tz_name}")
    logger.info(f" Daily Run: {hour:02d}:{minute:02d}")
    logger.info("="*60)
    
    monitor_thread = threading.Thread(
        target=countdown_monitor, 
        args=(hour, minute, tz_name), 
        daemon=True
    )
    monitor_thread.start()
    
    try:
        while True:
            time.sleep(1)
    except (KeyboardInterrupt, SystemExit):
        logger.info("Scheduler shutting down...")
        scheduler.shutdown()

if __name__ == "__main__":
    start_scheduler()
