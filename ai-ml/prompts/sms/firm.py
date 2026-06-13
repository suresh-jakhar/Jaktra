from langchain_core.prompts import ChatPromptTemplate

PROMPT = ChatPromptTemplate.from_messages([
    ("system", "You write concise SMS payment reminders under 160 characters. "
               "Include amount, due date, and payment link. Firm tone."),
    ("human", "Invoice {invoice_no} for ${invoice_amount} was due {due_date} ({days_overdue} days overdue). "
              "Client: {client_name}. Payment link: {payment_link}. "
              "Write a single SMS reminder under 160 characters. Example format: "
              "Payment for Invoice {invoice_no} (${invoice_amount}) is {days_overdue} days overdue. Please confirm payment date: {payment_link}")
])
