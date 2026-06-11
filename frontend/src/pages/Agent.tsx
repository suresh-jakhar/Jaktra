import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentService } from '../services/agent';
import { RunList } from '../components/agent/RunList';
import { ActivityFeed } from '../components/agent/ActivityFeed';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { useAuth } from '../contexts/AuthContext';
import { Bot, Play, AlertCircle, Loader2 } from 'lucide-react';

export function Agent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: runsResponse, isLoading } = useQuery({
    queryKey: ['agent-runs'],
    queryFn: agentService.getRuns,
    refetchInterval: 10000, // Poll every 10 seconds for updates
  });

  const runMutation = useMutation({
    mutationFn: () => agentService.runAgent(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-runs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['agent-feed'] });
    },
  });

  const handleRunAgent = () => {
    runMutation.mutate();
  };

  const isRunning = runsResponse?.runs[0]?.status === 'running' || runMutation.isPending;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center">
            <Bot className="w-8 h-8 text-blue-600 mr-3" />
            AI Agent Control
          </h1>
          <p className="text-slate-500 mt-1">Manage and monitor automated invoice processing and follow-ups.</p>
        </div>
        <div className="flex items-center space-x-4">
          {user?.role !== 'viewer' && (
            <button
              onClick={handleRunAgent}
              disabled={isRunning}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 bg-blue-600 text-white hover:bg-blue-700 h-10 px-6 py-2 disabled:opacity-50 shadow-sm"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Agent Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Agent Now
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {runMutation.isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium">Failed to start agent</h4>
            <p className="text-sm mt-1">{(runMutation.error as any)?.response?.data?.error?.message || runMutation.error.message}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Agent Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <div className="relative flex h-4 w-4">
                  {isRunning ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-blue-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-slate-300"></span>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-lg">
                    {isRunning ? 'Processing Batch...' : 'Idle / Ready'}
                  </p>
                  <p className="text-sm text-slate-500">
                    {isRunning ? 'Analyzing invoices and dispatching emails.' : 'Waiting for next scheduled run or manual trigger.'}
                  </p>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-slate-100">
                <p className="text-sm text-slate-500 mb-1">Total Invoices Processed (All Time)</p>
                <p className="text-2xl font-bold text-slate-900">
                  {runsResponse?.runs.reduce((acc, run) => acc + run.invoicesProcessed, 0) || 0}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Run History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                </div>
              ) : runsResponse && runsResponse.runs.length > 0 ? (
                <RunList runs={runsResponse.runs} />
              ) : (
                <div className="text-center py-12 text-slate-500">
                  <Bot className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p>No agent runs recorded yet.</p>
                  <p className="text-sm mt-1">Click "Run Agent Now" to trigger the first batch.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 h-[800px]">
          <ActivityFeed isRunning={isRunning} />
        </div>
      </div>
    </div>
  );
}
