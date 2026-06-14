import os
import joblib
import pandas as pd
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
    def __init__(self):
        self._ml_model = None
        self._use_ml_model = True
        
        # Determine paths
        # If this script is run from inside ai-ml/src/risk, models/ is two levels up
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self._model_path = os.path.join(base_dir, 'models', 'risk_scorer.joblib')
        
        self._load_model()
        
    def _load_model(self):
        if os.path.exists(self._model_path):
            try:
                self._ml_model = joblib.load(self._model_path)
            except Exception as e:
                print(f"Warning: Failed to load ML model: {e}")
                self._ml_model = None
        else:
            self._ml_model = None

    def score(self, features: RiskFeatures) -> RiskResult:
        if self._use_ml_model and self._ml_model is not None:
            return self._score_ml(features)
        else:
            return self._score_rule_based(features)
            
    def _score_ml(self, features: RiskFeatures) -> RiskResult:
        hist_rate = features.client_historical_payment_rate if features.client_historical_payment_rate is not None else 0.5
        
        df = pd.DataFrame([{
            'days_overdue': features.days_overdue,
            'invoice_amount': features.invoice_amount,
            'followup_count': features.followup_count,
            'client_historical_payment_rate': hist_rate
        }])
        
        risk_score = float(self._ml_model.predict_proba(df)[0, 1])
        risk_score = round(risk_score, 3)
        risk_level = "high" if risk_score >= 0.7 else "medium" if risk_score >= 0.4 else "low"
        
        return RiskResult(
            risk_score=risk_score,
            risk_level=risk_level,
            model_version="ml-gbm-v1",
            features_used=features.model_dump(),
        )

    def _score_rule_based(self, features: RiskFeatures) -> RiskResult:
        score = 0.0
        
        # Cap features to valid ranges before calculation
        overdue_factor = min(max(features.days_overdue, 0) / 60.0, 1.0)
        amount_factor = min(max(features.invoice_amount, 0.0) / 100000.0, 1.0)
        followup_factor = min(max(features.followup_count, 0) / 5.0, 1.0)
        
        score += overdue_factor * 0.4
        score += amount_factor * 0.2
        score += followup_factor * 0.2
        
        if features.client_historical_payment_rate is not None:
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
