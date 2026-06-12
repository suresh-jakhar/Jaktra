from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from api.services.generation import generate_followup_content

router = APIRouter(prefix="/followup", tags=["Generation"])

class FollowupRequest(BaseModel):
    invoice_id: str
    invoice_no: str
    client_name: str
    contact_email: str
    invoice_amount: str
    currency: str
    due_date: str
    days_overdue: int
    urgency_tier: str
    channel: str = "email"
    followup_count: int = 0
    payment_link: Optional[str] = None
    bank_details: Optional[str] = None
    sender_name: Optional[str] = None
    company_name: Optional[str] = None

class Content(BaseModel):
    subject: str
    html_body: str
    plain_body: str

class Metadata(BaseModel):
    tier_used: str
    model: str
    generation_ms: float
    token_count: int

class FollowupResponse(BaseModel):
    invoice_id: str
    channel: str
    content: Content
    metadata: Metadata

@router.post("", response_model=FollowupResponse)
async def generate_followup(request: FollowupRequest):
    try:
        result = generate_followup_content(request.model_dump())
    except ValueError as e:
        if "legal_escalation" in str(e):
            raise HTTPException(status_code=400, detail="TIER_NOT_AUTOMATABLE")
        raise HTTPException(status_code=400, detail=str(e))
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    if result.get("status") == "error":
        raise HTTPException(status_code=502, detail={"error": result.get("reason", "LLM Generation failed"), "retryable": True})
        
    if "Validation Error" in result["subject"] or "Security Error" in result["subject"]:
        raise HTTPException(status_code=422, detail="GENERATION_VALIDATION_FAILED")
    
    plain_body = result["body"]
    html_body = f"<p>{plain_body.replace(chr(10), '<br>')}</p>"

    return FollowupResponse(
        invoice_id=request.invoice_id,
        channel=request.channel,
        content=Content(
            subject=result["subject"],
            html_body=html_body,
            plain_body=plain_body
        ),
        metadata=Metadata(
            tier_used=result["metadata"]["tier_used"],
            model=result["metadata"]["model"],
            generation_ms=result["metadata"]["generation_ms"],
            token_count=result["metadata"]["token_count"]
        )
    )
