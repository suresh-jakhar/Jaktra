import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/Card";
import { analyticsService } from "../services/analytics";
import { agentService } from "../services/agent";
import { AlertCircle, FileText, TrendingUp, DollarSign, Loader2, PieChart as PieChartIcon, BarChart3, Clock, Zap, AlertTriangle } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from "recharts";

export function Dashboard() {
  const { data: summaryData, isLoading: isSummaryLoading, isError: isSummaryError } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => analyticsService.getSummary(),
    refetchInterval: 30000,
  });

  const { data: agingData, isLoading: isAgingLoading } = useQuery({
    queryKey: ['analytics-aging'],
    queryFn: () => analyticsService.getAging(),
    refetchInterval: 30000,
  });

  const { data: runsData, isLoading: isRunsLoading } = useQuery({
    queryKey: ['agent-runs'],
    queryFn: () => agentService.getRuns(),
    refetchInterval: 30000,
  });

  const isLoading = isSummaryLoading || isAgingLoading || isRunsLoading;
  const isError = isSummaryError;

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const formatPercent = (val: number) => 
    `${val.toFixed(1)}%`;

  // Calculations
  const actionableQueue = summaryData?.invoiceCount || 0;
  const totalExposure = summaryData?.totalReceivable || 0;
  
  const totalCollected = summaryData?.totalCollected || 0;
  const recoveryRate = (totalCollected + totalExposure) > 0 
    ? (totalCollected / (totalCollected + totalExposure)) * 100 
    : 0;
    
  const criticalFlags = summaryData?.totalOverdue || 0;

  // Portfolio Mix Data
  const portfolioData = [
    { name: 'Collected', value: totalCollected, color: '#10b981' }, // emerald-500
    { name: 'Pending', value: Math.max(0, totalExposure - criticalFlags), color: '#3b82f6' }, // blue-500
    { name: 'Overdue', value: criticalFlags, color: '#ef4444' } // red-500
  ].filter(d => d.value > 0);

  // Aging Pipeline Data
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
    fill: tierConfig[d.tier]?.color || '#cbd5e1'
  }));

  // Dispatch Performance Calculations
  const latestRun = runsData?.runs?.[0];
  const lastBatchSent = latestRun ? new Date(latestRun.startTime).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : 'Never';
  const automationYield = latestRun && latestRun.invoicesProcessed > 0 
    ? `${((latestRun.emailsSent / latestRun.invoicesProcessed) * 100).toFixed(1)}%` 
    : (latestRun ? "0.0%" : "N/A");

  const stage5Halted = agingData?.find(d => d.tier === 'legal_escalation')?.count || 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-slate-200 p-3 shadow-lg rounded-md">
          <p className="font-medium text-slate-900 mb-1">{payload[0].name}</p>
          <p className="text-sm text-slate-600 font-semibold">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">Overview of your collection pipeline.</p>
        </div>
        
        {isLoading && (
          <div className="flex items-center text-sm text-slate-500 mt-2 md:mt-0">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Syncing data...
          </div>
        )}
        
        {isError && (
          <div className="text-sm text-red-500 mt-2 md:mt-0">
            Failed to load analytics data.
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Actionable Queue */}
        <Card className="animate-in fade-in duration-500 slide-in-from-bottom-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actionable Queue</CardTitle>
            <FileText className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "-" : actionableQueue}
            </div>
            <p className="text-xs text-slate-500 mt-1">Total active invoices</p>
          </CardContent>
        </Card>

        {/* Total Exposure */}
        <Card className="animate-in fade-in duration-500 slide-in-from-bottom-2 delay-75">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Exposure</CardTitle>
            <DollarSign className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "-" : formatCurrency(totalExposure)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Pending and Overdue</p>
          </CardContent>
        </Card>

        {/* Recovery Rate */}
        <Card className="animate-in fade-in duration-500 slide-in-from-bottom-2 delay-150">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "-" : formatPercent(recoveryRate)}
            </div>
            <p className="text-xs text-slate-500 mt-1">Collected vs Total Billed</p>
          </CardContent>
        </Card>

        {/* Critical Flags (Mapped to Overdue) */}
        <Card className="animate-in fade-in duration-500 slide-in-from-bottom-2 delay-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Flags</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {isLoading ? "-" : formatCurrency(criticalFlags)}
            </div>
            <p className="text-xs text-red-500 font-medium mt-1">Overdue Balance</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {/* Aging Pipeline */}
        <Card className="animate-in fade-in duration-500 slide-in-from-bottom-2 delay-300">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-slate-500" />
              <CardTitle>Aging Pipeline</CardTitle>
            </div>
            <CardDescription>Outstanding exposure by urgency tier</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              {isAgingLoading ? (
                <div className="h-full w-full flex items-center justify-center text-slate-400">Loading chart...</div>
              ) : agingChartData.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center text-slate-400">No aging data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agingChartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <XAxis type="number" tickFormatter={(val) => Intl.NumberFormat('en-US', { notation: 'compact', style: 'currency', currency: 'USD' }).format(val)} stroke="#94a3b8" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={120} stroke="#94a3b8" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {agingChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Mix */}
        <Card className="animate-in fade-in duration-500 slide-in-from-bottom-2 delay-300">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <PieChartIcon className="h-5 w-5 text-slate-500" />
              <CardTitle>Portfolio Mix</CardTitle>
            </div>
            <CardDescription>Distribution of active and recovered funds</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full mt-4">
              {isSummaryLoading ? (
                <div className="h-full w-full flex items-center justify-center text-slate-400">Loading chart...</div>
              ) : portfolioData.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center text-slate-400">No portfolio data available</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={portfolioData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {portfolioData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phase B7: Dispatch Performance Row */}
      <Card className="animate-in fade-in duration-500 slide-in-from-bottom-2 delay-400">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">
            Dispatch Performance (Latest Run)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 divide-x-0 md:divide-x divide-slate-100">
            <div className="flex flex-col space-y-1">
              <span className="text-sm text-slate-500 flex items-center"><Clock className="w-4 h-4 mr-1.5 text-slate-400" /> Last Batch Sent</span>
              <span className="text-lg font-semibold text-slate-900">{isRunsLoading ? "-" : lastBatchSent}</span>
            </div>
            <div className="flex flex-col space-y-1 md:pl-8">
              <span className="text-sm text-slate-500 flex items-center"><Zap className="w-4 h-4 mr-1.5 text-slate-400" /> Automation Yield</span>
              <span className="text-lg font-semibold text-slate-900">{isRunsLoading ? "-" : automationYield}</span>
            </div>
            <div className="flex flex-col space-y-1 md:pl-8">
              <span className="text-sm text-slate-500 flex items-center"><AlertTriangle className="w-4 h-4 mr-1.5 text-slate-400" /> Legal Escalations</span>
              <span className="text-lg font-semibold text-slate-900">{isAgingLoading ? "-" : stage5Halted}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
