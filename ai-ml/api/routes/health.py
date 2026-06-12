import time
from fastapi import APIRouter, Depends
from api.middleware.auth import verify_service_key

router = APIRouter(tags=["Health"])

START_TIME = time.time()

# Operational stats
stats = {
    "requests_served": 0,
    "total_generation_ms": 0,
    "errors_last_hour": 0,
    "is_processing": False
}

@router.get("/health")
async def get_health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "model": "llama-3.1-8b-instant",
        "provider": "groq",
        "uptime_seconds": int(time.time() - START_TIME)
    }

@router.get("/status", dependencies=[Depends(verify_service_key)])
async def get_status():
    avg_gen_ms = 0
    if stats["requests_served"] > 0:
        avg_gen_ms = stats["total_generation_ms"] // stats["requests_served"]
        
    return {
        "is_processing": stats["is_processing"],
        "requests_served": stats["requests_served"],
        "avg_generation_ms": avg_gen_ms,
        "errors_last_hour": stats["errors_last_hour"]
    }
