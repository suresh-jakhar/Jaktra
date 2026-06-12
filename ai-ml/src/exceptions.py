"""
src/exceptions.py

Custom exception types for safety-critical invariant violations.
"""


class HaltViolationError(RuntimeError):
    """
    Raised when an attempt is made to email a Stage 5 (legal_escalation)
    invoice.  This is a belt-and-suspenders safety check — the agent loop
    and process_invoice should both prevent this, but if a code path
    somehow bypasses them, this exception stops the email from going out.
    """
    pass

class TierNotAutomatableError(Exception):
    pass

class OutputValidationError(Exception):
    pass

class LLMGenerationError(Exception):
    pass

class PromptInjectionDetectedError(Exception):
    pass
