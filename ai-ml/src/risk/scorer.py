from pydantic import BaseModel
from typing import Optional

class RiskFeatures(BaseModel):
    days_overdue: int
    invoice_amount: float
    followup_count: int
    client_historical_payment_rate: Optional[float] = None

class RiskResult(BaseModel):
    risk_score: float  # 0.0-1.0
    risk_level: str    # "low", "medium", "high"
    model_version: str
    features_used: dict

class RiskScorer:
    def score(self, features: RiskFeatures) -> RiskResult:
        """
        Returns risk_score: 0.0 (will pay) to 1.0 (won't pay).
        Rule-based scoring v1:
        - days_overdue weight: 0.4
        - amount weight: 0.2
        - followup_count weight: 0.2
        - historical_payment_rate weight: 0.2
        """
        score = 0.0
        
        # Cap features to valid ranges before calculation
        overdue_factor = min(max(features.days_overdue, 0) / 60.0, 1.0)
        amount_factor = min(max(features.invoice_amount, 0.0) / 100000.0, 1.0)
        followup_factor = min(max(features.followup_count, 0) / 5.0, 1.0)
        
        score += overdue_factor * 0.4
        score += amount_factor * 0.2
        score += followup_factor * 0.2
        
        if features.client_historical_payment_rate is not None:
            # 1.0 historical rate -> 0.0 risk addition. 0.0 rate -> 0.2 risk addition
            hist_factor = max(min(features.client_historical_payment_rate, 1.0), 0.0)
            score += (1.0 - hist_factor) * 0.2
            
        risk_score = round(score, 3)
        risk_level = "high" if risk_score >= 0.7 else "medium" if risk_score >= 0.4 else "low"
        
        return RiskResult(
            risk_score=risk_score,
            risk_level=risk_level,
            model_version="rule-based-v1",
            features_used=features.model_dump(),
        )
