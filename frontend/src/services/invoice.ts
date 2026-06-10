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

  createInvoice: async (data: Omit<Invoice, 'id' | 'tenantId' | 'paymentStatus' | 'followupCount' | 'createdAt' | 'updatedAt' | 'lastFollowupDate' | 'urgencyTier' | 'daysOverdue' | 'invoiceAmount'> & { invoiceAmount: number | string }) => {
    const response = await api.post('/invoices', data);
    return response.data;
  },

  getInvoice: async (id: string): Promise<Invoice> => {
    const response = await api.get(`/invoices/${id}`);
    return response.data;
  },

  updateInvoice: async (id: string, data: Partial<Omit<Invoice, 'invoiceAmount'>> & { invoiceAmount?: number | string }) => {
    const response = await api.patch(`/invoices/${id}`, data);
    return response.data;
  },

  updateInvoiceStatus: async (id: string, status: string) => {
    const response = await api.patch(`/invoices/${id}/status`, { paymentStatus: status });
    return response.data;
  },

  importInvoices: async (file: File, strategy: 'skip' | 'update') => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/invoices/import?on_duplicate=${strategy}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
