import type { Communication } from '../../types/api';
import { Mail, MousePointerClick, Send, CheckCircle } from 'lucide-react';

interface CommunicationStatsProps {
  communications: Communication[];
}

export function CommunicationStats({ communications }: CommunicationStatsProps) {
  if (communications.length === 0) return null;

  const total = communications.length;
  const delivered = communications.filter(c => c.status !== 'failed' && c.status !== 'pending').length;
  const opened = communications.filter(c => c.openedAt || c.status === 'opened' || c.status === 'clicked').length;
  const clicked = communications.filter(c => c.clickedAt || c.status === 'clicked').length;

  const deliveredRate = total > 0 ? Math.round((delivered / total) * 100) : 0;
  const openRate = delivered > 0 ? Math.round((opened / delivered) * 100) : 0;
  const clickRate = delivered > 0 ? Math.round((clicked / delivered) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
      <div className="flex flex-col">
        <span className="text-sm text-slate-500 flex items-center mb-1">
          <Send className="w-4 h-4 mr-1.5 text-slate-400" /> Total Sent
        </span>
        <span className="text-2xl font-bold text-slate-900">{total}</span>
      </div>
      
      <div className="flex flex-col border-l border-slate-100 pl-4">
        <span className="text-sm text-slate-500 flex items-center mb-1">
          <CheckCircle className="w-4 h-4 mr-1.5 text-green-500" /> Delivered
        </span>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900">{delivered}</span>
          <span className="text-sm font-medium text-slate-400">{deliveredRate}%</span>
        </div>
      </div>
      
      <div className="flex flex-col border-l border-slate-100 pl-4">
        <span className="text-sm text-slate-500 flex items-center mb-1">
          <Mail className="w-4 h-4 mr-1.5 text-blue-500" /> Opened
        </span>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900">{opened}</span>
          <span className="text-sm font-medium text-slate-400">{openRate}%</span>
        </div>
      </div>
      
      <div className="flex flex-col border-l border-slate-100 pl-4">
        <span className="text-sm text-slate-500 flex items-center mb-1">
          <MousePointerClick className="w-4 h-4 mr-1.5 text-indigo-500" /> Clicked
        </span>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-slate-900">{clicked}</span>
          <span className="text-sm font-medium text-slate-400">{clickRate}%</span>
        </div>
      </div>
    </div>
  );
}
