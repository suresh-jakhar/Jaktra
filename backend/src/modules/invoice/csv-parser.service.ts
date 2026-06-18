import Papa from 'papaparse';
import { z } from 'zod';
import * as XLSX from 'xlsx';

function canonicalizeKey(key: string): string {
  const clean = key.trim().toLowerCase();
  const cleanUnderscore = clean.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  
  // 1. Fast exact/prefix checks for standard terms
  if (['invoiceno', 'invoice_no', 'invoicenumber', 'invoice_number', 'invno', 'inv_no', 'invnumber', 'inv_number', 'invoiceid', 'invoice_id', 'no', 'number', '#', 'id'].includes(cleanUnderscore)) {
    return 'invoice_no';
  }
  if (['clientname', 'client_name', 'customername', 'customer_name', 'client', 'customer', 'name', 'clientcompany', 'company'].includes(cleanUnderscore)) {
    return 'client_name';
  }
  if (['invoiceamount', 'invoice_amount', 'amount', 'total', 'price', 'balance', 'val', 'value', 'cost', 'sum'].includes(cleanUnderscore)) {
    return 'invoice_amount';
  }
  if (['duedate', 'due_date', 'due', 'deadline', 'paymentdue', 'payment_due'].includes(cleanUnderscore)) {
    return 'due_date';
  }
  if (['contactemail', 'contact_email', 'email', 'emailaddress', 'email_address', 'mail', 'contact'].includes(cleanUnderscore)) {
    return 'contact_email';
  }
  if (['followupcount', 'followup_count', 'followups', 'reminders', 'remindercount', 'reminder_count', 'followupno', 'followup_no'].includes(cleanUnderscore)) {
    return 'followup_count';
  }
  if (['paymentstatus', 'payment_status', 'status', 'state'].includes(cleanUnderscore)) {
    return 'payment_status';
  }
  if (['lastfollowupdate', 'last_followup_date', 'lastfollowup', 'last_followup', 'latestfollowup', 'latest_followup'].includes(cleanUnderscore)) {
    return 'last_followup_date';
  }

  // 2. Token overlap fallback for conversational/complex names
  const cleanTokens = clean.replace(/[^a-z0-9\s_]/g, ' ').split(/[\s_]+/).filter(Boolean);
  if (cleanTokens.length === 0) return cleanUnderscore;

  const concepts: Record<string, string[]> = {
    invoice_no: ['invoice', 'inv', 'num', 'number', 'no', 'id', 'code'],
    client_name: ['client', 'customer', 'name', 'buyer', 'company', 'firm', 'org', 'organization'],
    invoice_amount: ['amount', 'price', 'total', 'value', 'val', 'cost', 'balance', 'usd', 'inr', 'sum'],
    due_date: ['due', 'date', 'timeline', 'limit', 'deadline'],
    contact_email: ['email', 'mail', 'contact', 'address'],
    followup_count: ['followup', 'followups', 'remind', 'reminders', 'count', 'number', 'frequency', 'sent'],
    payment_status: ['status', 'state', 'payment', 'paid'],
    last_followup_date: ['last', 'recent', 'latest', 'followup', 'remind', 'date']
  };

  let bestKey = '';
  let highestScore = 0;

  for (const [targetKey, targetTokens] of Object.entries(concepts)) {
    let score = 0;
    
    for (const token of cleanTokens) {
      if (targetTokens.includes(token)) {
        score += 1.0;
      } else {
        for (const targetToken of targetTokens) {
          if (token.includes(targetToken) || targetToken.includes(token)) {
            score += 0.4;
          }
        }
      }
    }
    
    if (targetKey === 'last_followup_date') {
      const hasLast = cleanTokens.some(t => t.includes('last') || t.includes('recent'));
      const hasFollow = cleanTokens.some(t => t.includes('follow') || t.includes('remind'));
      const hasDate = cleanTokens.some(t => t.includes('date'));
      if (hasLast && hasFollow) score += 1.5;
      if (hasLast && hasDate) score += 1.0;
    }
    
    if (targetKey === 'due_date') {
      const hasDue = cleanTokens.some(t => t.includes('due') || t.includes('deadline'));
      const hasDate = cleanTokens.some(t => t.includes('date'));
      if (hasDue && hasDate) score += 1.5;
      if (cleanTokens.some(t => t.includes('last') || t.includes('recent') || t.includes('follow') || t.includes('remind'))) {
        score -= 1.0;
      }
    }

    if (targetKey === 'followup_count') {
      const hasFollow = cleanTokens.some(t => t.includes('follow') || t.includes('remind'));
      const hasCount = cleanTokens.some(t => t.includes('count') || t.includes('no') || t.includes('num'));
      if (hasFollow && hasCount) score += 1.5;
      if (cleanTokens.some(t => t.includes('date') || t.includes('last') || t.includes('recent'))) {
        score -= 1.0;
      }
    }

    const normalizedScore = score / Math.sqrt(targetTokens.length * cleanTokens.length);

    if (normalizedScore > highestScore) {
      highestScore = normalizedScore;
      bestKey = targetKey;
    }
  }

  if (highestScore > 0.25) {
    return bestKey;
  }

  return cleanUnderscore;
}

function parseDateString(val: any): string | null {
  const formatDate = (date: Date): string | null => {
    if (isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  if (!val) return null;
  if (val instanceof Date) return formatDate(val);
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return formatDate(date);
  }
  
  const str = String(val).trim();
  if (str === '') return null;
  
  // Try custom parts parsing (DD-MM-YYYY or YYYY-MM-DD) first to avoid incorrect parsing by Native JS parser
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    
    if (p2 > 1000) {
      const date = new Date(p2, p1 - 1, p0);
      return formatDate(date);
    }
    if (p0 > 1000) {
      const date = new Date(p0, p1 - 1, p2);
      return formatDate(date);
    }
  }

  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    return formatDate(new Date(parsed));
  }
  
  return null;
}

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
    (val) => parseDateString(val) ?? '',
    z.string().refine((val) => val !== '', {
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
      const iso = parseDateString(val);
      return iso ? new Date(iso) : undefined;
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
    transformHeader: (header) => canonicalizeKey(header),
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
      const normalizedKey = canonicalizeKey(key);
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
