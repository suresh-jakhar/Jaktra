import os
import logging
import warnings
import argparse
import sys
os.environ["PYTHONWARNINGS"] = "ignore"
warnings.filterwarnings("ignore")
logging.captureWarnings(True)
logging.getLogger("py.warnings").setLevel(logging.CRITICAL)

"""
main.py

Legacy entry point for the Finance Credit Follow-Up Email Agent.
Orchestration has been moved to the backend.
"""

def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Finance Credit Follow-Up Email Agent (Legacy)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Maximum number of invoices to process in this run",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Dry run flag (ignored, handled by backend)",
    )
    parser.add_argument(
        "--send",
        action="store_true",
        help="Send flag (ignored, handled by backend)",
    )
    parser.add_argument(
        "--now",
        action="store_true",
        help="Run immediately flag (ignored)",
    )
    return parser.parse_args()

def _print_banner() -> None:
    print("=" * 60)
    print("  Finance Credit Follow-Up Email Agent (Legacy)")
    print("  Note: Orchestration is now handled by the backend.")
    print("=" * 60)
    print()

def _print_summary(summary: dict) -> None:
    print()
    print("=" * 60)
    print("  RUN COMPLETE")
    print(f"  Processed : {summary.get('total_processed', 0)}")
    print(f"  Sent      : {summary.get('total_sent', 0)}")
    print(f"  Skipped   : {summary.get('total_skipped', 0)}")
    print(f"  Errors    : {summary.get('total_errors', 0)}")
    print(f"  Report    : {summary.get('report_file', 'N/A')}")
    print("=" * 60)

def main() -> int:
    args = _parse_args()
    _print_banner()

    try:
        from src.agent import run_agent  
        summary = run_agent(limit=args.limit, verbose=True)
    except KeyboardInterrupt:
        print("\n[INTERRUPTED] Run cancelled by user.")
        return 1
    except Exception as exc:
        print(f"\n[ERROR] Unhandled exception: {exc}")
        return 1

    _print_summary(summary)
    return 0

if __name__ == "__main__":
    sys.exit(main())
