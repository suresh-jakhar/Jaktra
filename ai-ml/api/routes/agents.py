from fastapi import APIRouter, HTTPException
from src.agents.dispute_agent import DisputeRequest, DisputeResponse, DisputeAgent
from src.agents.negotiation_agent import NegotiationRequest, NegotiationResponse, NegotiationAgent

router = APIRouter(prefix="/agents", tags=["Agents"])

dispute_agent = DisputeAgent()
negotiation_agent = NegotiationAgent()

@router.post("/dispute", response_model=DisputeResponse)
async def handle_dispute(request: DisputeRequest):
    try:
        return await dispute_agent.handle(request)
    except NotImplementedError:
        schema_info = DisputeResponse.model_json_schema()
        raise HTTPException(
            status_code=501, 
            detail={
                "error": "NOT_IMPLEMENTED",
                "schema": schema_info
            }
        )

@router.post("/negotiate", response_model=NegotiationResponse)
async def handle_negotiate(request: NegotiationRequest):
    try:
        return await negotiation_agent.handle(request)
    except NotImplementedError:
        schema_info = NegotiationResponse.model_json_schema()
        raise HTTPException(
            status_code=501, 
            detail={
                "error": "NOT_IMPLEMENTED",
                "schema": schema_info
            }
        )
