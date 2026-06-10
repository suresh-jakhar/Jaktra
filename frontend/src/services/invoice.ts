import { api } from './api';
import type { Invoice, ListInvoicesParams, PaginatedResponse } from '../types/api';

export const invoiceService = {
  getInvoices: async (params: ListInvoicesParams = {}): Promise<PaginatedResponse<Invoice>> => {
    // Convert arrays to comma-separated strings for the backend
    const queryParams: Record<string, any> = { ...params };
    if (params.status && params.status.length > 0) {
      queryParams.status = params.status.join(',');
    }
    if (params.urgency_tier && params.urgency_tier.length > 0) {
      queryParams.urgency_tier = params.urgency_tier.join(',');
    }

    const response = await api.get('/invoices', { params: queryParams });
    return response.data;
  },
};
