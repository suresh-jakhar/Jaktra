import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/analytics';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { TrendingUp, DollarSign, Clock, AlertCircle, Loader2, Construction } from 'lucide-react';

export function Analytics() {
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

  // Aging Pyramid Data Processing
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
  })).reverse(); // Reverse for funnel/pyramid effect (escalation at top or bottom)

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

  const ComingSoonCard = ({ title, description }: { title: string, description: string }) => (
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center">
          <TrendingUp className="w-8 h-8 text-blue-600 mr-3" />
          Financial Analytics
        </h1>
        <p className="text-slate-500 mt-1">Real-time business intelligence and collection performance.</p>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-x-2">
              <h3 className="text-sm font-medium text-slate-500">Total Receivable</h3>
              <DollarSign className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-4 flex items-baseline text-3xl font-bold text-slate-900">
              {isSummaryLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : formatCurrency(summaryData?.totalReceivable || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-x-2">
              <h3 className="text-sm font-medium text-slate-500">Total Collected</h3>
              <DollarSign className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-4 flex items-baseline text-3xl font-bold text-emerald-600">
              {isSummaryLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : formatCurrency(summaryData?.totalCollected || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-x-2">
              <h3 className="text-sm font-medium text-slate-500">Total Overdue</h3>
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <div className="mt-4 flex items-baseline text-3xl font-bold text-red-600">
              {isSummaryLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : formatCurrency(summaryData?.totalOverdue || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-x-2">
              <h3 className="text-sm font-medium text-slate-500">Active Invoices</h3>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-4 flex items-baseline text-3xl font-bold text-slate-900">
              {isSummaryLoading ? <Loader2 className="w-6 h-6 animate-spin text-slate-300" /> : (summaryData?.invoiceCount || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Real Data Chart: Aging Pyramid */}
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

        {/* Placeholder: Receivable vs Collected */}
        <ComingSoonCard 
          title="Receivable vs Collected" 
          description="Historical gap analysis between billed and collected capital" 
        />

        {/* Placeholder: DSO Trend */}
        <ComingSoonCard 
          title="Days Sales Outstanding (DSO) Trend" 
          description="Average time taken to collect revenue over the last 12 months" 
        />

        {/* Placeholder: Collection Rate */}
        <ComingSoonCard 
          title="Collection Rate Trend" 
          description="Monthly percentage of successfully collected capital" 
        />
      </div>
    </div>
  );
}
