import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/analytics';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { TrendingUp, DollarSign, Clock, AlertCircle, Loader2, Construction, Send, Zap, LayoutDashboard, MailOpen, MousePointerClick } from 'lucide-react';

export function Analytics() {
  const [activeTab, setActiveTab] = useState<'financial' | 'agent'>('agent');

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center">
            <TrendingUp className="w-8 h-8 text-blue-600 mr-3" />
            Analytics & BI
          </h1>
          <p className="text-slate-500 mt-1">Real-time business intelligence and AI performance metrics.</p>
        </div>
      </div>

      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('financial')}
            className={`${
              activeTab === 'financial'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Financial Metrics
          </button>
          <button
            onClick={() => setActiveTab('agent')}
            className={`${
              activeTab === 'agent'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Zap className="w-4 h-4 mr-2" />
            Agent Performance
          </button>
        </nav>
      </div>

      {activeTab === 'financial' ? <FinancialMetricsTab /> : <AgentPerformanceTab />}
    </div>
  );
}

function FinancialMetricsTab() {
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsService.getSummary(),
  });

  const { data: agingData, isLoading: isAgingLoading } = useQuery({
    queryKey: ['analytics-aging'],
    queryFn: () => analyticsService.getAging(),
  });

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const tierConfig: Record<string, { label: string, color: string }> = {
    stage_1_warm: { label: 'Warm (Stage 1)', color: '#3b82f6' },
    stage_2_firm: { label: 'Firm (Stage 2)', color: '#eab308' },
    stage_3_serious: { label: 'Serious (Stage 3)', color: '#f97316' },
    stage_4_stern: { label: 'Stern (Stage 4)', color: '#ef4444' },
    legal_escalation: { label: 'Legal Escalation', color: '#7f1d1d' },
  };

  const agingChartData = (agingData || []).map(d => ({
    name: tierConfig[d.tier]?.label || d.tier,
    value: d.totalAmount,
    count: d.count,
    fill: tierConfig[d.tier]?.color || '#cbd5e1'
  })).reverse();

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 p-3 shadow-lg rounded-md">
          <p className="font-medium text-slate-900 mb-1">{payload[0].payload.name}</p>
          <p className="text-sm text-slate-600 font-semibold">{formatCurrency(payload[0].value)}</p>
          <p className="text-xs text-slate-500 mt-1">{payload[0].payload.count} Invoices</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Receivable" value={summaryData?.totalReceivable} loading={isSummaryLoading} formatter={formatCurrency} icon={<DollarSign className="w-4 h-4 text-slate-400" />} />
        <MetricCard title="Total Collected" value={summaryData?.totalCollected} loading={isSummaryLoading} formatter={formatCurrency} icon={<DollarSign className="w-4 h-4 text-emerald-500" />} valueColor="text-emerald-600" />
        <MetricCard title="Total Overdue" value={summaryData?.totalOverdue} loading={isSummaryLoading} formatter={formatCurrency} icon={<AlertCircle className="w-4 h-4 text-red-500" />} valueColor="text-red-600" />
        <MetricCard title="Active Invoices" value={summaryData?.invoiceCount} loading={isSummaryLoading} icon={<Clock className="w-4 h-4 text-blue-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Aging Pyramid</CardTitle>
            <CardDescription>Capital exposure grouped by collection tier</CardDescription>
          </CardHeader>
          <CardContent>
            {isAgingLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={(val) => `$${val / 1000}k`} stroke="#94a3b8" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={120} stroke="#64748b" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={40}>
                      {agingChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
        <ComingSoonCard title="Receivable vs Collected" description="Historical gap analysis between billed and collected capital" />
        <ComingSoonCard title="Days Sales Outstanding (DSO) Trend" description="Average time taken to collect revenue over the last 12 months" />
        <ComingSoonCard title="Collection Rate Trend" description="Monthly percentage of successfully collected capital" />
      </div>
    </div>
  );
}

function AgentPerformanceTab() {
  const { data: agentData, isLoading: isAgentLoading } = useQuery({ queryKey: ['agent-performance'], queryFn: () => analyticsService.getAgentPerformance() });
  const { data: emailVol, isLoading: isEmailVolLoading } = useQuery({ queryKey: ['email-volume'], queryFn: () => analyticsService.getEmailVolume() });
  const { data: tierData, isLoading: isTierLoading } = useQuery({ queryKey: ['tier-effectiveness'], queryFn: () => analyticsService.getTierEffectiveness() });
  const { data: channelData, isLoading: isChannelLoading } = useQuery({ queryKey: ['channel-breakdown'], queryFn: () => analyticsService.getChannelBreakdown() });
  const { data: commStats, isLoading: isCommStatsLoading } = useQuery({ queryKey: ['comm-stats'], queryFn: () => analyticsService.getCommunicationStats() });

  const formatPercentage = (val: number) => `${val}%`;

  const tierConfig: Record<string, { label: string, color: string }> = {
    stage_1_warm: { label: 'Warm', color: '#3b82f6' },
    stage_2_firm: { label: 'Firm', color: '#eab308' },
    stage_3_serious: { label: 'Serious', color: '#f97316' },
    stage_4_stern: { label: 'Stern', color: '#ef4444' },
    legal_escalation: { label: 'Legal', color: '#7f1d1d' },
  };

  const chartTierData = (tierData || []).map(d => ({
    name: tierConfig[d.tier]?.label || d.tier,
    successRate: d.successRate,
    avgDaysToPayment: d.avgDaysToPayment,
    fill: tierConfig[d.tier]?.color || '#cbd5e1'
  }));

  const chartChannelData = (channelData || []).map(d => ({
    name: d.channel.charAt(0).toUpperCase() + d.channel.slice(1),
    count: d.count,
    fill: d.channel === 'email' ? '#3b82f6' : d.channel === 'sms' ? '#f59e0b' : '#22c55e'
  }));

  const isLoading = isAgentLoading || isEmailVolLoading || isTierLoading || isChannelLoading || isCommStatsLoading;

  const isDataEmpty = !isLoading && 
    (agentData?.totalRuns === 0 || agentData?.totalRuns === undefined) && 
    (!emailVol || emailVol.length === 0);

  if (isDataEmpty) {
    return (
      <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 mt-6">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Zap className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-xl font-medium text-slate-700">No performance data available yet.</h3>
          <p className="text-slate-500 mt-2">Run the agent to begin collecting analytics.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard title="Total Runs" value={agentData?.totalRuns} loading={isLoading} icon={<Zap className="w-4 h-4 text-blue-500" />} />
        <MetricCard title="Invoices Processed" value={agentData?.invoicesProcessed} loading={isLoading} icon={<LayoutDashboard className="w-4 h-4 text-emerald-500" />} />
        <MetricCard title="Emails Sent" value={agentData?.emailsSent} loading={isLoading} icon={<Send className="w-4 h-4 text-blue-500" />} />
        <MetricCard title="Error Rate" value={agentData?.errorRate} loading={isLoading} formatter={formatPercentage} icon={<AlertCircle className="w-4 h-4 text-red-500" />} valueColor="text-red-600" />
        <MetricCard title="Open Rate" value={commStats?.openRate} loading={isLoading} formatter={formatPercentage} icon={<MailOpen className="w-4 h-4 text-purple-500" />} />
        <MetricCard title="Click Rate" value={commStats?.clickRate} loading={isLoading} formatter={formatPercentage} icon={<MousePointerClick className="w-4 h-4 text-indigo-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Emails Sent Per Day</CardTitle>
            <CardDescription>Daily outbound email volume</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={emailVol} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip labelFormatter={(val) => new Date(val).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} />
                    <Line type="monotone" dataKey="emailsSent" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Success Rate by Tier</CardTitle>
            <CardDescription>Conversion percentage of followed-up invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartTierData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `${val}%`} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Success Rate']} />
                    <Bar dataKey="successRate" radius={[4, 4, 0, 0]} maxBarSize={50}>
                      {chartTierData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Average Time-To-Payment</CardTitle>
            <CardDescription>Days to collect grouped by urgency tier</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartTierData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip formatter={(value) => [`${value} days`, 'Avg Time to Payment']} />
                    <Bar dataKey="avgDaysToPayment" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Channel Effectiveness</CardTitle>
            <CardDescription>Communication volume breakdown by channel</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
            ) : (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartChannelData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={80} stroke="#64748b" fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={40}>
                      {chartChannelData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Reusable Components
function MetricCard({ title, value, loading, formatter, icon, valueColor = "text-slate-900" }: any) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-x-2">
          <h3 className="text-sm font-medium text-slate-500">{title}</h3>
          {icon}
        </div>
        <div className={`mt-4 flex items-baseline text-3xl font-bold ${valueColor}`}>
          {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : (formatter ? formatter(value || 0) : (value || 0))}
        </div>
      </CardContent>
    </Card>
  );
}

function ComingSoonCard({ title, description }: { title: string, description: string }) {
  return (
    <Card className="h-full border-dashed border-2 border-slate-200 bg-slate-50/50">
      <CardHeader>
        <CardTitle className="text-slate-700">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="bg-slate-100 p-4 rounded-full mb-4">
          <Construction className="w-8 h-8 text-slate-400" />
        </div>
        <h4 className="text-lg font-medium text-slate-700">Coming Soon</h4>
        <p className="text-sm text-slate-500 text-center max-w-[250px] mt-2">
          This chart requires historical analytics data. Backend aggregation endpoints are under development.
        </p>
      </CardContent>
    </Card>
  );
}
