import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';
import { analyzeSyllabus, analyzeDreamJob, performGapAnalysis, generateRecommendations, SkillGap } from '@/lib/api';
import { TablesInsert } from '@/integrations/supabase/types';

type CourseInsert = Omit<TablesInsert<'courses'>, 'user_id'>;
type DreamJobInsert = Omit<TablesInsert<'dream_jobs'>, 'user_id'>;

interface AddCourseParams {
  course: CourseInsert;
  syllabusText?: string;
}

interface AddDreamJobParams {
  job: DreamJobInsert;
  triggerAnalysis?: boolean;
}

// Full workflow for adding a course with syllabus analysis
async function addCourseWithAnalysis({ course, syllabusText }: AddCourseParams) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Create the course
  const { data: newCourse, error: courseError } = await supabase
    .from('courses')
    .insert({ ...course, user_id: user.id })
    .select()
    .single();

  if (courseError) throw courseError;

  // 2. If syllabus text provided, analyze it
  if (syllabusText && syllabusText.trim()) {
    try {
      const analysisResult = await analyzeSyllabus(syllabusText, newCourse.id);
      
      // 3. Update course with extracted capabilities
      if (analysisResult.capabilities && analysisResult.capabilities.length > 0) {
        await supabase
          .from('courses')
          .update({
            key_capabilities: analysisResult.capabilities.map(c => c.name),
            capability_text: syllabusText.substring(0, 5000),
          })
          .eq('id', newCourse.id);

        // 4. Save individual capabilities
        const capabilitiesToInsert = analysisResult.capabilities.map(cap => ({
          user_id: user.id,
          course_id: newCourse.id,
          name: cap.name,
          category: cap.category || 'General',
          proficiency_level: cap.proficiency_level || 'developing',
          source: 'course',
        }));

        await supabase.from('capabilities').insert(capabilitiesToInsert);
      }
    } catch (analysisError) {
      console.error('Syllabus analysis failed:', analysisError);
      // Course is still created, just without analysis
    }
  }

  return newCourse;
}

// Full workflow for adding a dream job with analysis
async function addDreamJobWithAnalysis({ job, triggerAnalysis = true }: AddDreamJobParams) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // 1. Create the dream job
  const { data: newJob, error: jobError } = await supabase
    .from('dream_jobs')
    .insert({ ...job, user_id: user.id })
    .select()
    .single();

  if (jobError) throw jobError;

  // 2. Analyze job requirements if requested
  if (triggerAnalysis) {
    try {
      const analysisResult = await analyzeDreamJob(
        job.title,
        job.company_type || undefined,
        job.location || undefined,
        newJob.id
      );

      // 3. Update dream job with analysis results
      if (analysisResult) {
        await supabase
          .from('dream_jobs')
          .update({
            day_one_capabilities: analysisResult.day_one_capabilities?.slice(0, 10).map(r => r.requirement) || [],
            realistic_bar: analysisResult.realistic_bar || null,
            differentiators: analysisResult.differentiators || [],
            common_misconceptions: analysisResult.common_misconceptions || [],
          })
          .eq('id', newJob.id);

        // 4. Save job requirements
        if (analysisResult.requirements) {
          const requirementsToInsert = analysisResult.requirements.map(req => ({
            dream_job_id: newJob.id,
            skill_name: req.skill_name,
            importance: req.importance || 'important',
            category: req.category || 'General',
          }));

          await supabase.from('job_requirements').insert(requirementsToInsert);
        }
      }
    } catch (analysisError) {
      console.error('Dream job analysis failed:', analysisError);
    }
  }

  return newJob;
}

// Refresh gap analysis for a specific dream job
async function refreshGapAnalysis(dreamJobId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Perform gap analysis
  const gapResult = await performGapAnalysis(dreamJobId);

  // Update or insert gap analysis record
  const { data: existingAnalysis } = await supabase
    .from('gap_analyses')
    .select('id')
    .eq('dream_job_id', dreamJobId)
    .eq('user_id', user.id)
    .single();

  const analysisData = {
    user_id: user.id,
    dream_job_id: dreamJobId,
    match_score: gapResult.match_score || 0,
    strong_overlaps: gapResult.strong_overlaps || [],
    partial_overlaps: gapResult.partial_overlaps || [],
    critical_gaps: gapResult.critical_gaps || [],
    priority_gaps: gapResult.priority_gaps || [],
    honest_assessment: gapResult.honest_assessment || null,
    readiness_level: gapResult.readiness_level || null,
    interview_readiness: gapResult.interview_readiness || null,
    job_success_prediction: gapResult.job_success_prediction || null,
  };

  if (existingAnalysis) {
    await supabase
      .from('gap_analyses')
      .update(analysisData)
      .eq('id', existingAnalysis.id);
  } else {
    await supabase.from('gap_analyses').insert(analysisData);
  }

  // Generate recommendations based on gaps
  const gapsToRecommend = gapResult.gaps || [];
  
  if (gapsToRecommend.length > 0) {
    try {
      await generateRecommendations(dreamJobId, gapsToRecommend);
    } catch (recError) {
      console.error('Failed to generate recommendations:', recError);
    }
  }

  return gapResult;
}

// Refresh all analyses for all dream jobs
async function refreshAllAnalyses() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: dreamJobs } = await supabase
    .from('dream_jobs')
    .select('id')
    .eq('user_id', user.id);

  if (!dreamJobs || dreamJobs.length === 0) {
    throw new Error('No dream jobs found');
  }

  const results = await Promise.allSettled(
    dreamJobs.map(job => refreshGapAnalysis(job.id))
  );

  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  return { succeeded, failed, total: dreamJobs.length };
}

// Hooks
export function useAddCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addCourseWithAnalysis,
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.courses });
      queryClient.invalidateQueries({ queryKey: queryKeys.capabilities });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      
      toast({
        title: 'Course added',
        description: 'Your course has been added and analyzed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error adding course',
        description: error instanceof Error ? error.message : 'Failed to add course',
        variant: 'destructive',
      });
    },
  });
}

export function useAddDreamJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addDreamJobWithAnalysis,
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.dreamJobs });
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      
      toast({
        title: 'Dream job added',
        description: 'Your dream job has been saved and analyzed.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error adding dream job',
        description: error instanceof Error ? error.message : 'Failed to add dream job',
        variant: 'destructive',
      });
    },
  });
}

export function useRefreshAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshGapAnalysis,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      
      toast({
        title: 'Analysis refreshed',
        description: 'Your gap analysis has been updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error refreshing analysis',
        description: error instanceof Error ? error.message : 'Failed to refresh analysis',
        variant: 'destructive',
      });
    },
  });
}

export function useRefreshAllAnalyses() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: refreshAllAnalyses,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.analysis });
      queryClient.invalidateQueries({ queryKey: queryKeys.recommendations });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all });
      
      toast({
        title: 'Analyses refreshed',
        description: `Updated ${result.succeeded} of ${result.total} analyses.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Error refreshing analyses',
        description: error instanceof Error ? error.message : 'Failed to refresh analyses',
        variant: 'destructive',
      });
    },
  });
}
