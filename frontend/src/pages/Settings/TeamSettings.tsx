import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamService } from '../../services/team';
import { useAuth } from '../../contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/Card';
import { Loader2, UserPlus, ShieldAlert, MailX, Check, X, Shield, RefreshCw, Trash2 } from 'lucide-react';
import type { TeamMember, TeamInvitation } from '../../types/api';
import { z } from 'zod';

export function TeamSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isManagerOrAdmin = isAdmin || user?.role === 'manager';

  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  const { data: members, isLoading: loadingMembers } = useQuery({
    queryKey: ['team', 'members'],
    queryFn: teamService.getMembers,
    enabled: isManagerOrAdmin,
  });

  const { data: invitations } = useQuery({
    queryKey: ['team', 'invitations'],
    queryFn: teamService.getInvitations,
    enabled: isManagerOrAdmin,
  });

  if (!isManagerOrAdmin) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center justify-center text-center">
          <ShieldAlert className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Access Denied</h3>
          <p className="text-slate-500 mt-1">You need to be an admin or manager to view team settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <div>
            <CardTitle>Active Members</CardTitle>
            <CardDescription>Manage your team members and their roles.</CardDescription>
          </div>
          {isAdmin && (
            <button
              onClick={() => setInviteModalOpen(true)}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 bg-blue-600 text-white shadow hover:bg-blue-700 h-9 px-4 py-2"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Member
            </button>
          )}
        </CardHeader>
        <CardContent className="pt-6">
          {loadingMembers ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : members?.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No active members found.</p>
          ) : (
            <div className="divide-y divide-slate-100 border rounded-md">
              {members?.map(member => (
                <MemberRow key={member.id} member={member} isAdmin={isAdmin} currentUserId={user?.id} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {isManagerOrAdmin && invitations && invitations.length > 0 && (
        <Card>
          <CardHeader className="border-b pb-4">
            <CardTitle>Pending Invitations</CardTitle>
            <CardDescription>Invitations that haven't been accepted yet.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="divide-y divide-slate-100 border rounded-md">
              {invitations.map(invite => (
                <InvitationRow key={invite.id} invite={invite} isAdmin={isAdmin} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {inviteModalOpen && (
        <InviteModal onClose={() => setInviteModalOpen(false)} />
      )}
    </div>
  );
}

function MemberRow({ member, isAdmin, currentUserId }: { member: TeamMember, isAdmin: boolean, currentUserId?: string }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [role, setRole] = useState(member.role);
  const isSelf = member.id === currentUserId;

  const updateMutation = useMutation({
    mutationFn: () => teamService.updateMemberRole(member.id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'members'] });
      setIsEditing(false);
    }
  });

  const removeMutation = useMutation({
    mutationFn: () => teamService.removeMember(member.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'members'] });
    }
  });

  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50/50">
      <div className="flex flex-col">
        <span className="font-medium text-slate-900">{member.name} {isSelf && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-2">You</span>}</span>
        <span className="text-sm text-slate-500">{member.email}</span>
      </div>
      <div className="flex items-center gap-4">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="text-sm border rounded-md px-2 py-1"
            >
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
            <button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            </button>
            <button onClick={() => { setIsEditing(false); setRole(member.role); }} className="text-slate-500 hover:bg-slate-100 p-1 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <>
            <span className="text-sm px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 capitalize">
              {member.role}
            </span>
            {isAdmin && !isSelf && (
              <div className="flex items-center gap-1">
                <button onClick={() => setIsEditing(true)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Change Role">
                  <Shield className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => {
                    if (confirm(`Are you sure you want to remove ${member.name}?`)) {
                      removeMutation.mutate();
                    }
                  }} 
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" 
                  title="Remove Member"
                  disabled={removeMutation.isPending}
                >
                  {removeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InvitationRow({ invite, isAdmin }: { invite: TeamInvitation, isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const isExpired = new Date(invite.expiresAt) < new Date();

  const resendMutation = useMutation({
    mutationFn: () => teamService.resendInvitation(invite.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations'] });
      alert('Invitation resent successfully');
    }
  });

  const revokeMutation = useMutation({
    mutationFn: () => teamService.revokeInvitation(invite.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations'] });
    }
  });

  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50/50">
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{invite.email}</span>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 rounded-full border">Role: {invite.role}</span>
        </div>
        <span className="text-sm text-slate-500 flex items-center mt-1">
          Sent: {new Date(invite.createdAt).toLocaleDateString()}
          <span className="mx-2">•</span>
          Status: <span className={`ml-1 capitalize ${invite.deliveryStatus === 'failed' ? 'text-red-600' : 'text-slate-600'}`}>{invite.deliveryStatus}</span>
          {isExpired && <span className="ml-2 text-orange-600 flex items-center text-xs"><ShieldAlert className="w-3 h-3 mr-1"/> Expired</span>}
        </span>
      </div>
      {isAdmin && (
        <div className="flex items-center gap-1">
          <button 
            onClick={() => resendMutation.mutate()} 
            disabled={resendMutation.isPending}
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" 
            title="Resend Invitation"
          >
            {resendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
          <button 
            onClick={() => {
              if (confirm('Are you sure you want to revoke this invitation?')) {
                revokeMutation.mutate();
              }
            }} 
            disabled={revokeMutation.isPending}
            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded" 
            title="Revoke Invitation"
          >
            {revokeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MailX className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'manager' | 'viewer'>('viewer');
  const [error, setError] = useState('');

  const inviteSchema = z.object({
    email: z.string().email('Invalid email address'),
  });

  const mutation = useMutation({
    mutationFn: () => teamService.inviteMember(email, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to send invitation');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const parsed = inviteSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Invite Team Member</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="colleague@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="viewer">Viewer (Read-only)</option>
              <option value="manager">Manager (Can manage invoices and views team)</option>
              <option value="admin">Admin (Full access)</option>
            </select>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50 flex items-center"
            >
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Invitation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
