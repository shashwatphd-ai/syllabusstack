import { useState, useMemo } from 'react';
import { Building2, Loader2, Search, Sparkles, AlertCircle, MapPin, ArrowUpDown, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useInstructorCourse } from '@/hooks/useInstructorCourses';
import { useLearningObjectives } from '@/hooks/useLearningObjectives';
import {
  useCompanyProfiles,
  useCapstoneProjects,
  useDiscoverCompanies,
  useGenerateCapstoneProjects,
  useReEnrichAddresses,
  type CompanyProfile,
} from '@/hooks/useCapstoneProjects';
import { LocationSetup } from './LocationSetup';
import { CompanyCard } from './CompanyCard';
import { CapstoneProjectCard } from './CapstoneProjectCard';
import { ProjectReportView } from './ProjectReportView';
import { AssignStudentDialog } from './AssignStudentDialog';

interface CapstoneProjectsTabProps {
  courseId: string;
}

type SortKey = 'composite' | 'skill' | 'market' | 'department' | 'contact' | 'match';
type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';

const sortOptions: { value: SortKey; label: string }[] = [
  { value: 'composite', label: 'Composite Score' },
  { value: 'skill', label: 'Skill Match' },
  { value: 'market', label: 'Market Signal' },
  { value: 'department', label: 'Department Fit' },
  { value: 'contact', label: 'Contact Quality' },
  { value: 'match', label: 'Match Score' },
];

function getSortValue(company: CompanyProfile, key: SortKey): number {
  switch (key) {
    case 'composite': return company.composite_signal_score ?? company.match_score ?? 0;
    case 'skill': return company.skill_match_score ?? 0;
    case 'market': return company.market_signal_score ?? 0;
    case 'department': return company.department_fit_score ?? 0;
    case 'contact': return company.contact_quality_score ?? 0;
    case 'match': return company.match_score ?? 0;
  }
}

export function CapstoneProjectsTab({ courseId }: CapstoneProjectsTabProps) {
  const { data: course } = useInstructorCourse(courseId);
  const { data: los } = useLearningObjectives(courseId);
  const { data: companies, isLoading: loadingCompanies } = useCompanyProfiles(courseId);
  const { data: projects, isLoading: loadingProjects } = useCapstoneProjects(courseId);
  const discoverCompanies = useDiscoverCompanies();
  const generateProjects = useGenerateCapstoneProjects();
  const reEnrichAddresses = useReEnrichAddresses();

  const [detailProjectId, setDetailProjectId] = useState<string | null>(null);
  const [assignProjectId, setAssignProjectId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>('composite');
  const [confidenceFilter, setConfidenceFilter] = useState<ConfidenceFilter>('all');

  const hasLocation = !!(course?.location_city || course?.location_state || course?.search_location);
  const hasLOs = (los?.length ?? 0) > 0;

  const sortedCompanies = useMemo(() => {
    if (!companies) return [];
    let filtered = [...companies];
    if (confidenceFilter !== 'all') {
      filtered = filtered.filter(c =>
        (c.signal_confidence || c.match_confidence) === confidenceFilter
      );
    }
    filtered.sort((a, b) => getSortValue(b, sortBy) - getSortValue(a, sortBy));
    return filtered;
  }, [companies, sortBy, confidenceFilter]);

  return (
    <div className="space-y-6">
      {/* Location Setup */}
      {!hasLocation && (
        <LocationSetup courseId={courseId} initialValues={course} autoDetect />
      )}

      {/* Company Discovery */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Discovered Companies
            {companies && companies.length > 0 && (
              <span className="text-xs font-normal text-muted-foreground">({sortedCompanies.length}{confidenceFilter !== 'all' ? ` of ${companies.length}` : ''})</span>
            )}
          </h3>
          <div className="flex gap-2 flex-wrap">
            {companies && companies.length > 0 && (
              <Button size="sm" variant="ghost" className="gap-2" onClick={() => reEnrichAddresses.mutate(courseId)} disabled={reEnrichAddresses.isPending}>
                {reEnrichAddresses.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
                {reEnrichAddresses.isPending ? 'Updating...' : 'Update Addresses'}
              </Button>
            )}
            <Button size="sm" variant="outline" className="gap-2" onClick={() => discoverCompanies.mutate(courseId)} disabled={discoverCompanies.isPending || !hasLocation || !hasLOs} title={!hasLOs ? 'Add learning objectives first' : !hasLocation ? 'Set course location first' : undefined}>
              {discoverCompanies.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              {discoverCompanies.isPending ? 'Discovering...' : 'Discover Companies'}
            </Button>
          </div>
        </div>

        {/* Sort & Filter Controls */}
        {companies && companies.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                <SelectTrigger className="h-7 text-xs w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <Select value={confidenceFilter} onValueChange={(v) => setConfidenceFilter(v as ConfidenceFilter)}>
                <SelectTrigger className="h-7 text-xs w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Confidence</SelectItem>
                  <SelectItem value="high" className="text-xs">High Only</SelectItem>
                  <SelectItem value="medium" className="text-xs">Medium Only</SelectItem>
                  <SelectItem value="low" className="text-xs">Low Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {loadingCompanies ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading companies...
          </div>
        ) : sortedCompanies.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedCompanies.map(c => (
              <CompanyCard key={c.id} company={c} />
            ))}
          </div>
        ) : companies && companies.length > 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No companies match the "{confidenceFilter}" confidence filter. Try "All Confidence".
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
              {!hasLOs
                ? 'Add learning objectives to your course first (in the Course Structure tab), then discover companies.'
                : !hasLocation
                  ? 'Set your course location above, then click "Discover Companies" to find industry partners.'
                  : 'No companies discovered yet. Click "Discover Companies" to find industry partners near your course location.'}
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
          <Button size="sm" className="gap-2" onClick={() => generateProjects.mutate(courseId)} disabled={generateProjects.isPending || !companies || companies.length === 0}>
            {generateProjects.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
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
              <CapstoneProjectCard key={p.id} project={p} onViewDetail={() => setDetailProjectId(p.id)} onAssign={() => setAssignProjectId(p.id)} />
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

      {detailProjectId && (
        <ProjectReportView projectId={detailProjectId} courseId={courseId} open={!!detailProjectId} onOpenChange={(open) => !open && setDetailProjectId(null)} />
      )}
      {assignProjectId && (
        <AssignStudentDialog projectId={assignProjectId} courseId={courseId} open={!!assignProjectId} onOpenChange={(open) => !open && setAssignProjectId(null)} />
      )}
    </div>
  );
}
