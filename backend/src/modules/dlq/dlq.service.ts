import { DlqRepository } from './dlq.repository.js';

export class DlqService {
  constructor(private dlqRepo: DlqRepository) {}

  async recordFailure(invoiceId: string, errorMsg: string) {
    return await this.dlqRepo.recordFailure(invoiceId, errorMsg);
  }

  async clearFailure(invoiceId: string, tenantId: string) {
    return await this.dlqRepo.clearFailure(invoiceId, tenantId);
  }

  async getDlqEntries(tenantId: string) {
    return await this.dlqRepo.getAllEntries(tenantId);
  }

  async getDlqStats(tenantId: string) {
    return await this.dlqRepo.getStats(tenantId);
  }
}
