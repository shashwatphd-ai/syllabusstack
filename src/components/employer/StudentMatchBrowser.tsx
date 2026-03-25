import { useState } from 'react';
import { Users, Search, Star, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface StudentMatch {
  student_id: string;
  student_name: string;
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
  project_title: string | null;
  project_status: string | null;
}

interface StudentMatchBrowserProps {
  employerAccountId: string;
}

/**
 * Employer-facing view of students matched to their job postings.
 * Shows students from job_matches where company_profile_id belongs to the employer.
 */
export default function StudentMatchBrowser({ employerAccountId }: StudentMatchBrowserProps) {
  const [search, setSearch] = useState('');

  const { data: matches, isLoading } = useQuery({
    queryKey: ['employer-student-matches', employerAccountId],
    queryFn: async () => {
      // Fetch job matches linked to employer's companies
      const { data: companies } = await supabase
        .from('company_profiles')
        .select('id')
        .limit(50);

      if (!companies?.length) return [];

      const companyIds = companies.map(c => c.id);

      const { data: jobMatches, error } = await (supabase as any)
        .from('job_matches')
        .select('student_id, job_title, company_name, match_score, skill_overlap, status')
        .in('company_profile_id', companyIds)
        .order('match_score', { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!jobMatches?.length) return [];

      // Fetch student names
      const studentIds = [...new Set((jobMatches as any[]).map((m: any) => m.student_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', studentIds);

      const nameMap = new Map((profiles || []).map(p => [p.id, p.full_name]));

      return (jobMatches as any[]).map((m: any) => ({
        student_id: m.student_id,
        student_name: nameMap.get(m.student_id) || 'Student',
        match_score: m.match_score,
        matched_skills: m.skill_overlap?.matched || [],
        missing_skills: m.skill_overlap?.missing || [],
        project_title: m.job_title,
        project_status: m.status,
      })) as StudentMatch[];
    },
    enabled: !!employerAccountId,
  });

  const filtered = (matches || []).filter(m =>
    !search || m.student_name.toLowerCase().includes(search.toLowerCase()) ||
    m.matched_skills.some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Student Matches
        </CardTitle>
        <CardDescription>
          Students whose skills match your job postings and project requirements
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or skill..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{filtered.length} students</Badge>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No student matches found. Run company discovery and project generation first.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((match, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{match.student_name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {match.project_title}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {match.matched_skills.slice(0, 5).map(skill => (
                      <Badge key={skill} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                        <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                        {skill}
                      </Badge>
                    ))}
                    {match.matched_skills.length > 5 && (
                      <Badge variant="outline" className="text-xs">
                        +{match.matched_skills.length - 5}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <div className="text-center">
                    <div className={`text-lg font-bold ${match.match_score >= 0.7 ? 'text-green-600' : 'text-amber-600'}`}>
                      {Math.round(match.match_score * 100)}%
                    </div>
                    <span className="text-xs text-muted-foreground">match</span>
                  </div>
                  <Star className={`h-4 w-4 ${match.match_score >= 0.8 ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
