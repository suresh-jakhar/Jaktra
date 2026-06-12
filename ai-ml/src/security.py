import re
from src.exceptions import OutputValidationError, PromptInjectionDetectedError

def sanitize_input(text: str) -> str:
    """
    Prevent Prompt Injection by scrubbing malicious patterns from user-provided data.
    """
    if not isinstance(text, str):
        return str(text)
    
    # Common injection keywords to neutralize
    patterns = [
        r"ignore previous instructions",
        r"ignore previous",
        r"system prompt",
        r"instead of",
        r"you are now",
        r"assistant:"
    ]
    for p in patterns:
        text = re.sub(p, "[REDACTED]", text, flags=re.IGNORECASE)
    
    # Strip any potential hidden formatting or control characters
    return "".join(ch for ch in text if ch.isprintable()).strip()

def validate_email_output(raw_text: str) -> tuple[str, str]:
    """Parse and validate LLM-generated email output."""
    subject = ""
    body = ""
    
    for line in raw_text.splitlines():
        if line.lower().strip().startswith("subject:"):
            subject = line[len("subject:"):].strip()
            break
            
    lower_text = raw_text.lower()
    marker = "body:"
    if marker in lower_text:
        marker_pos = lower_text.find(marker)
        body = raw_text[marker_pos + len(marker):].strip()
    else:
        if subject and subject in raw_text:
            body = raw_text[raw_text.find(subject) + len(subject):].strip()
        else:
            body = raw_text

    if not subject:
        raise OutputValidationError("LLM output missing subject")
        
    if len(subject) < 10 or len(subject) > 200:
        raise OutputValidationError(f"Subject length {len(subject)} is out of bounds (10-200 chars)")

    if len(body) < 20 or len(body) > 5000:
        raise OutputValidationError(f"Body length {len(body)} is out of bounds (20-5000 chars)")
        
    if "ignore previous" in body.lower() or "ignore previous instructions" in body.lower():
        raise PromptInjectionDetectedError("Potential prompt injection detected in output.")
        
    return subject, body

def validate_sms_output(raw_text: str) -> str:
    """Validate SMS output is within 160 chars and contains CTA."""
    if len(raw_text) > 160:
        raise OutputValidationError("SMS exceeds 160 characters")
    return raw_text.strip()

