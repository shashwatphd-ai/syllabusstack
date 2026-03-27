import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface GenerationProgressCardProps {
  courseId: string;
  isActive: boolean;
}

interface GenerationRun {
  id: string;
  status: string;
  current_phase: string | null;
  phases_completed: string[] | null;
  companies_discovered: number | null;
  companies_saved: number | null;
  companies_validated: number | null;
  projects_generated: number | null;
  total_processing_time_ms: number | null;
  error_details: any;
  created_at: string;
  completed_at: string | null;
}

const PIPELINE_PHASES = [
  { key: 'fetch_course', label: 'Course Data' },
  { key: 'soc_mapping', label: 'SOC Mapping' },
  { key: 'onet_mapping', label: 'O*NET Enrichment' },
  { key: 'skill_extraction', label: 'Skill Extraction' },
  { key: 'discovery', label: 'Company Search' },
  { key: 'filtering', label: 'Industry Filtering' },
  { key: 'validation', label: 'AI Validation' },
  { key: 'semantic_matching', label: 'Semantic Matching' },
  { key: 'enrichment', label: 'Deep Enrichment' },
  { key: 'signal_scoring', label: 'Signal Scoring' },
];

function useLatestGenerationRun(courseId: string, isActive: boolean) {
  return useQuery({
    queryKey: ['capstone-generation-run', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('capstone_generation_runs')
        .select('*')
        .eq('instructor_course_id', courseId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as GenerationRun | null;
    },
    enabled: !!courseId,
    refetchInterval: isActive ? 3000 : false,
  });
}

export function GenerationProgressCard({ courseId, isActive }: GenerationProgressCardProps) {
  const { data: run } = useLatestGenerationRun(courseId, isActive);

  if (!run) return null;

  const isRunning = run.status === 'running' || run.status === 'pending';
  const isFailed = run.status === 'failed';
  const isComplete = run.status === 'completed';
  const completedPhases = run.phases_completed || [];
  const currentPhase = run.current_phase;

  const progressPct = Math.round((completedPhases.length / PIPELINE_PHASES.length) * 100);
  const elapsed = run.total_processing_time_ms
    ? `${(run.total_processing_time_ms / 1000).toFixed(1)}s`
    : run.created_at
      ? `${Math.round((Date.now() - new Date(run.created_at).getTime()) / 1000)}s`
      : null;

  if (!isRunning && !isFailed && !isActive) return null;

  return (
    <Card className={isFailed ? 'border-destructive/50' : isComplete ? 'border-green-500/50' : 'border-primary/30'}>
      <CardContent className="pt-4 pb-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isRunning && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
            {isComplete && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {isFailed && <XCircle className="h-4 w-4 text-destructive" />}
            <span className="text-sm font-semibold">
              {isRunning ? 'Discovery in Progress' : isComplete ? 'Discovery Complete' : 'Discovery Failed'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {elapsed && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" /> {elapsed}
              </span>
            )}
            <Badge variant={isRunning ? 'default' : isFailed ? 'destructive' : 'secondary'} className="text-[10px]">
              {progressPct}%
            </Badge>
          </div>
        </div>

        {/* Progress bar */}
        <Progress value={progressPct} className="h-2" />

        {/* Phase list */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
          {PIPELINE_PHASES.map((phase) => {
            const done = completedPhases.includes(phase.key);
            const active = currentPhase === phase.key;
            return (
              <div
                key={phase.key}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] ${
                  done ? 'bg-green-500/10 text-green-700' :
                  active ? 'bg-primary/10 text-primary font-medium' :
                  'bg-muted text-muted-foreground'
                }`}
              >
                {done && <CheckCircle2 className="h-2.5 w-2.5 shrink-0" />}
                {active && <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" />}
                <span className="truncate">{phase.label}</span>
              </div>
            );
          })}
        </div>

        {/* Metrics */}
        {(run.companies_discovered || run.companies_saved || run.projects_generated) && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            {run.companies_discovered != null && <span>Discovered: {run.companies_discovered}</span>}
            {run.companies_validated != null && <span>Validated: {run.companies_validated}</span>}
            {run.companies_saved != null && <span>Saved: {run.companies_saved}</span>}
            {run.projects_generated != null && <span>Projects: {run.projects_generated}</span>}
          </div>
        )}

        {/* Error */}
        {isFailed && run.error_details && (
          <p className="text-xs text-destructive">
            {typeof run.error_details === 'string' ? run.error_details : (run.error_details as any)?.message || 'An error occurred during discovery.'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
