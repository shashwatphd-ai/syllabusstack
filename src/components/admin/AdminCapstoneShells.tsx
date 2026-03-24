import { useState } from 'react';
import { Briefcase, Building2, Star, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function getGrade(score: number | null): { grade: string; color: string } {
  if (!score) return { grade: 'N/A', color: 'text-muted-foreground' };
  if (score >= 0.85) return { grade: 'A+', color: 'text-green-600' };
  if (score >= 0.7) return { grade: 'A', color: 'text-green-500' };
  if (score >= 0.5) return { grade: 'B', color: 'text-amber-500' };
  if (score >= 0.3) return { grade: 'C', color: 'text-orange-500' };
  return { grade: 'D', color: 'text-red-500' };
}

export function AdminCapstoneShells() {
  const [search, setSearch] = useState('');

  const { data: projects, isLoading } = useQuery({
    queryKey: ['admin', 'capstone-shells'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capstone_projects')
        .select('*, company_profiles(name, sector, composite_signal_score), instructor_courses(title)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = (projects || []).filter((p: any) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.company_profiles?.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.instructor_courses?.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          AI Project Shells
        </h3>
        <Badge variant="secondary">{filtered.length} projects</Badge>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p: any) => {
            const { grade, color } = getGrade(p.final_score);
            return (
              <Card key={p.id} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {p.company_profiles?.name && (
                        <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{p.company_profiles.name}</span>
                      )}
                      {p.instructor_courses?.title && (
                        <span>· {p.instructor_courses.title}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className={`text-xs ${color}`}>{grade}</Badge>
                    <Badge variant={p.status === 'completed' ? 'default' : 'secondary'} className="text-xs">{p.status}</Badge>
                    {p.final_score != null && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Star className="h-3 w-3 text-amber-500" />{Math.round(p.final_score * 100)}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
