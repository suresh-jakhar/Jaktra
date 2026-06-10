import { api } from './api';
import type { DlqEntry } from '../types/api';

export const dlqService = {
  getEntries: async (): Promise<DlqEntry[]> => {
    const response = await api.get('/dlq');
    return response.data;
  },
};
