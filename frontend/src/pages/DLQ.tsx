import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dlqService } from '../services/dlq';
import { agentService } from '../services/agent';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { AlertTriangle, MailX, RefreshCw, X, Loader2, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';


export function DLQ() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  const { data: dlqEntries, isLoading, isError } = useQuery({
    queryKey: ['dlq-entries'],
    queryFn: () => dlqService.getEntries(),
    refetchInterval: 30000,
  });

  const dismissMutation = useMutation({
    mutationFn: (invoiceId: string) => dlqService.deleteEntry(invoiceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dlq-entries'] });
      setDismissingId(null);
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      await agentService.runAgentForInvoice(invoiceId);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['dlq-entries'] });
      setRetryingId(null);
    },
  });

  const handleRetry = (invoiceId: string) => {
    setRetryingId(invoiceId);
    retryMutation.mutate(invoiceId);
  };

  const handleDismiss = (invoiceId: string) => {
    dismissMutation.mutate(invoiceId);
  };

  const entries = dlqEntries || [];
  const sortedEntries = [...entries].sort((a, b) => b.consecutiveFailures - a.consecutiveFailures);
  const criticalCount = entries.filter(e => e.consecutiveFailures >= 3).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center">
            <MailX className="w-8 h-8 text-red-600 mr-3" />
            Dead Letter Queue
          </h1>
          <p className="text-slate-500 mt-1">Manage and resolve invoices that failed to process automatically.</p>
        </div>
      </div>

      {criticalCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl flex items-start shadow-sm">
          <AlertTriangle className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-red-900">Critical Delivery Failures</h4>
            <p className="text-sm mt-1">
              You have {criticalCount} invoice(s) that have failed delivery 3 or more times. They require immediate manual intervention.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Failed Invoices</CardTitle>
          <CardDescription>Invoices are removed from this list when a follow-up is successfully processed.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium border-y border-slate-200">
                <tr>
                  <th className="px-6 py-4">Client & Invoice</th>
                  <th className="px-6 py-4">Failures</th>
                  <th className="px-6 py-4">Last Error</th>
                  <th className="px-6 py-4 whitespace-nowrap">Last Attempt</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-slate-300" />
                      Loading queue...
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-red-500">Failed to load Dead Letter Queue.</td>
                  </tr>
                ) : sortedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                      <MailX className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-lg font-medium text-slate-700">Queue is empty</p>
                      <p className="text-sm mt-1">No failed invoices found. Everything is healthy!</p>
                    </td>
                  </tr>
                ) : (
                  sortedEntries.map((entry) => {
                    const isRetrying = retryingId === entry.invoiceId;
                    
                    return (
                      <tr key={entry.invoiceId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <Link to={`/invoices/${entry.invoiceId}`} className="font-medium text-blue-600 hover:text-blue-800 hover:underline flex items-center group truncate max-w-[250px]">
                            {entry.clientName || 'Unknown Client'}
                            <ArrowRight className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          <div className="text-xs text-slate-500 font-normal mt-0.5">
                            {entry.invoiceNo || entry.invoiceId.substring(0, 8)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.consecutiveFailures >= 3 ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {entry.consecutiveFailures} {entry.consecutiveFailures === 1 ? 'time' : 'times'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-600">
                          <div className="truncate max-w-[300px]" title={entry.lastError || 'Unknown Error'}>
                            {entry.lastError || 'Unknown Error'}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                          {new Date(entry.lastFailure).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end items-center space-x-2">
                            {isRetrying ? (
                              <button disabled className="inline-flex items-center justify-center rounded-md text-xs font-medium bg-slate-100 text-slate-500 px-3 py-1.5 opacity-70 cursor-not-allowed">
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                Retrying...
                              </button>
                            ) : (
                              user?.role !== 'viewer' && (
                                <>
                                  <button
                                    onClick={() => handleRetry(entry.invoiceId)}
                                    disabled={retryingId !== null || dismissingId !== null}
                                    className="inline-flex items-center justify-center rounded-md text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                    Retry Processing
                                  </button>
                                  <button
                                    onClick={() => setDismissingId(entry.invoiceId)}
                                    disabled={retryingId !== null || dismissingId !== null}
                                    className="inline-flex items-center justify-center rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 px-3 py-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:opacity-50"
                                  >
                                    <X className="w-3.5 h-3.5 mr-1" />
                                    Dismiss
                                  </button>
                                </>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dismiss Confirmation Dialog */}
      {dismissingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Dismiss DLQ Entry?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Invoice <strong>{entries.find(e => e.invoiceId === dismissingId)?.invoiceNo || dismissingId.substring(0, 8)}</strong> will be removed from the queue. This does not fix the underlying issue.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDismissingId(null)}
                disabled={dismissMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDismiss(dismissingId)}
                disabled={dismissMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 inline-flex items-center"
              >
                {dismissMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
