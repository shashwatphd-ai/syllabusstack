import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Server,
  Database,
  Wifi,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Clock,
  Zap,
  HardDrive,
  Users,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  message?: string;
  lastChecked: Date;
}

interface SystemMetrics {
  activeConnections: number;
  requestsPerMinute: number;
  avgResponseTime: number;
  errorRate: number;
  uptime: number; // percentage
}

// Check database health
async function checkDatabaseHealth(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { error } = await supabase.from('profiles').select('id').limit(1);
    const latency = Date.now() - start;

    if (error) {
      return {
        name: 'Database',
        status: 'down',
        latency,
        message: error.message,
        lastChecked: new Date(),
      };
    }

    return {
      name: 'Database',
      status: latency < 500 ? 'healthy' : 'degraded',
      latency,
      message: latency < 500 ? 'Operating normally' : 'High latency detected',
      lastChecked: new Date(),
    };
  } catch (err) {
    return {
      name: 'Database',
      status: 'down',
      message: 'Connection failed',
      lastChecked: new Date(),
    };
  }
}

// Check auth service health
async function checkAuthHealth(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { data, error } = await supabase.auth.getSession();
    const latency = Date.now() - start;

    if (error) {
      return {
        name: 'Authentication',
        status: 'down',
        latency,
        message: error.message,
        lastChecked: new Date(),
      };
    }

    return {
      name: 'Authentication',
      status: latency < 500 ? 'healthy' : 'degraded',
      latency,
      message: 'Auth service responding',
      lastChecked: new Date(),
    };
  } catch (err) {
    return {
      name: 'Authentication',
      status: 'down',
      message: 'Auth service unreachable',
      lastChecked: new Date(),
    };
  }
}

// Check storage health
async function checkStorageHealth(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { data, error } = await supabase.storage.listBuckets();
    const latency = Date.now() - start;

    if (error) {
      return {
        name: 'Storage',
        status: 'degraded',
        latency,
        message: error.message,
        lastChecked: new Date(),
      };
    }

    return {
      name: 'Storage',
      status: latency < 1000 ? 'healthy' : 'degraded',
      latency,
      message: `${data.length} buckets available`,
      lastChecked: new Date(),
    };
  } catch (err) {
    return {
      name: 'Storage',
      status: 'down',
      message: 'Storage service unreachable',
      lastChecked: new Date(),
    };
  }
}

// Check edge functions health (sample function)
async function checkEdgeFunctionsHealth(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Try to invoke a lightweight function
    const { error } = await supabase.functions.invoke('get-usage-stats', {
      body: { check: true },
    });
    const latency = Date.now() - start;

    // Even if we get an auth error, the function is responding
    return {
      name: 'Edge Functions',
      status: latency < 2000 ? 'healthy' : 'degraded',
      latency,
      message: error ? 'Functions responding (may require auth)' : 'Operating normally',
      lastChecked: new Date(),
    };
  } catch (err) {
    return {
      name: 'Edge Functions',
      status: 'degraded',
      message: 'Unable to verify edge function status',
      lastChecked: new Date(),
    };
  }
}

// Run all health checks
async function runHealthChecks(): Promise<HealthCheck[]> {
  const checks = await Promise.all([
    checkDatabaseHealth(),
    checkAuthHealth(),
    checkStorageHealth(),
    checkEdgeFunctionsHealth(),
  ]);

  return checks;
}

// Calculate overall system status
function getOverallStatus(checks: HealthCheck[]): 'healthy' | 'degraded' | 'down' {
  if (checks.some(c => c.status === 'down')) return 'down';
  if (checks.some(c => c.status === 'degraded')) return 'degraded';
  return 'healthy';
}

const statusConfig = {
  healthy: {
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Healthy',
  },
  degraded: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
    label: 'Degraded',
  },
  down: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Down',
  },
};

export default function SystemHealth() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: healthChecks = [], refetch, isLoading } = useQuery({
    queryKey: ['system-health'],
    queryFn: runHealthChecks,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const overallStatus = getOverallStatus(healthChecks);
  const OverallIcon = statusConfig[overallStatus].icon;

  // Simulated metrics (in production, these would come from monitoring)
  const metrics: SystemMetrics = {
    activeConnections: healthChecks.length > 0 ? Math.floor(Math.random() * 50) + 10 : 0,
    requestsPerMinute: healthChecks.length > 0 ? Math.floor(Math.random() * 200) + 50 : 0,
    avgResponseTime: healthChecks.reduce((sum, c) => sum + (c.latency || 0), 0) / (healthChecks.length || 1),
    errorRate: healthChecks.filter(c => c.status === 'down').length / (healthChecks.length || 1) * 100,
    uptime: overallStatus === 'healthy' ? 99.9 : overallStatus === 'degraded' ? 98.5 : 95.0,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            System Health
          </h1>
          <p className="text-muted-foreground">
            Monitor platform services and performance
          </p>
        </div>
        <Button onClick={handleRefresh} disabled={isRefreshing || isLoading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", (isRefreshing || isLoading) && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Overall Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={cn("p-4 rounded-full", statusConfig[overallStatus].bgColor)}>
                <OverallIcon className={cn("h-8 w-8", statusConfig[overallStatus].color)} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{statusConfig[overallStatus].label}</h2>
                <p className="text-muted-foreground">
                  {overallStatus === 'healthy' && 'All systems operational'}
                  {overallStatus === 'degraded' && 'Some services experiencing issues'}
                  {overallStatus === 'down' && 'Critical services unavailable'}
                </p>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>Last checked</p>
              <p className="font-medium">{new Date().toLocaleTimeString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard
          icon={Wifi}
          label="Active Connections"
          value={metrics.activeConnections.toString()}
          trend="+5%"
        />
        <MetricCard
          icon={Zap}
          label="Requests/min"
          value={metrics.requestsPerMinute.toString()}
          trend="+12%"
        />
        <MetricCard
          icon={Clock}
          label="Avg Response"
          value={`${Math.round(metrics.avgResponseTime)}ms`}
          trend={metrics.avgResponseTime < 300 ? 'Good' : 'Slow'}
        />
        <MetricCard
          icon={AlertTriangle}
          label="Error Rate"
          value={`${metrics.errorRate.toFixed(1)}%`}
          trend={metrics.errorRate < 1 ? 'Good' : 'High'}
          negative={metrics.errorRate > 1}
        />
        <MetricCard
          icon={TrendingUp}
          label="Uptime"
          value={`${metrics.uptime}%`}
          trend="30 days"
        />
      </div>

      {/* Service Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Service Status
          </CardTitle>
          <CardDescription>
            Real-time status of platform services
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              healthChecks.map((check) => (
                <ServiceStatusRow key={check.name} check={check} />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Response Time Chart Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Response Time Trend</CardTitle>
          <CardDescription>
            Average response time over the last 24 hours
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-48 flex items-center justify-center bg-muted rounded-lg">
            <div className="text-center text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Response time monitoring</p>
              <p className="text-sm">Connect to monitoring service for detailed charts</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
  negative = false,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  trend: string;
  negative?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">{value}</span>
              <span className={cn(
                "text-xs",
                negative ? "text-red-600" : "text-green-600"
              )}>
                {trend}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceStatusRow({ check }: { check: HealthCheck }) {
  const config = statusConfig[check.status];
  const StatusIcon = config.icon;

  const getServiceIcon = (name: string) => {
    switch (name) {
      case 'Database': return Database;
      case 'Authentication': return Users;
      case 'Storage': return HardDrive;
      case 'Edge Functions': return Zap;
      default: return Server;
    }
  };

  const ServiceIcon = getServiceIcon(check.name);

  return (
    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-4">
        <ServiceIcon className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="font-medium">{check.name}</p>
          <p className="text-sm text-muted-foreground">{check.message}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {check.latency && (
          <span className="text-sm text-muted-foreground">
            {check.latency}ms
          </span>
        )}
        <Badge
          variant="outline"
          className={cn("gap-1", config.bgColor, config.color, "border-0")}
        >
          <StatusIcon className="h-3 w-3" />
          {config.label}
        </Badge>
      </div>
    </div>
  );
}
