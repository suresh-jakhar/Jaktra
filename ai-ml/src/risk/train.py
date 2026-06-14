import os
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, precision_score, recall_score, f1_score

def generate_synthetic_data(n_samples=5000):
    """Generate synthetic data for training the ML model."""
    np.random.seed(42)
    
    # Features
    days_overdue = np.random.randint(-10, 120, n_samples)
    invoice_amount = np.random.uniform(100.0, 50000.0, n_samples)
    followup_count = np.random.randint(0, 7, n_samples)
    client_historical_payment_rate = np.random.uniform(0.0, 1.0, n_samples)
    
    # Missing values for some historical rates
    mask = np.random.rand(n_samples) < 0.2
    client_historical_payment_rate[mask] = np.nan
    
    # Target definition (paid_within_30_days)
    # Higher overdue, higher amount, lower payment rate -> less likely to pay
    risk_score = (
        (np.maximum(days_overdue, 0) / 120.0) * 0.4 +
        (invoice_amount / 50000.0) * 0.2 +
        (followup_count / 7.0) * 0.2 +
        (1.0 - np.nan_to_num(client_historical_payment_rate, nan=0.5)) * 0.2
    )
    
    # Add some noise
    risk_score += np.random.normal(0, 0.1, n_samples)
    
    # paid_within_30_days = 1 if risk is low, 0 if risk is high
    paid_within_30_days = (risk_score < 0.5).astype(int)
    
    df = pd.DataFrame({
        'days_overdue': days_overdue,
        'invoice_amount': invoice_amount,
        'followup_count': followup_count,
        'client_historical_payment_rate': client_historical_payment_rate,
        'paid_within_30_days': paid_within_30_days
    })
    
    # Fill NaN values with mean for training
    df['client_historical_payment_rate'] = df['client_historical_payment_rate'].fillna(df['client_historical_payment_rate'].mean())
    
    return df

def train_model():
    print("Generating synthetic historical data...")
    df = generate_synthetic_data()
    
    X = df[['days_overdue', 'invoice_amount', 'followup_count', 'client_historical_payment_rate']]
    y = df['paid_within_30_days']
    
    # Invert target for risk scorer: 1 = high risk (won't pay), 0 = low risk (will pay)
    # The requirement: risk_score 0.0 (will pay) to 1.0 (won't pay).
    y_risk = 1 - y
    
    X_train, X_test, y_train, y_test = train_test_split(X, y_risk, test_size=0.2, random_state=42)
    
    print("Training GradientBoostingClassifier...")
    model = GradientBoostingClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    y_pred = model.predict(X_test)
    
    auc = roc_auc_score(y_test, y_pred_proba)
    precision = precision_score(y_test, y_pred)
    recall = recall_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred)
    
    print("Evaluation on test set:")
    print(f"AUC: {auc:.3f}")
    print(f"Precision: {precision:.3f}")
    print(f"Recall: {recall:.3f}")
    print(f"F1 Score: {f1:.3f}")
    
    # Compare with rule-based approach on the same test set
    print("\nComparing with rule-based approach:")
    from src.risk.scorer import RiskScorer, RiskFeatures
    # Temporarily force rule-based mode by setting a flag or overriding
    scorer = RiskScorer()
    scorer._use_ml_model = False 
    
    rule_scores = []
    for _, row in X_test.iterrows():
        f = RiskFeatures(
            days_overdue=int(row['days_overdue']),
            invoice_amount=float(row['invoice_amount']),
            followup_count=int(row['followup_count']),
            client_historical_payment_rate=float(row['client_historical_payment_rate'])
        )
        rule_scores.append(scorer.score(f).risk_score)
        
    rule_auc = roc_auc_score(y_test, rule_scores)
    print(f"Rule-based AUC: {rule_auc:.3f}")
    if auc > rule_auc:
        print("ML Model outperformed rule-based approach!")
    else:
        print("ML Model did not outperform rule-based approach.")
    
    # Path should be ai-ml/models/risk_scorer.joblib
    models_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'models')
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, 'risk_scorer.joblib')
    
    joblib.dump(model, model_path)
    print(f"\nModel saved to {model_path} ({os.path.getsize(model_path) / 1024:.1f} KB)")

if __name__ == '__main__':
    train_model()
