import { api } from './api';
import type { Communication } from '../types/api';

export const communicationService = {
  getInvoiceCommunications: async (invoiceId: string): Promise<Communication[]> => {
    const response = await api.get(`/settings/communication/invoices/${invoiceId}/communications`);
    return response.data;
  },
};
