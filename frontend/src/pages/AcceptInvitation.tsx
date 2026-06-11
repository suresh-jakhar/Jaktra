import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { teamService } from '../services/team';
import { Card, CardContent } from '../components/ui/Card';
import { Loader2, MailCheck, AlertCircle, ShieldCheck } from 'lucide-react';
import { z } from 'zod';

export function AcceptInvitation() {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const tokenMatch = hash.match(/token=([^&]+)/);
    
    if (tokenMatch && tokenMatch[1]) {
      setToken(tokenMatch[1]);
      window.history.replaceState(null, '', window.location.pathname);
    } else {
      setError('Invalid or missing invitation token.');
    }
  }, []);

  const acceptSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  });

  const mutation = useMutation({
    mutationFn: () => teamService.acceptInvitation(token!, name, password),
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 2000);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to accept invitation. It may have expired or been revoked.');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Invalid invitation token.');
      return;
    }

    const parsed = acceptSchema.safeParse({ name, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    mutation.mutate();
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <Card>
            <CardContent className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                <ShieldCheck className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Invitation Accepted!</h2>
              <p className="text-slate-600">Your account has been created successfully.</p>
              <p className="text-sm text-slate-500 mt-6 flex items-center">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Redirecting to login...
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center mb-6">
          <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <MailCheck className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900">
          Join the Team
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Set up your profile to accept the invitation
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <form onSubmit={handleSubmit}>
            <CardContent className="pt-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
                  <AlertCircle className="w-5 h-5 text-red-600 mr-2 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 block">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  disabled={!token || mutation.isPending}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="Jane Doe"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 block">
                  Password
                </label>
                <input
                  type="password"
                  required
                  disabled={!token || mutation.isPending}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-500"
                  placeholder="••••••••"
                  minLength={8}
                />
                <p className="text-xs text-slate-500">Must be at least 8 characters long.</p>
              </div>
            </CardContent>
            <div className="bg-slate-50 border-t px-6 py-4 rounded-b-lg">
              <button
                type="submit"
                disabled={!token || mutation.isPending}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  'Accept Invitation'
                )}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
