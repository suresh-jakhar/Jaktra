import { api } from './api';
import type { TenantSettings, IntegrationsResponse } from '../types/api';

export const settingsService = {
  getSettings: async (): Promise<TenantSettings> => {
    const response = await api.get('/settings');
    return response.data;
  },

  updateSettings: async (data: Partial<TenantSettings>): Promise<TenantSettings> => {
    const response = await api.patch('/settings', data);
    return response.data;
  },

  getIntegrations: async (): Promise<IntegrationsResponse> => {
    const response = await api.get('/settings/integrations');
    return response.data;
  },

  saveSendgridKey: async (apiKey: string): Promise<{ message: string }> => {
    const response = await api.post('/settings/integrations/sendgrid', { apiKey });
    return response.data;
  },

  disconnectSendgrid: async (): Promise<void> => {
    await api.delete('/settings/integrations/sendgrid');
  },

  testEmail: async (to: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/settings/integrations/sendgrid/test', { to });
    return response.data;
  },

  saveSmtpConfig: async (config: any): Promise<{ message: string }> => {
    const response = await api.post('/settings/integrations/smtp', config);
    return response.data;
  },

  disconnectSmtp: async (): Promise<void> => {
    await api.delete('/settings/integrations/smtp');
  },

  testSmtpEmail: async (to: string): Promise<{ success: boolean; message: string }> => {
    const response = await api.post('/settings/integrations/smtp/test', { to });
    return response.data;
  },

  setDefaultProvider: async (provider: 'sendgrid' | 'smtp' | null): Promise<{ message: string }> => {
    const response = await api.patch('/settings/integrations/default-provider', { provider });
    return response.data;
  },

  saveRazorpayKey: async (data: { keyId: string; keySecret: string; webhookSecret: string }): Promise<{ message: string }> => {
    const response = await api.post('/settings/integrations/razorpay', data);
    return response.data;
  },

  disconnectRazorpay: async (): Promise<void> => {
    await api.delete('/settings/integrations/razorpay');
  },
};
