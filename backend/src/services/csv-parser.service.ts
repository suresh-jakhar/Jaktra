import Papa from 'papaparse';
import { z } from 'zod';

const csvRowSchema = z.object({
  invoice_no: z.string().min(1, 'invoice_no is required'),
  client_name: z.string().min(1, 'client_name is required'),
  invoice_amount: z.string().transform((val) => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) throw new Error('Invalid amount');
    return num.toFixed(2);
  }),
  due_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  contact_email: z.string().email('Invalid email format'),
  followup_count: z
    .string()
    .optional()
    .default('0')
    .transform((val) => {
      const num = parseInt(val || '0', 10);
      return isNaN(num) ? 0 : num;
    }),
  payment_status: z
    .string()
    .optional()
    .default('Pending')
    .transform((val) => {
      const normalized = val || 'Pending';
      const valid = ['Pending', 'Paid', 'Overdue', 'Written Off'] as const;
      return valid.includes(normalized as typeof valid[number])
        ? (normalized as typeof valid[number])
        : ('Pending' as const);
    }),
  last_followup_date: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === '') return undefined;
      const parsed = Date.parse(val);
      return isNaN(parsed) ? undefined : new Date(parsed);
    }),
  days_overdue: z.string().optional(),
});

export type CsvRowInput = z.input<typeof csvRowSchema>;

export interface ParsedRow {
  invoiceNo: string;
  clientName: string;
  invoiceAmount: string;
  dueDate: string;
  contactEmail: string;
  followupCount: number;
  paymentStatus: 'Pending' | 'Paid' | 'Overdue' | 'Written Off';
  lastFollowupDate: Date | undefined;
}

export interface RowError {
  row: number;
  invoiceNo?: string;
  errors: string[];
}

export interface CsvParseResult {
  valid: ParsedRow[];
  errors: RowError[];
}

export function parseCsvBuffer(buffer: Buffer): CsvParseResult {
  const content = buffer.toString('utf-8');
  const parsed = Papa.parse<CsvRowInput>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim().toLowerCase(),
  });

  const valid: ParsedRow[] = [];
  const errors: RowError[] = [];

  for (let i = 0; i < parsed.data.length; i++) {
    const raw = parsed.data[i]!;
    const result = csvRowSchema.safeParse(raw);

    if (!result.success) {
      errors.push({
        row: i + 2, // 1-indexed + header row
        invoiceNo: raw.invoice_no,
        errors: result.error.issues.map((iss) => `${iss.path.join('.')}: ${iss.message}`),
      });
      continue;
    }

    const data = result.data;
    valid.push({
      invoiceNo: data.invoice_no,
      clientName: data.client_name,
      invoiceAmount: data.invoice_amount,
      dueDate: data.due_date,
      contactEmail: data.contact_email,
      followupCount: data.followup_count,
      paymentStatus: data.payment_status,
      lastFollowupDate: data.last_followup_date,
    });
  }

  if (parsed.errors.length > 0) {
    for (const err of parsed.errors) {
      errors.push({
        row: (err.row ?? 0) + 2,
        errors: [err.message],
      });
    }
  }

  return { valid, errors };
}
