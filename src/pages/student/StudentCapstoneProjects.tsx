import { useState } from 'react';
import { Briefcase, Building2, MapPin, Send, Star, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { useBrowseProjects, useApplyToProject, useStudentApplications } from '@/hooks/useCapstoneApplications';
import { useStudentProjectRecommendations } from '@/hooks/useStudentProjectRecommendations';

export default function StudentCapstoneProjects() {
  const { data: projects, isLoading } = useBrowseProjects();
  const { data: applications } = useStudentApplications();
  const { data: recommendations, isLoading: loadingRecs } = useStudentProjectRecommendations();
  const applyMutation = useApplyToProject();
  const [search, setSearch] = useState('');
  const [applyProject, setApplyProject] = useState<any>(null);
  const [coverLetter, setCoverLetter] = useState('');

  const appliedIds = new Set((applications || []).map((a: any) => a.capstone_project_id));
  const filtered = (projects || []).filter((p: any) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.company_profiles?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleApply = () => {
    if (!applyProject) return;
    applyMutation.mutate({ projectId: applyProject.id, coverLetter }, {
      onSuccess: () => { setApplyProject(null); setCoverLetter(''); },
    });
  };

  const renderProjectCard = (project: any, isRecommended = false) => {
    const company = project.company_profiles;
    const hasApplied = appliedIds.has(project.id);

    return (
      <Card key={project.id} className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm line-clamp-2">{project.title}</CardTitle>
          {company && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span>{company.name}</span>
              {company.sector && <span>· {company.sector}</span>}
            </div>
          )}
          {company?.city && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{company.city}{company.state ? `, ${company.state}` : ''}</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="flex-1 space-y-3">
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-3">{project.description}</p>
          )}
          {isRecommended && project.match_reason && (
            <p className="text-xs text-primary font-medium">{project.match_reason}</p>
          )}
          {project.skills && project.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {project.skills.slice(0, 4).map((s: string) => (
                <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
              ))}
              {project.skills.length > 4 && (
                <Badge variant="outline" className="text-[10px]">+{project.skills.length - 4}</Badge>
              )}
            </div>
          )}
          {project.final_score != null && (
            <div className="flex items-center gap-1 text-xs">
              <Star className="h-3 w-3 text-amber-500" />
              <span className="font-medium">{Math.round(project.final_score * 100)}</span>
              <span className="text-muted-foreground">match score</span>
            </div>
          )}
          <Button
            size="sm"
            className="w-full gap-1.5 mt-auto"
            disabled={hasApplied || applyMutation.isPending}
            onClick={() => setApplyProject(project)}
          >
            <Send className="h-3 w-3" />
            {hasApplied ? 'Applied' : 'Apply Now'}
          </Button>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Capstone Projects
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Browse and apply to available industry projects</p>
        </div>
        <Badge variant="secondary">{filtered.length} Available</Badge>
      </div>

      {/* Recommended for You */}
      {!loadingRecs && recommendations && recommendations.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Recommended for You
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recommendations.slice(0, 3).map((rec: any) => renderProjectCard(rec, true))}
          </div>
        </div>
      )}

      <Input
        placeholder="Search by project or company name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project: any) => renderProjectCard(project))}
        </div>
      )}

      {/* Application Dialog */}
      <Dialog open={!!applyProject} onOpenChange={(o) => !o && setApplyProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply to: {applyProject?.title}</DialogTitle>
            <DialogDescription>
              {applyProject?.company_profiles?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Why are you a good fit for this project? (optional)"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyProject(null)}>Cancel</Button>
            <Button onClick={handleApply} disabled={applyMutation.isPending} className="gap-1.5">
              <Send className="h-4 w-4" />
              {applyMutation.isPending ? 'Submitting...' : 'Submit Application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
