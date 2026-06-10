import { api } from './api';
import type { AnalyticsSummary, AgingTier, AgentPerformance, EmailVolume, ChannelBreakdown, TierEffectiveness, CommunicationStats } from '../types/api';

export const analyticsService = {
  getSummary: async (): Promise<AnalyticsSummary> => {
    const response = await api.get('/analytics/summary');
    return response.data;
  },
  getAging: async (): Promise<AgingTier[]> => {
    const response = await api.get('/analytics/aging');
    return response.data;
  },
  getAgentPerformance: async (): Promise<AgentPerformance> => {
    const response = await api.get('/analytics/agent/performance');
    return response.data;
  },
  getEmailVolume: async (): Promise<EmailVolume[]> => {
    const response = await api.get('/analytics/agent/email-volume');
    return response.data;
  },
  getChannelBreakdown: async (): Promise<ChannelBreakdown[]> => {
    const response = await api.get('/analytics/agent/channel-breakdown');
    return response.data;
  },
  getTierEffectiveness: async (): Promise<TierEffectiveness[]> => {
    const response = await api.get('/analytics/agent/tier-effectiveness');
    return response.data;
  },
  getCommunicationStats: async (): Promise<CommunicationStats> => {
    const response = await api.get('/analytics/agent/communication-stats');
    return response.data;
  },
};
