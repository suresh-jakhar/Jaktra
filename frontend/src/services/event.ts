import { api } from './api';
import type { InvoiceEvent } from '../types/api';

export const eventService = {
  getInvoiceTimeline: async (invoiceId: string): Promise<InvoiceEvent[]> => {
    const response = await api.get(`/invoices/${invoiceId}/timeline`);
    return response.data;
  },
};
