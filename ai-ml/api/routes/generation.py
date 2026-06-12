from fastapi import APIRouter

router = APIRouter(prefix="/followup", tags=["Generation"])

@router.post("")
async def generate_followup():
    return {"message": "Success"}

# Endpoints will be implemented in C.2
