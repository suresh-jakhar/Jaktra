import { api } from './api';
import type { AgentRunsResponse, AgentRunDetail, AgentRun } from '../types/api';

export const agentService = {
  getRuns: async (): Promise<AgentRunsResponse> => {
    const response = await api.get('/agent/runs');
    return response.data;
  },

  getRunDetails: async (runId: string): Promise<AgentRunDetail> => {
    const response = await api.get(`/agent/runs/${runId}`);
    return response.data;
  },

  runAgent: async (tone?: string): Promise<AgentRun> => {
    const response = await api.post('/agent/run', { tone });
    return response.data;
  },

  runAgentForInvoice: async (invoiceId: string, tone?: string) => {
    const response = await api.post(`/agent/run/invoice/${invoiceId}`, { tone });
    return response.data;
  },
};
