import { useState } from 'react';
import { Target, RefreshCw, MapPin, Filter, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import JobMatchCard from '@/components/jobs/JobMatchCard';
import { useJobMatches, useRefreshJobMatches, useUpdateJobMatchStatus, useJobMatchesRealtime } from '@/hooks/useJobMatches';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function StudentJobMatches() {
  const { data: matches, isLoading } = useJobMatches();
  const refreshMutation = useRefreshJobMatches();
  const updateStatus = useUpdateJobMatchStatus();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState('');

  // Get current user for realtime subscription
  const { data: userData } = useQuery({
    queryKey: ['current-user-id'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id;
    },
  });

  // Subscribe to realtime updates
  useJobMatchesRealtime(userData || undefined);

  // Filter matches
  const filtered = (matches || []).filter(m => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (locationFilter && !m.location?.toLowerCase().includes(locationFilter.toLowerCase())) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        m.job_title.toLowerCase().includes(q) ||
        m.company_name?.toLowerCase().includes(q) ||
        m.skill_overlap?.matched?.some(s => s.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const activeCount = (matches || []).filter(m => m.status === 'active').length;
  const appliedCount = (matches || []).filter(m => m.status === 'applied').length;
  const avgScore = filtered.length > 0
    ? Math.round(filtered.reduce((sum, m) => sum + m.match_score, 0) / filtered.length * 100)
    : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Job Matches
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Opportunities matched to your verified skills and experience
          </p>
        </div>
        <Button
          onClick={() => refreshMutation.mutate({})}
          disabled={refreshMutation.isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          {refreshMutation.isPending ? 'Matching...' : 'Refresh Matches'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active Matches</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{appliedCount}</p>
            <p className="text-xs text-muted-foreground">Applied</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-2xl font-bold">{avgScore}%</p>
            <p className="text-xs text-muted-foreground">Avg Match Score</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="Search by title, company, or skill..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="applied">Applied</SelectItem>
            <SelectItem value="matched">Matched</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Location..."
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
          className="w-[160px]"
        />
        <Badge variant="secondary">{filtered.length} matches</Badge>
      </div>

      {/* Match List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No Job Matches Yet</h3>
            <p className="text-muted-foreground mt-2 max-w-md mx-auto">
              Complete assessments, capstone projects, or skills evaluations to build your profile,
              then click "Refresh Matches" to find opportunities.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(match => (
            <JobMatchCard
              key={match.id}
              match={match}
              onMarkApplied={(id) => updateStatus.mutate({ matchId: id, status: 'applied' })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
