import { api } from './api';
import type { TeamMember, TeamInvitation } from '../types/api';

export const teamService = {
  async getMembers(): Promise<TeamMember[]> {
    const { data } = await api.get('/team/members');
    return data;
  },

  async getInvitations(): Promise<TeamInvitation[]> {
    const { data } = await api.get('/team/invitations');
    return data;
  },

  async inviteMember(email: string, role: 'admin' | 'manager' | 'viewer'): Promise<TeamInvitation> {
    const { data } = await api.post('/team/invitations', { email, role });
    return data;
  },

  async resendInvitation(id: string): Promise<TeamInvitation> {
    const { data } = await api.post(`/team/invitations/${id}/resend`);
    return data;
  },

  async revokeInvitation(id: string): Promise<void> {
    await api.delete(`/team/invitations/${id}`);
  },

  async removeMember(id: string): Promise<void> {
    await api.delete(`/team/members/${id}`);
  },

  async updateMemberRole(id: string, role: 'admin' | 'manager' | 'viewer'): Promise<void> {
    await api.put(`/team/members/${id}/role`, { role });
  },

  async acceptInvitation(token: string, name: string, password: string): Promise<void> {
    await api.post('/team/accept-invitation', { token, name, password });
  }
};
