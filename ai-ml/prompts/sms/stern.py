from langchain_core.prompts import ChatPromptTemplate

PROMPT = ChatPromptTemplate.from_messages([
    ("system", "You write concise SMS payment reminders under 160 characters. "
               "Include amount, due date, and payment link. Stern tone, final warning."),
    ("human", "Invoice {invoice_no} for ${invoice_amount} was due {due_date} ({days_overdue} days overdue). "
              "Client: {client_name}. Payment link: {payment_link}. "
              "Write a single SMS reminder under 160 characters. Example format: "
              "FINAL NOTICE: Invoice {invoice_no} (${invoice_amount}) overdue. Payment required immediately to avoid escalation: {payment_link}")
])
