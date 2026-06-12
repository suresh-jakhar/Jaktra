from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends
from api.routes import health, generation, risk, agents
from api.middleware.auth import verify_service_key

app = FastAPI(
    title="CreditOps AI-ML Service",
    description="Agent executor service for CreditOps",
    version="1.0.0",
)

app.include_router(health.router)
app.include_router(generation.router, dependencies=[Depends(verify_service_key)])
app.include_router(risk.router, dependencies=[Depends(verify_service_key)])
app.include_router(agents.router, dependencies=[Depends(verify_service_key)])
