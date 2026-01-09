import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, BookOpen, TrendingUp, Award, Settings, FileText, BarChart3, Building2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSubscription } from '@/hooks/useSubscription';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { tier, isLoading: tierLoading } = useSubscription();
  const navigate = useNavigate();

  // Redirect if not university tier
  useEffect(() => {
    if (!tierLoading && tier !== 'university') {
      navigate('/dashboard');
    }
  }, [tier, tierLoading, navigate]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      // Get organization stats - this would need an organization_id context
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' });

      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('id', { count: 'exact' });

      const { data: completions } = await supabase
        .from('recommendations')
        .select('id', { count: 'exact' })
        .eq('status', 'completed');

      const { data: activeToday } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .gte('last_active_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      return {
        totalUsers: users?.length || 0,
        totalCourses: courses?.length || 0,
        totalCompletions: completions?.length || 0,
        activeToday: activeToday?.length || 0,
      };
    },
    enabled: tier === 'university',
  });

  if (tierLoading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid md:grid-cols-4 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (tier !== 'university') {
    return null;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Building2 className="h-8 w-8 text-purple-600" />
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your organization's learning platform
          </p>
        </div>
        <Badge variant="outline" className="text-purple-600 border-purple-300">
          University Plan
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-4 gap-6">
        <StatCard
          title="Total Users"
          value={stats?.totalUsers || 0}
          icon={Users}
          description="Registered students"
          loading={statsLoading}
        />
        <StatCard
          title="Active Today"
          value={stats?.activeToday || 0}
          icon={TrendingUp}
          description="Users active in 24h"
          loading={statsLoading}
          trend="+12%"
        />
        <StatCard
          title="Courses"
          value={stats?.totalCourses || 0}
          icon={BookOpen}
          description="Uploaded syllabi"
          loading={statsLoading}
        />
        <StatCard
          title="Completions"
          value={stats?.totalCompletions || 0}
          icon={Award}
          description="Recommendations completed"
          loading={statsLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              Add, remove, and manage student accounts
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link to="/admin/users">Manage Users</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Outcomes Report
            </CardTitle>
            <CardDescription>
              View student progress and career outcomes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/outcomes">View Report</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Branding Settings
            </CardTitle>
            <CardDescription>
              Customize the platform with your branding
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/branding">Customize</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Recent Activity
          </CardTitle>
          <CardDescription>
            Latest actions across your organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Activity feed coming soon</p>
            <p className="text-sm">Track user engagement and platform usage</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: typeof Users;
  description: string;
  loading?: boolean;
  trend?: string;
}

function StatCard({ title, value, icon: Icon, description, loading, trend }: StatCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          {trend && (
            <Badge variant="secondary" className="text-success">
              {trend}
            </Badge>
          )}
        </div>
        <div className="mt-4">
          <p className="text-3xl font-bold">{value.toLocaleString()}</p>
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}
