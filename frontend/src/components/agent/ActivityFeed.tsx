import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { eventService } from '../../services/event';
import { RefreshCw, FileText, Send, Mail, AlertTriangle, CheckCircle2, MessageSquare, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { InvoiceEvent } from '../../types/api';

interface ActivityFeedProps {
  isRunning: boolean;
}

export function ActivityFeed({ isRunning }: ActivityFeedProps) {
  const [filter, setFilter] = useState<'all' | 'activity' | 'errors'>('all');

  const { data: events, isLoading, isFetching, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['agent-feed'],
    queryFn: () => eventService.getFeed(50),
    refetchInterval: isRunning ? 5000 : false, // Poll every 5s ONLY if running
  });

  const renderEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'invoice_created':
        return <FileText className="w-4 h-4 text-emerald-600" />;
      case 'email_sent':
        return <Send className="w-4 h-4 text-blue-600" />;
      case 'email_opened':
        return <Mail className="w-4 h-4 text-purple-600" />;
      case 'payment_received':
      case 'status_updated':
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'legal_escalated':
      case 'dlq_added':
      case 'halted':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <MessageSquare className="w-4 h-4 text-slate-600" />;
    }
  };

  const filteredEvents = (events || []).filter((e: InvoiceEvent) => {
    if (filter === 'all') return true;
    if (filter === 'errors') return ['halted', 'dlq_added', 'legal_escalated'].includes(e.eventType);
    if (filter === 'activity') return ['email_sent', 'email_generated', 'email_opened', 'payment_received'].includes(e.eventType);
    return true;
  });

  const lastRefreshStr = dataUpdatedAt 
    ? new Date(dataUpdatedAt).toLocaleTimeString() 
    : '--:--';

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-slate-100 bg-slate-50 gap-3">
        <div>
          <h3 className="font-semibold text-slate-900 flex items-center">
            Recent Activity
            {isRunning && (
              <span className="ml-2 flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {isRunning ? 'Auto-refreshing (live)' : `Last Refresh: ${lastRefreshStr}`}
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as any)}
            className="text-xs border-slate-200 rounded-md py-1.5 pl-2 pr-8 focus:ring-blue-500 focus:border-blue-500 text-slate-700 bg-white shadow-sm"
          >
            <option value="all">All Events</option>
            <option value="activity">Activity Only</option>
            <option value="errors">Errors / Halted</option>
          </select>
          
          <button 
            onClick={() => refetch()}
            disabled={isFetching || isRunning}
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:opacity-50"
            title="Manual Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[600px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm">No activity found for this filter.</p>
          </div>
        ) : (
          <div className="relative border-l border-slate-200 ml-3 space-y-6 py-2">
            {filteredEvents.map((event) => (
              <div key={event.id} className="relative pl-6 group">
                <div className="absolute -left-3.5 top-1 h-7 w-7 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                  {renderEventIcon(event.eventType)}
                </div>
                
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-sm text-slate-900 capitalize">
                        {event.eventType.replace(/_/g, ' ')}
                      </span>
                      {event.invoiceNo && (
                        <Link to={`/invoices/${event.invoiceId}`} className="text-xs text-blue-600 hover:underline font-mono bg-blue-50 px-1.5 py-0.5 rounded">
                          {event.invoiceNo}
                        </Link>
                      )}
                    </div>
                    {event.payload?.error && (
                      <p className="text-xs text-red-600 mt-1">{event.payload.error}</p>
                    )}
                    {event.payload?.subject && (
                      <p className="text-xs text-slate-600 mt-1 truncate max-w-[250px] sm:max-w-[400px]">
                        Subject: {event.payload.subject}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] sm:text-xs text-slate-500 font-medium whitespace-nowrap">
                    {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
