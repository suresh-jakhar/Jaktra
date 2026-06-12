import json
from langchain_core.tools import tool

@tool
def get_invoice_details(invoice_no: str) -> str:
    """Legacy tool. No longer functional."""
    return json.dumps({"error": "Deprecated"})

@tool
def generate_run_report(query: str = "") -> str:
    """Legacy tool. No longer functional."""
    return json.dumps({"error": "Deprecated"})

ALL_TOOLS = [
    get_invoice_details,
    generate_run_report,
]
