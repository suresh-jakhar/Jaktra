import re

def sanitize_input(text: str) -> str:
    """
    Prevent Prompt Injection by scrubbing malicious patterns from user-provided data.
    """
    if not isinstance(text, str):
        return str(text)
    
    # Common injection keywords to neutralize
    patterns = [
        r"ignore previous instructions",
        r"system prompt",
        r"instead of",
        r"you are now",
        r"assistant:"
    ]
    for p in patterns:
        text = re.sub(p, "[REDACTED]", text, flags=re.IGNORECASE)
    
    # Strip any potential hidden formatting or control characters
    return "".join(ch for ch in text if ch.isprintable()).strip()
