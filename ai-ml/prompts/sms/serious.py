"""SMS Persona"""
from langchain_core.prompts import ChatPromptTemplate

_SYSTEM_PERSONA = (
    "You are a Senior Accounts Receivable Manager. Your SMS messages must be ultra-concise, "
    "clear, and under 160 characters if possible. "
)

_FORMAT_INSTRUCTION = """
Respond with ONLY the SMS message body. Do not include a subject or any extra text.
"""

_HUMAN = """
Write a serious SMS notification for serious tier.

Invoice Details:
- Client: {client_name}
- Invoice No: {invoice_no}
- Amount: ${invoice_amount}

Instructions: Mention payment is overdue. Include link: {payment_link}. Tone should be serious.
{format_instruction}
"""

PROMPT = ChatPromptTemplate.from_messages([
    ("system", _SYSTEM_PERSONA),
    ("human", _HUMAN),
])
