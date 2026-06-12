from typing import Dict, Any
from langchain_core.prompts import ChatPromptTemplate
from src.constants import TIER_WARM, TIER_FIRM, TIER_SERIOUS, TIER_STERN, TIER_LEGAL

class TierNotAutomatableError(ValueError):
    pass

class UnknownPromptError(KeyError):
    pass

class PromptRegistry:
    """
    Channel × Tier matrix for prompt selection.
    Each combination maps to a ChatPromptTemplate.
    """
    def __init__(self):
        self._registry = {}
        self._load_prompts()

    def _load_prompts(self):
        # Email Prompts
        from prompts.email.warm import PROMPT as EMAIL_WARM
        from prompts.email.firm import PROMPT as EMAIL_FIRM
        from prompts.email.serious import PROMPT as EMAIL_SERIOUS
        from prompts.email.stern import PROMPT as EMAIL_STERN

        self._registry[f"email:{TIER_WARM}"] = EMAIL_WARM
        self._registry[f"email:{TIER_FIRM}"] = EMAIL_FIRM
        self._registry[f"email:{TIER_SERIOUS}"] = EMAIL_SERIOUS
        self._registry[f"email:{TIER_STERN}"] = EMAIL_STERN

        # SMS Prompts
        from prompts.sms.warm import PROMPT as SMS_WARM
        from prompts.sms.firm import PROMPT as SMS_FIRM
        from prompts.sms.serious import PROMPT as SMS_SERIOUS
        from prompts.sms.stern import PROMPT as SMS_STERN

        self._registry[f"sms:{TIER_WARM}"] = SMS_WARM
        self._registry[f"sms:{TIER_FIRM}"] = SMS_FIRM
        self._registry[f"sms:{TIER_SERIOUS}"] = SMS_SERIOUS
        self._registry[f"sms:{TIER_STERN}"] = SMS_STERN

        # WhatsApp Prompts
        from prompts.whatsapp.warm import PROMPT as WA_WARM
        from prompts.whatsapp.firm import PROMPT as WA_FIRM
        from prompts.whatsapp.serious import PROMPT as WA_SERIOUS
        from prompts.whatsapp.stern import PROMPT as WA_STERN

        self._registry[f"whatsapp:{TIER_WARM}"] = WA_WARM
        self._registry[f"whatsapp:{TIER_FIRM}"] = WA_FIRM
        self._registry[f"whatsapp:{TIER_SERIOUS}"] = WA_SERIOUS
        self._registry[f"whatsapp:{TIER_STERN}"] = WA_STERN

    def get_prompt(self, channel: str, tier: str) -> ChatPromptTemplate:
        if tier == TIER_LEGAL:
            raise TierNotAutomatableError(f"{tier} does not have an automated prompt.")
        key = f"{channel}:{tier}"
        if key not in self._registry:
            raise UnknownPromptError(f"Unknown prompt for channel={channel}, tier={tier}")
        return self._registry[key]

registry = PromptRegistry()

def get_prompt_for_tier(tier: str, channel: str = "email") -> ChatPromptTemplate:
    """Convenience function for backwards compatibility or simple access."""
    return registry.get_prompt(channel, tier)
