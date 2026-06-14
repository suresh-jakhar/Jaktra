from pydantic import BaseModel

class DisputeRequest(BaseModel):
    invoice_id: str
    invoice_data: dict
    dispute_reason: str
    communication_history: list[dict]

class DisputeResponse(BaseModel):
    suggested_response: str
    resolution_type: str  # "accept", "partial", "reject", "negotiate"
    confidence: float
    reasoning: str

class DisputeAgent:
    """
    Handles invoice dispute scenarios.
    Input: dispute details, invoice data, communication history
    Output: suggested response, resolution recommendation, risk assessment
    """
    async def handle(self, request: DisputeRequest) -> DisputeResponse:
        raise NotImplementedError("Dispute agent is not yet implemented")
