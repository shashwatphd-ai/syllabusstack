/**
 * EmployerCapstoneTab — Capstone-aware employer dashboard tab
 * Shows matched projects, student applicants, and partnership status.
 */

import { useState } from 'react';
import { Briefcase, Users, Star, MapPin, Building2, GraduationCap, Target, Clock, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useEmployerMatchedProjects, useProjectApplicants } from '@/hooks/useDemandBoard';

interface EmployerCapstoneTabProps {
  companyName: string;
}

export function EmployerCapstoneTab({ companyName }: EmployerCapstoneTabProps) {
  const [domain, setDomain] = useState('');
  const [searchDomain, setSearchDomain] = useState('');
  const { data: projects, isLoading: projectsLoading } = useEmployerMatchedProjects(searchDomain || undefined);

  const projectIds = (projects || []).map((p: any) => p.id);
  const { data: applicants } = useProjectApplicants(projectIds);

  const handleSearch = () => {
    setSearchDomain(domain);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          Capstone Projects
        </h2>
        <Badge variant="secondary">{projects?.length || 0} matched</Badge>
      </div>

      {/* Domain search */}
      <div className="flex gap-2 max-w-lg">
        <Input
          placeholder="Enter your company domain (e.g., acme.com)"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button onClick={handleSearch} disabled={!domain}>
          Find Projects
        </Button>
      </div>

      {!searchDomain ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Enter your company domain to find matched capstone projects</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="projects" className="space-y-4">
          <TabsList>
            <TabsTrigger value="projects" className="gap-1.5">
              <Briefcase className="h-3.5 w-3.5" /> Matched Projects
            </TabsTrigger>
            <TabsTrigger value="applicants" className="gap-1.5">
              <Users className="h-3.5 w-3.5" /> Student Applicants
            </TabsTrigger>
          </TabsList>

          <TabsContent value="projects">
            {projectsLoading ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : !projects?.length ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No matched projects found for this domain.</p>
                  <p className="text-xs mt-1">Projects are generated from university course discovery — check back soon.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {projects.map((project: any) => {
                  const company = project.company_profiles;
                  return (
                    <Card key={project.id}>
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="text-sm font-medium">{project.title}</p>
                            {company && (
                              <p className="text-xs text-muted-foreground">
                                {company.name} · {company.sector}
                                {company.city && ` · ${company.city}, ${company.state}`}
                              </p>
                            )}
                            {project.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
                            )}
                            <div className="flex flex-wrap gap-1 pt-1">
                              {project.skills?.slice(0, 5).map((s: string) => (
                                <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                              ))}
                            </div>
                          </div>
                          <div className="text-right shrink-0 space-y-1">
                            {project.final_score != null && (
                              <div className="flex items-center gap-1 text-xs">
                                <Star className="h-3 w-3 text-amber-500" />
                                <span className="font-medium">{Math.round(project.final_score * 100)}</span>
                              </div>
                            )}
                            <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-[10px]">
                              {project.status}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="applicants">
            {!applicants?.length ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <GraduationCap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No student applications yet.</p>
                  <p className="text-xs mt-1">Students will appear here once they apply to your matched projects.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {applicants.map((app: any) => (
                  <Card key={app.id}>
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <GraduationCap className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{app.profiles?.full_name || 'Student'}</p>
                          <p className="text-xs text-muted-foreground">{app.profiles?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={app.status === 'pending' ? 'secondary' : app.status === 'accepted' ? 'default' : 'destructive'} className="text-[10px]">
                          {app.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(app.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
