import { useState } from 'react';
import { FileText, Download, Award, Briefcase, GraduationCap, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { useToast } from '@/hooks/use-toast';

export default function StudentPortfolio() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch portfolio data
  const { data: portfolio, isLoading } = useQuery({
    queryKey: queryKeys.portfolio.data(),
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('portfolio-export', {
        body: { format: 'json' },
      });
      if (error) throw error;
      return data;
    },
  });

  // Export as HTML/PDF
  const exportMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('portfolio-export', {
        body: { format: 'html' },
      });
      if (error) throw error;

      // Open HTML in new tab for printing/PDF
      const blob = new Blob([data], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    },
    onSuccess: () => {
      toast({ title: 'Portfolio Exported', description: 'Opened in new tab. Use Ctrl+P to save as PDF.' });
    },
    onError: (error) => {
      toast({ title: 'Export Failed', description: String(error), variant: 'destructive' });
    },
  });

  const sections = portfolio?.sections || {};
  const student = portfolio?.student || {};

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            My Portfolio
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your verified skills, projects, and certifications in one place
          </p>
        </div>
        <Button onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>
          <Download className="h-4 w-4 mr-2" />
          {exportMutation.isPending ? 'Generating...' : 'Export Portfolio'}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">{sections.verified_skills?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Verified Skills</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Briefcase className="h-5 w-5 mx-auto text-blue-600 mb-1" />
            <p className="text-2xl font-bold">{sections.capstone_projects?.completed || 0}</p>
            <p className="text-xs text-muted-foreground">Projects</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <Award className="h-5 w-5 mx-auto text-amber-600 mb-1" />
            <p className="text-2xl font-bold">{sections.certificates?.total || 0}</p>
            <p className="text-xs text-muted-foreground">Certificates</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 text-center">
            <GraduationCap className="h-5 w-5 mx-auto text-indigo-600 mb-1" />
            <p className="text-2xl font-bold">{sections.course_enrollments?.completed || 0}</p>
            <p className="text-xs text-muted-foreground">Courses</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Skills</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="matches">Job Matches</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Verified Skills</CardTitle>
            </CardHeader>
            <CardContent>
              {(sections.verified_skills?.skills || []).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No verified skills yet. Complete assessments or capstone projects to earn skill verifications.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(sections.verified_skills?.skills || []).map((skill: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-sm py-1 px-3">
                      {skill.skill_name}
                      {skill.proficiency_level && (
                        <span className="ml-1 text-xs opacity-60">({skill.proficiency_level})</span>
                      )}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="mt-4 space-y-4">
          {(sections.capstone_projects?.projects || []).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No capstone projects yet.
              </CardContent>
            </Card>
          ) : (
            (sections.capstone_projects?.projects || []).map((project: any, i: number) => (
              <Card key={i}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{project.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {project.company} {project.sector ? `· ${project.sector}` : ''}
                        {project.location ? ` · ${project.location}` : ''}
                      </p>
                    </div>
                    <Badge variant={project.status === 'completed' ? 'default' : 'secondary'}>
                      {project.status}
                    </Badge>
                  </div>
                  {project.description && (
                    <p className="text-sm mt-2 text-muted-foreground">
                      {project.description.slice(0, 200)}{project.description.length > 200 ? '...' : ''}
                    </p>
                  )}
                  {project.skills?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {project.skills.map((s: string, j: number) => (
                        <Badge key={j} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="certificates" className="mt-4 space-y-4">
          {(sections.certificates?.certificates || []).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No certificates earned yet.
              </CardContent>
            </Card>
          ) : (
            (sections.certificates?.certificates || []).map((cert: any, i: number) => (
              <Card key={i} className="bg-amber-50/50 border-amber-200">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Award className="h-5 w-5 text-amber-600" />
                      <div>
                        <h3 className="font-semibold capitalize">{cert.type?.replace('_', ' ')}</h3>
                        <p className="text-xs text-muted-foreground">#{cert.number}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {cert.mastery_score && (
                        <p className="font-semibold text-green-600">{cert.mastery_score}%</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(cert.issued_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="matches" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Top Job Matches</CardTitle>
            </CardHeader>
            <CardContent>
              {(sections.job_matches?.top_matches || []).length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No job matches yet. Visit the Job Matches page to run the matcher.
                </p>
              ) : (
                <div className="space-y-3">
                  {(sections.job_matches?.top_matches || []).map((m: any, i: number) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div>
                        <p className="font-medium text-sm">{m.job_title}</p>
                        <p className="text-xs text-muted-foreground">{m.company} {m.location ? `· ${m.location}` : ''}</p>
                      </div>
                      <Badge variant={m.match_score >= 0.7 ? 'default' : 'secondary'}>
                        {Math.round(m.match_score * 100)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
