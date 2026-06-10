import { api } from './api';
import type { AgentRunsResponse } from '../types/api';

export const agentService = {
  getRuns: async (): Promise<AgentRunsResponse> => {
    const response = await api.get('/agent/runs');
    return response.data;
  },
};
