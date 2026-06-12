"""
src/agent.py

Legacy CLI adapter. Orchestration is now handled by the backend.
"""

def run_agent(limit: int = None, verbose: bool = True) -> dict:
    """Legacy runner"""
    if verbose:
        print("[AGENT] Legacy CLI adapter invoked. Orchestration is now handled by the backend.")
    return {
        "total_processed": 0, 
        "total_sent": 0, 
        "total_skipped": 0, 
        "total_errors": 0, 
        "report_file": "N/A",
        "failed_invoices": []
    }
