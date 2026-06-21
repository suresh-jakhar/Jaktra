import type { InvoiceRepository } from '../invoice/invoice.repository.js';
import type { ParsedRow, RowError, CsvParseResult } from './csv-parser.service.js';
import { parseFileBuffer } from './csv-parser.service.js';

export type DuplicateStrategy = 'skip' | 'update';

export interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: RowError[];
}

export class InvoiceImportService {
  constructor(private invoiceRepo: InvoiceRepository) {}

  async importFromFile(
    buffer: Buffer,
    originalname: string,
    tenantId: string,
    duplicateStrategy: DuplicateStrategy = 'skip',
  ): Promise<ImportResult> {
    const { valid, errors }: CsvParseResult = parseFileBuffer(buffer, originalname);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of valid) {
      try {
        const outcome = await this.processRow(row, tenantId, duplicateStrategy);

        switch (outcome) {
          case 'created':
            imported++;
            break;
          case 'updated':
            updated++;
            break;
          case 'skipped':
            skipped++;
            break;
        }
      } catch (err: unknown) {
        errors.push({
          row: 0,
          invoiceNo: row.invoiceNo,
          errors: [err instanceof Error ? err.message : 'Unknown insertion error'],
        });
      }
    }

    return { imported, updated, skipped, errors };
  }

  private async processRow(
    row: ParsedRow,
    tenantId: string,
    duplicateStrategy: DuplicateStrategy,
  ): Promise<'created' | 'updated' | 'skipped'> {
    const existing = await this.invoiceRepo.findByInvoiceNo(row.invoiceNo, tenantId);

    if (existing && duplicateStrategy === 'skip') {
      return 'skipped';
    }

    if (existing && duplicateStrategy === 'update') {
      await this.invoiceRepo.upsertByInvoiceNo({
        tenantId,
        invoiceNo: row.invoiceNo,
        clientName: row.clientName,
        invoiceAmount: row.invoiceAmount,
        dueDate: row.dueDate,
        contactEmail: row.contactEmail,
        subject: row.subject ?? null,
        followupCount: row.followupCount,
        paymentStatus: row.paymentStatus,
        lastFollowupDate: row.lastFollowupDate ?? null,
      });
      return 'updated';
    }

    await this.invoiceRepo.create({
      tenantId,
      invoiceNo: row.invoiceNo,
      clientName: row.clientName,
      invoiceAmount: row.invoiceAmount,
      dueDate: row.dueDate,
      contactEmail: row.contactEmail,
      subject: row.subject ?? null,
      followupCount: row.followupCount,
      paymentStatus: row.paymentStatus,
      lastFollowupDate: row.lastFollowupDate ?? null,
    });
    return 'created';
  }
}
