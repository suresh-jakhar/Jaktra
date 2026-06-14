from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from src.risk.scorer import RiskScorer, RiskFeatures, RiskResult

router = APIRouter(prefix="/risk", tags=["Risk"])
scorer = RiskScorer()

class RiskScoreRequest(BaseModel):
    invoice_id: str
    features: RiskFeatures

class RiskScoreResponse(RiskResult):
    invoice_id: str

class BatchRiskScoreRequest(BaseModel):
    invoices: List[RiskScoreRequest]

class BatchRiskScoreResponse(BaseModel):
    results: List[RiskScoreResponse]

@router.post("/score", response_model=RiskScoreResponse)
async def score_risk(request: RiskScoreRequest):
    try:
        result = scorer.score(request.features)
        return RiskScoreResponse(
            invoice_id=request.invoice_id,
            risk_score=result.risk_score,
            risk_level=result.risk_level,
            model_version=result.model_version,
            features_used=result.features_used
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/score/batch", response_model=BatchRiskScoreResponse)
async def score_risk_batch(request: BatchRiskScoreRequest):
    results = []
    for invoice in request.invoices:
        try:
            result = scorer.score(invoice.features)
            results.append(RiskScoreResponse(
                invoice_id=invoice.invoice_id,
                risk_score=result.risk_score,
                risk_level=result.risk_level,
                model_version=result.model_version,
                features_used=result.features_used
            ))
        except Exception as e:
            # Depending on requirements, we could fail the whole batch or return errors per item
            # For simplicity, returning a 400 for the whole batch if one fails, or just omit/error
            raise HTTPException(status_code=400, detail=f"Error scoring {invoice.invoice_id}: {str(e)}")
            
    return BatchRiskScoreResponse(results=results)
