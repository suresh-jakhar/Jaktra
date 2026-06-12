import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '../../services/settings';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../components/ui/Card';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function IntegrationsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    keyId: '',
    keySecret: '',
    webhookSecret: ''
  });
  const [errorMsg, setErrorMsg] = useState('');

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => settingsService.getIntegrations(),
    retry: false,
  });

  const saveMutation = useMutation({
    mutationFn: (data: typeof formData) => settingsService.saveRazorpayKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setIsEditing(false);
      setFormData({ keyId: '', keySecret: '', webhookSecret: '' });
      setErrorMsg('');
    },
    onError: (err: any) => {
      const errorData = err.response?.data?.error;
      let msg = 'Failed to save Razorpay settings.';
      if (typeof errorData === 'string') {
        msg = errorData;
      } else if (errorData?.message) {
        msg = errorData.message;
      } else if (err.response?.data?.message) {
        msg = err.response.data.message;
      }
      setErrorMsg(msg);
    }
  });

  const disconnectMutation = useMutation({
    mutationFn: () => settingsService.disconnectRazorpay(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setIsEditing(true);
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const razorpay = integrations?.razorpay;
  const isConfigured = razorpay?.isConfigured;

  const handleSave = () => {
    if (!formData.keyId || !formData.keySecret || !formData.webhookSecret) {
      setErrorMsg('Please fill in all fields.');
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment Gateways</CardTitle>
          <CardDescription>Connect payment providers to automatically generate payment links and reconcile payments.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-slate-200 rounded-md p-6 bg-white">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-lg font-medium text-slate-900 flex items-center">
                  Razorpay
                  {isConfigured && <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-2" />}
                </h3>
                <p className="text-sm text-slate-500 mt-1">Accept payments via cards, UPI, and netbanking in India.</p>
              </div>
              {isConfigured && !isEditing && (
                <div className="flex space-x-3">
                  <button onClick={() => setIsEditing(true)} className="text-sm font-medium text-blue-600 hover:text-blue-700">Update</button>
                  <button onClick={() => disconnectMutation.mutate()} className="text-sm font-medium text-red-600 hover:text-red-700">Disconnect</button>
                </div>
              )}
            </div>

            {isConfigured && !isEditing ? (
              <div className="bg-slate-50 p-4 rounded-md border border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-700">Connected Account</p>
                  <p className="text-xs text-slate-500 mt-1">Key ID: •••••••••••{razorpay.maskedKeyId?.slice(-4)}</p>
                  <div className="mt-3">
                    <p className="text-xs text-slate-500 font-medium">Webhook URL for Razorpay:</p>
                    <code className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded block mt-1 break-all select-all border border-slate-300">
                      https://&lt;your-ngrok-url&gt;/api/webhooks/payments/{user?.tenantId}/razorpay
                    </code>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-700">Webhook Status</p>
                  <div className="flex items-center mt-1 text-xs">
                    {razorpay.lastWebhookReceivedAt ? (
                      <span className="text-emerald-600 flex items-center">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Last received: {new Date(razorpay.lastWebhookReceivedAt).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-amber-600 flex items-center">
                        <AlertTriangle className="w-3 h-3 mr-1" /> Waiting for first webhook
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Key ID</label>
                    <input
                      type="text"
                      value={formData.keyId}
                      onChange={(e) => setFormData(prev => ({ ...prev, keyId: e.target.value }))}
                      className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="rzp_live_xxxxxxxxxxxx"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Key Secret</label>
                    <input
                      type="password"
                      value={formData.keySecret}
                      onChange={(e) => setFormData(prev => ({ ...prev, keySecret: e.target.value }))}
                      className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="••••••••••••••••••••"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Webhook Secret</label>
                  <input
                    type="password"
                    value={formData.webhookSecret}
                    onChange={(e) => setFormData(prev => ({ ...prev, webhookSecret: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="Your webhook secret"
                  />
                  <p className="text-xs text-slate-500">
                    Configure your Razorpay webhook to send `payment.captured` events to: <br/>
                    <code className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded inline-block mt-1 break-all select-all border border-slate-300">
                      https://&lt;your-ngrok-url&gt;/api/webhooks/payments/{user?.tenantId}/razorpay
                    </code>
                  </p>
                </div>

                {errorMsg && <p className="text-sm text-red-600 font-medium">{errorMsg}</p>}

                <div className="flex justify-end pt-2 space-x-3">
                  {isConfigured && (
                    <button 
                      onClick={() => { setIsEditing(false); setErrorMsg(''); }}
                      className="px-4 py-2 text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-md text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 flex items-center"
                  >
                    {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Connect Razorpay
                  </button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
