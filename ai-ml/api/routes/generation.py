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

class BatchFollowupRequest(BaseModel):
    invoices: list[FollowupRequest]
    concurrency: int = 3

class BatchResult(BaseModel):
    invoice_id: str
    status: str
    content: Optional[Content] = None
    metadata: Optional[Metadata] = None
    error: Optional[str] = None
    retryable: Optional[bool] = None

class BatchSummary(BaseModel):
    total: int
    succeeded: int
    failed: int
    total_ms: float

class BatchFollowupResponse(BaseModel):
    results: list[BatchResult]
    summary: BatchSummary

import asyncio
import time

from src.exceptions import OutputValidationError, PromptInjectionDetectedError

@router.post("", response_model=FollowupResponse)
async def generate_followup(request: FollowupRequest):
    try:
        result = await generate_followup_content(request.model_dump())
    except ValueError as e:
        if "legal_escalation" in str(e):
            raise HTTPException(status_code=400, detail="TIER_NOT_AUTOMATABLE")
        raise HTTPException(status_code=400, detail=str(e))
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except OutputValidationError as e:
        raise HTTPException(status_code=422, detail="GENERATION_VALIDATION_FAILED")
    except PromptInjectionDetectedError as e:
        raise HTTPException(status_code=422, detail="GENERATION_VALIDATION_FAILED")
    
    if result.get("status") == "error":
        raise HTTPException(status_code=502, detail={"error": result.get("reason", "LLM Generation failed"), "retryable": True})
        
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

async def _process_invoice_for_batch(invoice: FollowupRequest, sem: asyncio.Semaphore) -> dict:
    async with sem:
        try:
            # Enforce 60 second timeout per invoice
            result = await asyncio.wait_for(
                generate_followup_content(invoice.model_dump()),
                timeout=60.0
            )
        except asyncio.TimeoutError:
            return {
                "invoice_id": invoice.invoice_id,
                "status": "error",
                "error": "TIMEOUT",
                "retryable": True
            }
        except ValueError as e:
            if "legal_escalation" in str(e):
                return {
                    "invoice_id": invoice.invoice_id,
                    "status": "error",
                    "error": "TIER_NOT_AUTOMATABLE",
                    "retryable": False
                }
            return {
                "invoice_id": invoice.invoice_id,
                "status": "error",
                "error": str(e),
                "retryable": False
            }
        except OutputValidationError:
            return {
                "invoice_id": invoice.invoice_id,
                "status": "error",
                "error": "GENERATION_VALIDATION_FAILED",
                "retryable": False
            }
        except PromptInjectionDetectedError:
            return {
                "invoice_id": invoice.invoice_id,
                "status": "error",
                "error": "GENERATION_VALIDATION_FAILED",
                "retryable": False
            }
        except Exception as e:
            return {
                "invoice_id": invoice.invoice_id,
                "status": "error",
                "error": str(e),
                "retryable": False
            }

        if result.get("status") == "error":
            return {
                "invoice_id": invoice.invoice_id,
                "status": "error",
                "error": result.get("reason", "LLM_GENERATION_FAILED"),
                "retryable": True
            }

        plain_body = result["body"]
        html_body = f"<p>{plain_body.replace(chr(10), '<br>')}</p>"

        return {
            "invoice_id": invoice.invoice_id,
            "status": "success",
            "content": Content(
                subject=result["subject"],
                html_body=html_body,
                plain_body=plain_body
            ),
            "metadata": Metadata(
                tier_used=result["metadata"]["tier_used"],
                model=result["metadata"]["model"],
                generation_ms=result["metadata"]["generation_ms"],
                token_count=result["metadata"]["token_count"]
            )
        }

@router.post("/batch", response_model=BatchFollowupResponse)
async def generate_followup_batch(request: BatchFollowupRequest):
    if len(request.invoices) > 50:
        raise HTTPException(status_code=400, detail="BATCH_SIZE_EXCEEDED")
    
    if request.concurrency < 1 or request.concurrency > 10:
        raise HTTPException(status_code=400, detail="Invalid concurrency. Must be between 1 and 10.")
        
    sem = asyncio.Semaphore(request.concurrency)
    start_time = time.perf_counter()
    
    tasks = [_process_invoice_for_batch(inv, sem) for inv in request.invoices]
    results_raw = await asyncio.gather(*tasks)
    
    results = []
    succeeded = 0
    failed = 0
    
    for r in results_raw:
        if r["status"] == "success":
            succeeded += 1
            results.append(BatchResult(
                invoice_id=r["invoice_id"],
                status="success",
                content=r["content"],
                metadata=r["metadata"]
            ))
        else:
            failed += 1
            results.append(BatchResult(
                invoice_id=r["invoice_id"],
                status="error",
                error=r["error"],
                retryable=r["retryable"]
            ))
            
    total_ms = (time.perf_counter() - start_time) * 1000
    
    return BatchFollowupResponse(
        results=results,
        summary=BatchSummary(
            total=len(request.invoices),
            succeeded=succeeded,
            failed=failed,
            total_ms=total_ms
        )
    )
