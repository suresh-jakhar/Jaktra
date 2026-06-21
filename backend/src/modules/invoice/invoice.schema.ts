import { z } from 'zod';
import { paymentStatusEnum, urgencyTierEnum } from '../../db/schema.js';

export const createInvoiceSchema = z.object({
  invoiceNo: z.string().min(1, 'Invoice number is required'),
  clientName: z.string().min(1, 'Client name is required'),
  invoiceAmount: z.number().positive('Amount must be positive'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD'),
  contactEmail: z.string().email('Invalid email address'),
  subject: z.string().max(500).optional(),
});

export const bulkCreateInvoiceSchema = z.object({
  invoices: z.array(createInvoiceSchema).min(1, 'At least one invoice is required'),
});

export const updateInvoiceSchema = z.object({
  clientName: z.string().min(1).optional(),
  invoiceAmount: z.number().positive().optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  contactEmail: z.string().email().optional(),
  subject: z.string().max(500).optional().nullable(),
});

export const updateInvoiceStatusSchema = z.object({
  paymentStatus: z.enum(paymentStatusEnum.enumValues),
});

export const listInvoicesSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
  sort_by: z.enum(['dueDate', 'invoiceAmount', 'createdAt', 'clientName', 'invoiceNo']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  urgency_tier: z.union([z.string(), z.array(z.string())]).optional(),
  client_name: z.string().optional(),
  days_overdue_min: z.coerce.number().optional(),
  days_overdue_max: z.coerce.number().optional(),
});

