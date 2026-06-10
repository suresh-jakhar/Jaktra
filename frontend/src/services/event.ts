import { api } from './api';
import type { InvoiceEvent } from '../types/api';

export const eventService = {
  getInvoiceTimeline: async (invoiceId: string): Promise<InvoiceEvent[]> => {
    const response = await api.get(`/events/invoices/${invoiceId}/timeline`);
    return response.data;
  },

  getFeed: async (limit: number = 50): Promise<InvoiceEvent[]> => {
    const response = await api.get(`/events/feed?limit=${limit}`);
    return response.data;
  },
};
