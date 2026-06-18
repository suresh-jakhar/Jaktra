import Papa from 'papaparse';
import { z } from 'zod';
import * as XLSX from 'xlsx';

const csvRowSchema = z.object({
  invoice_no: z.preprocess(
    (val) => (val !== undefined && val !== null ? String(val).trim() : ''),
    z.string().min(1, 'invoice_no is required')
  ),
  client_name: z.preprocess(
    (val) => (val !== undefined && val !== null ? String(val).trim() : ''),
    z.string().min(1, 'client_name is required')
  ),
  invoice_amount: z.preprocess(
    (val) => {
      if (typeof val === 'number') return val;
      if (val === undefined || val === null || String(val).trim() === '') return undefined;
      const num = parseFloat(String(val));
      return isNaN(num) ? undefined : num;
    },
    z.number({ message: 'Invalid amount' })
      .min(0, { message: 'Invalid amount' })
      .transform((val) => val.toFixed(2))
  ),
  due_date: z.preprocess(
    (val) => {
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'number') {
        const date = new Date((val - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? '' : date.toISOString();
      }
      return val !== undefined && val !== null ? String(val).trim() : '';
    },
    z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid date format',
    })
  ),
  contact_email: z.preprocess(
    (val) => (val !== undefined && val !== null ? String(val).trim() : ''),
    z.string().email('Invalid email format')
  ),
  followup_count: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return 0;
      const num = typeof val === 'number' ? val : parseInt(String(val).trim(), 10);
      return isNaN(num) ? 0 : num;
    },
    z.number().default(0)
  ),
  payment_status: z.preprocess(
    (val) => {
      if (!val) return 'Pending';
      const normalized = String(val).trim().toLowerCase();
      const mapping: Record<string, 'Pending' | 'Paid' | 'Overdue' | 'Written Off'> = {
        pending: 'Pending',
        paid: 'Paid',
        overdue: 'Overdue',
        'written off': 'Written Off'
      };
      return mapping[normalized] || 'Pending';
    },
    z.enum(['Pending', 'Paid', 'Overdue', 'Written Off']).default('Pending')
  ),
  last_followup_date: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (val instanceof Date) return val;
      if (typeof val === 'number') {
        const date = new Date((val - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? undefined : date;
      }
      const parsed = Date.parse(String(val).trim());
      return isNaN(parsed) ? undefined : new Date(parsed);
    },
    z.instanceof(Date).optional()
  ),
  days_overdue: z.any().optional(),
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
        invoiceNo: raw.invoice_no ? String(raw.invoice_no) : undefined,
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

export function parseExcelBuffer(buffer: Buffer): CsvParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) {
    return { valid: [], errors: [{ row: 1, errors: ['Worksheet is empty'] }] };
  }

  const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
  const valid: ParsedRow[] = [];
  const errors: RowError[] = [];

  for (let i = 0; i < rawData.length; i++) {
    const rawRow = rawData[i]!;
    const normalizedRow: Record<string, any> = {};
    for (const key of Object.keys(rawRow)) {
      const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      normalizedRow[normalizedKey] = rawRow[key];
    }

    const hasAnyValue = Object.values(normalizedRow).some(v => v !== undefined && v !== null && String(v).trim() !== '');
    if (!hasAnyValue) continue;

    const result = csvRowSchema.safeParse(normalizedRow);
    const rowNum = i + 2;

    if (!result.success) {
      errors.push({
        row: rowNum,
        invoiceNo: normalizedRow.invoice_no ? String(normalizedRow.invoice_no) : undefined,
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

  return { valid, errors };
}

export function parseFileBuffer(buffer: Buffer, originalname: string): CsvParseResult {
  const ext = originalname.split('.').pop()?.toLowerCase();
  if (ext === 'xlsx' || ext === 'xls') {
    return parseExcelBuffer(buffer);
  }
  return parseCsvBuffer(buffer);
}
