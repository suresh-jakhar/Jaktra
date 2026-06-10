import { useState } from 'react';
import type { Communication } from '../../types/api';
import { Mail, MessageSquare, ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface CommunicationListProps {
  communications: Communication[];
}

export function CommunicationList({ communications }: CommunicationListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (communications.length === 0) {
    return (
      <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
        <MessageSquare className="h-8 w-8 text-slate-400 mx-auto mb-3" />
        <h3 className="text-sm font-medium text-slate-900">No communications</h3>
        <p className="text-sm text-slate-500 mt-1">No emails or messages have been sent for this invoice yet.</p>
      </div>
    );
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'opened':
      case 'clicked':
      case 'sent':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
            <Clock className="w-3 h-3 mr-1" />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {communications.map((comm) => (
        <div key={comm.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm transition-all">
          {/* Header Row (Always visible) */}
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
            onClick={() => toggleExpand(comm.id)}
          >
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-900 flex items-center">
                  {comm.subject || 'No Subject'}
                </h4>
                <div className="flex items-center mt-1 text-xs text-slate-500 space-x-3">
                  <span>To: {comm.recipient}</span>
                  <span>•</span>
                  <span>{new Date(comm.createdAt).toLocaleString(undefined, {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                  })}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {getStatusBadge(comm.status)}
              <div className="text-slate-400">
                {expandedId === comm.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </div>
          </div>

          {/* Expanded Body */}
          {expandedId === comm.id && (
            <div className="border-t border-slate-200 bg-slate-50 p-4 animate-in slide-in-from-top-2 duration-200">
              {comm.errorMsg && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                  <span className="font-semibold">Delivery Error:</span> {comm.errorMsg}
                </div>
              )}
              
              <div className="flex justify-between items-center mb-3">
                <h5 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Message Body</h5>
                {comm.providerMessageId && (
                  <span className="text-xs text-slate-400 font-mono" title="Provider Message ID">
                    ID: {comm.providerMessageId.substring(0, 12)}...
                  </span>
                )}
              </div>
              
              <div className="bg-white border border-slate-200 rounded-md p-4 text-sm text-slate-800 font-sans shadow-inner overflow-auto max-h-[500px]">
                {/* Render HTML if it contains HTML tags, otherwise text */}
                {comm.body && (comm.body.includes('<html') || comm.body.includes('<div') || comm.body.includes('<p>')) ? (
                  <div dangerouslySetInnerHTML={{ __html: comm.body }} />
                ) : (
                  <pre className="whitespace-pre-wrap font-sans">{comm.body}</pre>
                )}
              </div>
              
              {/* Detailed Timestamps footer */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                {comm.sentAt && (
                  <div>Sent: <span className="font-medium text-slate-700">{new Date(comm.sentAt).toLocaleString()}</span></div>
                )}
                {comm.deliveredAt && (
                  <div>Delivered: <span className="font-medium text-slate-700">{new Date(comm.deliveredAt).toLocaleString()}</span></div>
                )}
                {comm.openedAt && (
                  <div>Opened: <span className="font-medium text-slate-700">{new Date(comm.openedAt).toLocaleString()}</span></div>
                )}
                {comm.clickedAt && (
                  <div>Clicked: <span className="font-medium text-slate-700">{new Date(comm.clickedAt).toLocaleString()}</span></div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
