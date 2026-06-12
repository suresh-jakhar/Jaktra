import hmac
import logging
from fastapi import Request, HTTPException
from api.config import settings

logger = logging.getLogger(__name__)

async def verify_service_key(request: Request):
    expected_key = settings.SERVICE_KEY
    if not expected_key:
        logger.warning("SERVICE_KEY is not set in configuration.")
        raise HTTPException(status_code=500, detail="Server configuration error")
        
    key = request.headers.get("X-Service-Key")
    if not key or not hmac.compare_digest(key, expected_key):
        client_ip = request.client.host if request.client else "unknown"
        logger.warning(f"Unauthorized access attempt from {client_ip}. Path: {request.url.path}")
        raise HTTPException(status_code=401, detail="Invalid service key")
