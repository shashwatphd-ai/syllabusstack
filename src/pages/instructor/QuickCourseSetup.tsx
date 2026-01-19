import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Loader2, CheckCircle2, BookOpen, Sparkles, ArrowRight, AlertCircle, Video, Clock } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { AppShell } from '@/components/layout/AppShell';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ProcessingResult {
  course_title?: string;
  course_description?: string;
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    sequence_order: number;
  }>;
  learning_objectives: Array<{
    id: string;
    text: string;
    module_id: string | null;
    bloom_level: string;
  }>;
  module_count: number;
  lo_count: number;
}

type Step =
  | 'upload'
  | 'extracting'
  | 'analyzing'
  | 'creating_course'
  | 'saving_structure'
  | 'finding_content'
  | 'evaluating_content'
  | 'complete'
  | 'error';

const STEP_INFO: Record<Step, { label: string; progress: number; description: string }> = {
  upload: { label: 'Upload Syllabus', progress: 0, description: 'Drag and drop your syllabus PDF' },
  extracting: { label: 'Extracting Text', progress: 15, description: 'Reading document content with AI...' },
  analyzing: { label: 'Analyzing Structure', progress: 35, description: 'Identifying modules and learning objectives...' },
  creating_course: { label: 'Creating Course', progress: 50, description: 'Setting up your course...' },
  saving_structure: { label: 'Saving Structure', progress: 60, description: 'Saving modules and objectives...' },
  finding_content: { label: 'Finding Content', progress: 75, description: 'Searching for matching videos...' },
  evaluating_content: { label: 'Evaluating Videos', progress: 90, description: 'AI is scoring videos for pedagogical fit...' },
  complete: { label: 'Complete!', progress: 100, description: 'Your course is ready!' },
  error: { label: 'Error', progress: 0, description: 'Something went wrong' },
};

export default function QuickCourseSetupPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [courseName, setCourseName] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [result, setResult] = useState<ProcessingResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [createdCourseId, setCreatedCourseId] = useState<string | null>(null);
  const [contentProgress, setContentProgress] = useState({ current: 0, total: 0 });
  const [evaluationBatchJobId, setEvaluationBatchJobId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      // Auto-extract course name from filename
      const fileName = acceptedFiles[0].name.replace(/\.[^/.]+$/, '');
      if (!courseName) {
        setCourseName(fileName.replace(/[-_]/g, ' '));
      }
    }
  }, [courseName]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
  });

  const processEverything = async () => {
    if (!file) return;
    
    abortControllerRef.current = new AbortController();
    
    try {
      // Step 1: Create the course first
      setStep('creating_course');
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate access code
      const accessCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const { data: course, error: courseError } = await supabase
        .from('instructor_courses')
        .insert({
          title: courseName || file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          code: courseCode || null,
          description: null,
          instructor_id: user.id,
          curation_mode: 'guided_auto',
          verification_threshold: 70,
          is_published: false,
          access_code: accessCode,
        })
        .select()
        .single();

      if (courseError) throw courseError;
      const courseId = course.id;  // Capture in local variable for immediate use
      setCreatedCourseId(courseId);
      
      // Step 2: Extract text and analyze structure
      setStep('extracting');
      
      // Convert file to base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      
      setStep('analyzing');
      
      // Call process-syllabus edge function
      const { data: processResult, error: processError } = await supabase.functions.invoke('process-syllabus', {
        body: {
          document_base64: base64,
          instructor_course_id: course.id,
          file_name: file.name,
        },
      });

      if (processError) throw processError;
      if (processResult.error) throw new Error(processResult.error);

      setStep('saving_structure');
      
      // Update course with extracted title/description if available
      if (processResult.course_title || processResult.course_description) {
        await supabase
          .from('instructor_courses')
          .update({
            title: courseName || processResult.course_title || course.title,
            description: processResult.course_description || null,
          })
          .eq('id', course.id);
      }

      setResult(processResult);
      
      // Step 3: Find content for all learning objectives
      setStep('finding_content');
      
      const learningObjectives = processResult.learning_objectives || [];
      setContentProgress({ current: 0, total: learningObjectives.length });
      
      // Process LOs in batches of 3 for better performance
      const batchSize = 3;
      for (let i = 0; i < learningObjectives.length; i += batchSize) {
        const batch = learningObjectives.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (lo: any) => {
          try {
            await supabase.functions.invoke('search-youtube-content', {
              body: {
                learning_objective_id: lo.id,
                core_concept: lo.core_concept || lo.text.substring(0, 50),
                bloom_level: lo.bloom_level || 'understand',
                domain: lo.domain || 'other',
                search_keywords: lo.search_keywords || [],
                expected_duration_minutes: lo.expected_duration_minutes || 15,
                lo_text: lo.text,
              },
            });
          } catch (e) {
            console.error('Error finding content for LO:', lo.id, e);
          }
        }));
        
        setContentProgress({ current: Math.min(i + batchSize, learningObjectives.length), total: learningObjectives.length });
      }

      // Step 4: Trigger batch evaluation for all discovered videos
      setStep('evaluating_content');

      try {
        const { data: evalData, error: evalError } = await supabase.functions.invoke('submit-batch-evaluation', {
          body: { instructor_course_id: courseId },
        });

        if (evalError) {
          console.error('Error submitting batch evaluation:', evalError);
          // Continue anyway - videos will be pending evaluation
        } else if (evalData?.batch_job_id) {
          setEvaluationBatchJobId(evalData.batch_job_id);

          // Poll for evaluation completion
          const pollEvaluation = async () => {
            try {
              const { data: pollData } = await supabase.functions.invoke('poll-batch-evaluation', {
                body: { batch_job_id: evalData.batch_job_id },
              });

              if (pollData?.is_complete) {
                console.log('Batch evaluation complete:', pollData);
                return true;
              }
              return false;
            } catch (e) {
              console.error('Error polling evaluation:', e);
              return false;
            }
          };

          // Poll every 5 seconds for up to 2 minutes
          let attempts = 0;
          const maxAttempts = 24;
          while (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 5000));
            const complete = await pollEvaluation();
            if (complete) break;
            attempts++;
          }
        } else {
          console.log('No batch job created (possibly not enough videos)');
        }
      } catch (e) {
        console.error('Batch evaluation error:', e);
        // Continue anyway - not critical
      }

      setStep('complete');

      toast({
        title: 'Course Created Successfully!',
        description: `Created ${processResult.module_count} modules with ${processResult.lo_count} learning objectives.`,
      });
      
    } catch (error) {
      console.error('Error processing syllabus:', error);
      setStep('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred');
      
      toast({
        title: 'Processing Failed',
        description: error instanceof Error ? error.message : 'Failed to process syllabus',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setStep('upload');
    setFile(null);
    setCourseName('');
    setCourseCode('');
    setResult(null);
    setErrorMessage('');
    setCreatedCourseId(null);
    setContentProgress({ current: 0, total: 0 });
    setEvaluationBatchJobId(null);
  };

  const isProcessing = !['upload', 'complete', 'error'].includes(step);
  const stepInfo = STEP_INFO[step];

  return (
    <AppShell>
      <PageContainer>
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
              <Sparkles className="h-4 w-4" />
              AI-Powered Course Setup
            </div>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Upload your syllabus and let AI create your entire course structure with curated video content in one step.
            </p>
          </div>

          {/* Main Card */}
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {step === 'complete' ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : step === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <BookOpen className="h-5 w-5 text-primary" />
                )}
                {stepInfo.label}
              </CardTitle>
              <CardDescription>{stepInfo.description}</CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {/* Progress Bar */}
              {isProcessing && (
                <div className="space-y-2">
                  <Progress value={stepInfo.progress} className="h-2" />
                  {step === 'finding_content' && contentProgress.total > 0 && (
                    <p className="text-sm text-muted-foreground text-center">
                      Finding content: {contentProgress.current} / {contentProgress.total} objectives
                    </p>
                  )}
                </div>
              )}

              {/* Upload State */}
              {step === 'upload' && (
                <div className="space-y-6">
                  {/* Course Name Input */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="courseName">Course Name</Label>
                      <Input
                        id="courseName"
                        placeholder="e.g., Strategic Management"
                        value={courseName}
                        onChange={(e) => setCourseName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="courseCode">Course Code (Optional)</Label>
                      <Input
                        id="courseCode"
                        placeholder="e.g., MGT471"
                        value={courseCode}
                        onChange={(e) => setCourseCode(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Dropzone */}
                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                      ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50'}
                      ${file ? 'border-success bg-success/5' : ''}
                    `}
                  >
                    <input {...getInputProps()} />
                    {file ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-3 bg-success/10 rounded-full">
                          <FileText className="h-8 w-8 text-success" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                          Choose different file
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="p-3 bg-muted rounded-full">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">Drop your syllabus here</p>
                          <p className="text-sm text-muted-foreground">PDF or DOCX files supported</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* What happens next */}
                  <div className="bg-muted/50 rounded-lg p-4">
                    <p className="font-medium text-sm mb-3">What happens when you click "Create Course":</p>
                    <div className="grid gap-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">1</div>
                        <span>AI extracts text and identifies course structure</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">2</div>
                        <span>Modules and learning objectives are created automatically</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">3</div>
                        <span>AI finds and scores YouTube videos for each objective</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-medium">4</div>
                        <span>Review and approve content, then publish!</span>
                      </div>
                    </div>
                  </div>

                  {/* Create Button */}
                  <Button 
                    size="lg" 
                    className="w-full gap-2"
                    onClick={processEverything}
                    disabled={!file}
                  >
                    <Sparkles className="h-4 w-4" />
                    Create Course with AI
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Processing State */}
              {isProcessing && (
                <div className="flex flex-col items-center py-8 gap-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">{stepInfo.label}</p>
                    <p className="text-sm text-muted-foreground">{stepInfo.description}</p>
                  </div>
                </div>
              )}

              {/* Complete State */}
              {step === 'complete' && result && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center py-4 gap-4">
                    <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-semibold text-foreground">Course Created!</p>
                      <p className="text-muted-foreground">Your course is ready for review</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold text-primary">{result.module_count}</div>
                        <p className="text-xs text-muted-foreground">Modules</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold text-primary">{result.lo_count}</div>
                        <p className="text-xs text-muted-foreground">Objectives</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4 text-center">
                        <div className="text-2xl font-bold text-primary">
                          <Video className="h-6 w-6 mx-auto" />
                        </div>
                        <p className="text-xs text-muted-foreground">Videos Found</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Module Preview */}
                  {result.modules.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Course Structure:</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {result.modules.map((module, idx) => (
                          <div key={module.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm font-medium">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{module.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {result.learning_objectives.filter(lo => lo.module_id === module.id).length} objectives
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={resetForm}>
                      Create Another
                    </Button>
                    <Button 
                      className="flex-1 gap-2" 
                      onClick={() => navigate(`/instructor/courses/${createdCourseId}`)}
                    >
                      Review & Curate Content
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Error State */}
              {step === 'error' && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center py-4 gap-4">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                      <AlertCircle className="h-8 w-8 text-destructive" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-semibold text-foreground">Something went wrong</p>
                      <p className="text-sm text-destructive mt-2">{errorMessage}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={resetForm}>
                      Try Again
                    </Button>
                    {createdCourseId && (
                      <Button 
                        className="flex-1" 
                        onClick={() => navigate(`/instructor/courses/${createdCourseId}`)}
                      >
                        View Partial Course
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tips */}
          {step === 'upload' && (
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Processing takes 1-3 minutes</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      The AI reads your syllabus, identifies modules and learning objectives, 
                      then searches YouTube for relevant educational content for each objective.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </PageContainer>
    </AppShell>
  );
}
