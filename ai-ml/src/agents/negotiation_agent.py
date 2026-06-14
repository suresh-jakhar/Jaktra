from pydantic import BaseModel
from typing import Optional, Dict

class NegotiationRequest(BaseModel):
    invoice_id: str
    invoice_data: dict
    client_proposal: str  # e.g., "Can we pay 50% now and 50% in 30 days?"
    company_policies: dict  # min acceptable terms

class NegotiationResponse(BaseModel):
    counter_proposal: str
    recommended_action: str  # "accept", "counter", "reject", "escalate"
    payment_plan: Optional[Dict] = None
    reasoning: str

class NegotiationAgent:
    """
    Handles payment negotiation scenarios.
    Input: invoice data, client's proposed terms, company policies
    Output: counter-proposal, recommended action
    """
    async def handle(self, request: NegotiationRequest) -> NegotiationResponse:
        raise NotImplementedError("Negotiation agent is not yet implemented")
