import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoiceService } from "../services/invoice";
import { eventService } from "../services/event";
import { agentService } from "../services/agent";
import { communicationService } from "../services/communication";
import { Badge } from "../components/ui/Badge";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { useAuth } from "../contexts/AuthContext";
import { EditInvoiceModal } from "../components/invoices/EditInvoiceModal";
import { CommunicationList } from "../components/invoices/CommunicationList";
import { CommunicationStats } from "../components/invoices/CommunicationStats";
import { 
  ArrowLeft, 
  Mail, 
  Calendar, 
  Clock, 
  AlertTriangle,
  Edit,
  CheckCircle2,
  Zap,
  Loader2,
  Send,
  MessageSquare,
  FileText
} from "lucide-react";

const tierConfig: Record<string, { label: string, color: string }> = {
  stage_1_warm: { label: 'Warm (Stage 1)', color: 'bg-blue-100 text-blue-800' },
  stage_2_firm: { label: 'Firm (Stage 2)', color: 'bg-yellow-100 text-yellow-800' },
  stage_3_serious: { label: 'Serious (Stage 3)', color: 'bg-orange-100 text-orange-800' },
  stage_4_stern: { label: 'Stern (Stage 4)', color: 'bg-red-100 text-red-800' },
  legal_escalation: { label: 'Legal Escalation', color: 'bg-rose-900 text-white' },
};

const formatCurrency = (val: string | number) => {
  return Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(val));
};

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'emails'>('timeline');

  const { data: invoice, isLoading: isInvoiceLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: () => invoiceService.getInvoice(id!),
    enabled: !!id,
  });

  const { data: timeline, isLoading: isTimelineLoading } = useQuery({
    queryKey: ["invoice-timeline", id],
    queryFn: () => eventService.getInvoiceTimeline(id!),
    enabled: !!id,
  });

  const { data: communications, isLoading: isCommsLoading } = useQuery({
    queryKey: ["invoice-communications", id],
    queryFn: () => communicationService.getInvoiceCommunications(id!),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => invoiceService.updateInvoiceStatus(id!, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-timeline", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-summary"] });
      queryClient.invalidateQueries({ queryKey: ["analytics-aging"] });
    }
  });

  const agentMutation = useMutation({
    mutationFn: () => agentService.runAgentForInvoice(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-timeline", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-communications", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    }
  });

  if (isInvoiceLoading || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-500">Loading invoice details...</p>
      </div>
    );
  }

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
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default:
        return <MessageSquare className="w-4 h-4 text-slate-600" />;
    }
  };

  const renderEventDescription = (eventType: string, payload: any) => {
    switch (eventType) {
      case 'invoice_created':
        return 'Invoice imported or created.';
      case 'email_sent':
        return (
          <div>
            <p>Sent follow-up email.</p>
            {payload?.subject && <p className="text-xs text-slate-500 mt-1 font-mono bg-slate-50 p-1 rounded">Subject: {payload.subject}</p>}
          </div>
        );
      case 'email_opened':
        return 'Client opened the email.';
      case 'status_updated':
        return `Status updated to ${payload?.status || 'Paid'}.`;
      case 'legal_escalated':
        return 'Invoice escalated to legal due to aging.';
      case 'dlq_added':
        return `Added to Dead Letter Queue: ${payload?.reason || 'Unknown error'}`;
      default:
        return eventType.replace('_', ' ');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Back Link */}
      <div>
        <Link to="/invoices" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Invoices
        </Link>
      </div>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{invoice.invoiceNo}</h1>
            <Badge variant={
              invoice.paymentStatus === 'Paid' ? 'success' : 
              invoice.paymentStatus === 'Overdue' ? 'danger' : 'warning'
            }>
              {invoice.paymentStatus}
            </Badge>
            {invoice.urgencyTier && invoice.paymentStatus !== 'Paid' && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${tierConfig[invoice.urgencyTier]?.color || 'bg-slate-100 text-slate-800'}`}>
                {tierConfig[invoice.urgencyTier]?.label || invoice.urgencyTier}
              </span>
            )}
          </div>
          <p className="text-3xl font-light text-slate-900 mt-4">
            {formatCurrency(invoice.invoiceAmount)}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2 md:justify-end">
          <button
            onClick={() => document.getElementById('timeline')?.scrollIntoView({ behavior: 'smooth' })}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 h-10 px-4 py-2"
          >
            <Clock className="mr-2 h-4 w-4" />
            History
          </button>
          
          {user?.role !== 'viewer' && (
            <>
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 border border-slate-200 bg-white hover:bg-slate-100 hover:text-slate-900 h-10 px-4 py-2"
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </button>

              {invoice.paymentStatus !== 'Paid' && (
                <>
                  <button
                    onClick={() => statusMutation.mutate('Paid')}
                    disabled={statusMutation.isPending}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 h-10 px-4 py-2 disabled:opacity-50"
                  >
                    {statusMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Mark as Paid
                  </button>

                  <button
                    onClick={() => agentMutation.mutate()}
                    disabled={agentMutation.isPending}
                    className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 disabled:opacity-50"
                  >
                    {agentMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                    Trigger Follow-up
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Info Grid */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Client Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">Company</p>
                <p className="font-medium text-slate-900">{invoice.clientName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 mb-1">Contact</p>
                <div className="flex items-center text-slate-900">
                  <Mail className="mr-2 h-4 w-4 text-slate-400" />
                  <a href={`mailto:${invoice.contactEmail}`} className="hover:text-blue-600 hover:underline">{invoice.contactEmail}</a>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Aging & Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-slate-500 mb-1">Due Date</p>
                <div className="flex items-center text-slate-900">
                  <Calendar className="mr-2 h-4 w-4 text-slate-400" />
                  {new Date(invoice.dueDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <p className="text-sm text-slate-500">Days Overdue</p>
                <p className={`font-semibold ${invoice.daysOverdue && invoice.daysOverdue > 0 ? 'text-red-600' : 'text-slate-900'}`}>
                  {invoice.daysOverdue || 0}
                </p>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <p className="text-sm text-slate-500">Follow-ups Sent</p>
                <p className="font-semibold text-slate-900">{invoice.followupCount}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs Area */}
        <div className="md:col-span-2">
          <Card id="history-tabs" className="h-full">
            <div className="flex border-b border-slate-200">
              <button
                className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'timeline' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
                onClick={() => setActiveTab('timeline')}
              >
                Event Timeline
              </button>
              <button
                className={`flex-1 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'emails' 
                    ? 'border-blue-600 text-blue-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
                onClick={() => setActiveTab('emails')}
              >
                Emails & Messages
              </button>
            </div>
            
            <CardContent className="pt-6">
              {activeTab === 'timeline' ? (
                // TIMELINE TAB
                isTimelineLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : !timeline || timeline.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    No events recorded for this invoice yet.
                  </div>
                ) : (
                  <div className="relative border-l border-slate-200 ml-3 space-y-8 py-2">
                    {timeline.map((event) => (
                      <div key={event.id} className="relative pl-8">
                        <div className="absolute -left-3.5 top-1 h-7 w-7 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                          {renderEventIcon(event.eventType)}
                        </div>
                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-medium text-slate-900 capitalize">
                              {event.eventType.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              {new Date(event.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-sm text-slate-600 mt-2">
                            {renderEventDescription(event.eventType, event.payload)}
                          </div>
                          <div className="mt-3 text-xs text-slate-400 flex items-center">
                            <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded capitalize">Actor: {event.actor}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                // EMAILS TAB
                isCommsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : (
                  <div>
                    <CommunicationStats communications={communications || []} />
                    <CommunicationList communications={communications || []} />
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {invoice && (
        <EditInvoiceModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          invoice={invoice}
        />
      )}
    </div>
  );
}
