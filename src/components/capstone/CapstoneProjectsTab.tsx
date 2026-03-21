import { useState } from 'react';
import { Building2, Loader2, Search, Sparkles, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useInstructorCourse } from '@/hooks/useInstructorCourses';
import {
  useCompanyProfiles,
  useCapstoneProjects,
  useDiscoverCompanies,
  useGenerateCapstoneProjects,
  useAssignStudent,
} from '@/hooks/useCapstoneProjects';
import { useCourseStudents } from '@/hooks/useInstructorCourses';
import { LocationSetup } from './LocationSetup';
import { CompanyCard } from './CompanyCard';
import { CapstoneProjectCard } from './CapstoneProjectCard';
import { ProjectDetailView } from './ProjectDetailView';
import { AssignStudentDialog } from './AssignStudentDialog';

interface CapstoneProjectsTabProps {
  courseId: string;
}

export function CapstoneProjectsTab({ courseId }: CapstoneProjectsTabProps) {
  const { data: course } = useInstructorCourse(courseId);
  const { data: companies, isLoading: loadingCompanies } = useCompanyProfiles(courseId);
  const { data: projects, isLoading: loadingProjects } = useCapstoneProjects(courseId);
  const discoverCompanies = useDiscoverCompanies();
  const generateProjects = useGenerateCapstoneProjects();

  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const [assignProjectId, setAssignProjectId] = useState<string | null>(null);

  const hasLocation = !!(course?.location_city || course?.location_state || course?.search_location);

  return (
    <div className="space-y-6">
      {/* Location Setup — show if no location set */}
      {!hasLocation && (
        <LocationSetup
          courseId={courseId}
          initialValues={course}
          autoDetect
        />
      )}

      {/* Company Discovery */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Discovered Companies
          </h3>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => discoverCompanies.mutate(courseId)}
            disabled={discoverCompanies.isPending}
          >
            {discoverCompanies.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            {discoverCompanies.isPending ? 'Discovering...' : 'Discover Companies'}
          </Button>
        </div>

        {loadingCompanies ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading companies...
          </div>
        ) : companies && companies.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {companies.map(c => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No companies discovered yet. Click "Discover Companies" to find industry partners near your course location.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Project Generation */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Capstone Projects
          </h3>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => generateProjects.mutate(courseId)}
            disabled={generateProjects.isPending || !companies || companies.length === 0}
          >
            {generateProjects.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {generateProjects.isPending ? 'Generating...' : 'Generate Projects'}
          </Button>
        </div>

        {loadingProjects ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading projects...
          </div>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {projects.map(p => (
              <CapstoneProjectCard
                key={p.id}
                project={p}
                onViewDetail={() => setDetailProjectId(p.id)}
                onAssign={() => setAssignProjectId(p.id)}
              />
            ))}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No projects generated yet. Discover companies first, then generate AI-powered capstone project proposals.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Project Detail Dialog */}
      {detailProjectId && (
        <ProjectDetailView
          projectId={detailProjectId}
          courseId={courseId}
          open={!!detailProjectId}
          onOpenChange={(open) => !open && setDetailProjectId(null)}
        />
      )}

      {/* Assign Student Dialog */}
      {assignProjectId && (
        <AssignStudentDialog
          projectId={assignProjectId}
          courseId={courseId}
          open={!!assignProjectId}
          onOpenChange={(open) => !open && setAssignProjectId(null)}
        />
      )}
    </div>
  );
}
