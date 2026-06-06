import { DlqRepository } from '../repositories/dlq.repository.js';

export class DlqService {
  constructor(private dlqRepo: DlqRepository) {}

  async recordFailure(invoiceId: string, errorMsg: string) {
    return await this.dlqRepo.recordFailure(invoiceId, errorMsg);
  }

  async clearFailure(invoiceId: string) {
    return await this.dlqRepo.clearFailure(invoiceId);
  }

  async getDlqEntries() {
    return await this.dlqRepo.getAllEntries();
  }

  async getDlqStats() {
    return await this.dlqRepo.getStats();
  }
}
