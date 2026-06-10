import { api } from './api';
import type { AgentRunsResponse } from '../types/api';

export const agentService = {
  getRuns: async (): Promise<AgentRunsResponse> => {
    const response = await api.get('/agent/runs');
    return response.data;
  },

  runAgentForInvoice: async (invoiceId: string) => {
    const response = await api.post(`/agent/run/invoice/${invoiceId}`);
    return response.data;
  },
};
