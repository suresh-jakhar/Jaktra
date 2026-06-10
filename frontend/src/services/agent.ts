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

  runAgent: async (dryRun: boolean = false): Promise<AgentRun> => {
    const response = await api.post('/agent/run', { dryRun });
    return response.data;
  },

  runAgentForInvoice: async (invoiceId: string) => {
    const response = await api.post(`/agent/run/invoice/${invoiceId}`);
    return response.data;
  },
};
