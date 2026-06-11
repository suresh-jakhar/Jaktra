import { api } from './api';
import type { TenantSettings } from '../types/api';

export const settingsService = {
  getSettings: async (): Promise<TenantSettings> => {
    const response = await api.get('/settings');
    return response.data;
  },

  updateSettings: async (data: Partial<TenantSettings>): Promise<TenantSettings> => {
    const response = await api.patch('/settings', data);
    return response.data;
  },

  getIntegrations: async () => {
    const response = await api.get('/settings/integrations');
    return response.data;
  },
};
