import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Cpu, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  BarChart3,
  Sparkles,
  Clock,
  Zap
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';

interface UsageStats {
  totalCalls: number;
  totalCost: number;
  byFunction: Record<string, { calls: number; cost: number }>;
  byModel: Record<string, { calls: number; cost: number }>;
  recentCalls: Array<{
    id: string;
    function_name: string;
    model_used: string;
    cost_usd: number;
    created_at: string;
  }>;
}

async function fetchUsageStats(days: number): Promise<UsageStats> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('ai_usage')
    .select('*')
    .eq('user_id', user.id)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  const records = data || [];

  // Aggregate stats
  const byFunction: Record<string, { calls: number; cost: number }> = {};
  const byModel: Record<string, { calls: number; cost: number }> = {};
  let totalCost = 0;

  records.forEach((r) => {
    const cost = Number(r.cost_usd) || 0;
    totalCost += cost;

    if (!byFunction[r.function_name]) {
      byFunction[r.function_name] = { calls: 0, cost: 0 };
    }
    byFunction[r.function_name].calls++;
    byFunction[r.function_name].cost += cost;

    if (!byModel[r.model_used]) {
      byModel[r.model_used] = { calls: 0, cost: 0 };
    }
    byModel[r.model_used].calls++;
    byModel[r.model_used].cost += cost;
  });

  return {
    totalCalls: records.length,
    totalCost,
    byFunction,
    byModel,
    recentCalls: records.slice(0, 10).map((r) => ({
      id: r.id,
      function_name: r.function_name,
      model_used: r.model_used,
      cost_usd: Number(r.cost_usd) || 0,
      created_at: r.created_at,
    })),
  };
}

export default function UsagePage() {
  const [timeRange, setTimeRange] = useState('30');
  
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['ai-usage', timeRange],
    queryFn: () => fetchUsageStats(parseInt(timeRange)),
  });

  const formatCost = (cost: number) => {
    return cost < 0.01 ? '<$0.01' : `$${cost.toFixed(2)}`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getFunctionIcon = (name: string) => {
    if (name.includes('syllabus')) return <Cpu className="h-4 w-4" />;
    if (name.includes('gap')) return <BarChart3 className="h-4 w-4" />;
    if (name.includes('recommendation')) return <Sparkles className="h-4 w-4" />;
    return <Zap className="h-4 w-4" />;
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Usage</h1>
            <p className="text-muted-foreground mt-1">
              Monitor your AI analysis usage and costs
            </p>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="border-destructive/50">
            <CardContent className="py-8 text-center">
              <p className="text-destructive">Failed to load usage data</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    Total AI Calls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stats?.totalCalls || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Last {timeRange} days
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-500" />
                    Estimated Cost
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatCost(stats?.totalCost || 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Based on token usage
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-500" />
                    Avg Cost/Call
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {stats && stats.totalCalls > 0
                      ? formatCost(stats.totalCost / stats.totalCalls)
                      : '$0.00'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Per AI analysis
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Usage by Function */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Usage by Function
                </CardTitle>
                <CardDescription>
                  Breakdown of AI calls by analysis type
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats && Object.keys(stats.byFunction).length > 0 ? (
                  <div className="space-y-4">
                    {Object.entries(stats.byFunction).map(([name, data]) => {
                      const percentage = (data.calls / stats.totalCalls) * 100;
                      return (
                        <div key={name} className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              {getFunctionIcon(name)}
                              <span className="font-medium">{name}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <Badge variant="secondary">{data.calls} calls</Badge>
                              <span className="text-muted-foreground w-16 text-right">
                                {formatCost(data.cost)}
                              </span>
                            </div>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Zap className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No AI usage recorded yet
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>
                  Your latest AI analysis calls
                </CardDescription>
              </CardHeader>
              <CardContent>
                {stats && stats.recentCalls.length > 0 ? (
                  <div className="space-y-3">
                    {stats.recentCalls.map((call) => (
                      <div
                        key={call.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          {getFunctionIcon(call.function_name)}
                          <div>
                            <p className="text-sm font-medium">{call.function_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {call.model_used}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">{formatCost(call.cost_usd)}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(call.created_at)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No recent activity
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}
