import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { agentService } from '../../services/agent';
import type { AgentRun } from '../../types/api';
import { ChevronDown, ChevronUp, Clock, CheckCircle2, AlertTriangle, Send, FileText, Loader2, Info } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Link } from 'react-router-dom';

interface RunListProps {
  runs: AgentRun[];
}

export function RunList({ runs }: RunListProps) {
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedRunId(expandedRunId === id ? null : id);
  };

  const formatDuration = (start: string, end: string | null) => {
    if (!end) return 'Running...';
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const seconds = Math.floor((e - s) / 1000);
    if (seconds < 60) return `${seconds}s`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  };

  return (
    <div className="divide-y divide-slate-100">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
        <div className="col-span-3">Run Date</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2 text-center">Invoices</div>
        <div className="col-span-2 text-center">Emails</div>
        <div className="col-span-2 text-center">Errors</div>
        <div className="col-span-1 text-right">Dur</div>
      </div>

      {/* Table Body */}
      {runs.map((run) => (
        <div key={run.id} className="flex flex-col border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
          <div 
            className="grid grid-cols-12 gap-4 px-6 py-4 items-center cursor-pointer"
            onClick={() => toggleExpand(run.id)}
          >
            <div className="col-span-3 flex items-center text-sm font-medium text-slate-900">
              {expandedRunId === run.id ? (
                <ChevronUp className="w-4 h-4 mr-2 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 mr-2 text-slate-400" />
              )}
              {new Date(run.startTime).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </div>
            
            <div className="col-span-2">
              <Badge variant={
                run.status === 'completed' ? 'success' :
                run.status === 'running' ? 'warning' : 'danger'
              }>
                {run.status}
              </Badge>
            </div>
            
            <div className="col-span-2 text-center text-sm text-slate-600">
              {run.invoicesProcessed}
            </div>
            
            <div className="col-span-2 flex items-center justify-center text-sm text-slate-600">
              <Send className="w-3 h-3 mr-1.5 text-blue-500" />
              {run.emailsSent}
            </div>
            
            <div className="col-span-2 flex items-center justify-center text-sm">
              {run.errors > 0 ? (
                <span className="text-red-600 flex items-center font-medium bg-red-50 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {run.errors}
                </span>
              ) : (
                <span className="text-slate-400">0</span>
              )}
            </div>
            
            <div className="col-span-1 flex items-center justify-end text-xs text-slate-500">
              <Clock className="w-3 h-3 mr-1" />
              {formatDuration(run.startTime, run.endTime)}
            </div>
          </div>

          {/* Expanded Details Section */}
          {expandedRunId === run.id && (
            <div className="bg-white px-6 py-4 border-t border-slate-100 shadow-inner">
              <RunDetailsPanel run={run} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RunDetailsPanel({ run }: { run: AgentRun }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['agent-run-details', run.id],
    queryFn: () => agentService.getRunDetails(run.id),
    staleTime: 60000, // Cache for 1 min
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading run details...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-red-500 text-sm flex items-center py-4">
        <AlertTriangle className="w-4 h-4 mr-2" />
        Failed to load run details.
      </div>
    );
  }

  if (!data.events || data.events.length === 0) {
    return (
      <div className="text-slate-500 text-sm py-4 flex items-center">
        <Info className="w-4 h-4 mr-2" />
        No actions were taken during this run (no overdue invoices or all skipped).
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Invoice Processing Breakdown</h4>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {data.events.map((event, idx) => (
          <div key={idx} className="flex items-start p-3 border border-slate-200 rounded-md bg-slate-50">
            <div className="mt-0.5">
              {event.eventType === 'email_sent' || event.eventType === 'email_generated' ? (
                <CheckCircle2 className="w-4 h-4 text-green-500 mr-3" />
              ) : event.eventType === 'halted' ? (
                <AlertTriangle className="w-4 h-4 text-red-500 mr-3" />
              ) : (
                <FileText className="w-4 h-4 text-slate-400 mr-3" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <Link to={`/invoices/${event.invoiceId}`} className="text-sm font-medium text-blue-600 hover:underline truncate">
                  Invoice {event.invoiceId.substring(0, 8)}...
                </Link>
                <span className="text-xs text-slate-400 ml-2">{new Date(event.createdAt).toLocaleTimeString()}</span>
              </div>
              <p className="text-xs text-slate-600 mt-1 capitalize font-medium">
                {event.eventType.replace('_', ' ')}
              </p>
              {event.payload && typeof event.payload === 'object' && (
                <div className="mt-1.5 text-xs text-slate-500 bg-white p-2 rounded border border-slate-100 font-mono overflow-x-auto whitespace-nowrap">
                  {Object.entries(event.payload)
                    .filter(([k]) => k !== 'runId' && k !== 'bodyPreview')
                    .map(([k, v]) => (
                    <span key={k} className="mr-3">
                      <span className="text-slate-400">{k}:</span> <span className="text-slate-700">{String(v)}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
