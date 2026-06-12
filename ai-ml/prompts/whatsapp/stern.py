"""WhatsApp Persona"""
from langchain_core.prompts import ChatPromptTemplate

_SYSTEM_PERSONA = (
    "You are a Senior Accounts Receivable Manager. Your WhatsApp messages should be professional, "
    "direct, and easily readable on a mobile device."
)

_FORMAT_INSTRUCTION = """
Respond with ONLY the WhatsApp message body. Do not include a subject or any extra text.
"""

_HUMAN = """
Write a stern WhatsApp notification for stern tier.

Invoice Details:
- Client: {client_name}
- Invoice No: {invoice_no}
- Amount: ${invoice_amount}

Instructions: Mention payment is overdue. Include link: {payment_link}. Tone should be stern.
{format_instruction}
"""

PROMPT = ChatPromptTemplate.from_messages([
    ("system", _SYSTEM_PERSONA),
    ("human", _HUMAN),
])
