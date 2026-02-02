import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  BookOpen, 
  Calendar, 
  User,
  Code,
  Wrench,
  Lightbulb,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Upload,
  Loader2,
  X,
  FileText
} from "lucide-react";
import { useCourse, useUpdateCourse } from "@/hooks/useCourses";
import { useCapabilities } from "@/hooks/useCapabilities";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: course, isLoading: courseLoading, error: courseError } = useCourse(id || "");
  const { data: allCapabilities, isLoading: capabilitiesLoading } = useCapabilities();
  const updateCourse = useUpdateCourse();

  // Re-analyze state
  const [showReanalyzeDialog, setShowReanalyzeDialog] = useState(false);
  const [reanalyzeFile, setReanalyzeFile] = useState<File | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const courseCapabilities = allCapabilities?.filter(c => c.course_id === id) || [];
  const isLoading = courseLoading || capabilitiesLoading;

  // Check if capability_text looks like raw syllabus vs capability summary
  // Raw syllabus: long text with few semicolons (prose)
  // Capability list: semicolon-separated, so many semicolons even if long
  const isRawSyllabus = course?.capability_text && 
    course.capability_text.length > 5000 &&
    (course.capability_text.match(/;/g) || []).length < 5;
  const analysisNeedsRetry = course?.analysis_status === 'pending' || 
                              course?.analysis_status === 'failed' ||
                              isRawSyllabus;

  // Handle re-analysis with new file
  const handleReanalyze = async () => {
    if (!reanalyzeFile || !course) return;

    setIsReanalyzing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Convert file to base64
      const arrayBuffer = await reanalyzeFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      // Delete existing capabilities for this course
      await supabase
        .from('capabilities')
        .delete()
        .eq('course_id', course.id);

      // Update course status to analyzing
      await supabase
        .from('courses')
        .update({ 
          analysis_status: 'analyzing', 
          analysis_error: null,
          capability_text: null // Clear raw text
        })
        .eq('id', course.id);

      // Call parse-syllabus-document
      const { data, error } = await supabase.functions.invoke("parse-syllabus-document", {
        body: {
          document_base64: base64,
          file_name: reanalyzeFile.name,
          course_id: course.id,
        },
      });

      if (error) throw error;

      // Check if analysis completed successfully
      const capabilities = data.analysis?.capabilities || [];
      const hasCapabilities = capabilities.length > 0;

      if (hasCapabilities) {
        // Create capability summary
        const capabilitySummary = capabilities.map((c: any) => 
          typeof c === 'string' ? c : c.name
        ).join('; ');

        // Update course with results
        await updateCourse.mutateAsync({
          id: course.id,
          updates: {
            analysis_status: 'completed',
            capability_text: capabilitySummary,
            ai_model_used: data.analysis?.model_used || 'gemini-2.0-flash',
          }
        });

        // Insert capabilities if not already done by edge function
        const { count } = await supabase
          .from('capabilities')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', course.id);

        if (!count || count === 0) {
          const capabilitiesToInsert = capabilities.map((cap: any) => ({
            user_id: user.id,
            course_id: course.id,
            name: typeof cap === 'string' ? cap : cap.name,
            category: typeof cap === 'object' && cap.category ? cap.category : 'technical',
            proficiency_level: typeof cap === 'object' && cap.proficiency_level ? cap.proficiency_level : 'intermediate',
            source: 'course',
          }));
          await supabase.from('capabilities').insert(capabilitiesToInsert);
        }

        toast({
          title: "Re-analysis complete!",
          description: `${capabilities.length} skills extracted from your syllabus.`,
        });
      } else {
        // Analysis failed - update status
        await updateCourse.mutateAsync({
          id: course.id,
          updates: {
            analysis_status: 'failed',
            analysis_error: data.analysis_error || 'No capabilities extracted',
          }
        });

        toast({
          title: "Analysis incomplete",
          description: data.analysis_error || "Could not extract capabilities. Try a different file.",
          variant: "destructive",
        });
      }

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["capabilities"] });
      queryClient.invalidateQueries({ queryKey: ["course", course.id] });

      setShowReanalyzeDialog(false);
      setReanalyzeFile(null);
    } catch (error) {
      console.error('Re-analysis error:', error);
      toast({
        title: "Re-analysis failed",
        description: error instanceof Error ? error.message : "Failed to re-analyze syllabus.",
        variant: "destructive",
      });
    } finally {
      setIsReanalyzing(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => setReanalyzeFile(files[0]),
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-5 w-48" />
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (courseError || !course) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-12">
          <BookOpen className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Course Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The course you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => navigate("/learn?tab=transcript")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to My Transcript
          </Button>
        </div>
      </AppShell>
    );
  }

  const toolsMethods = Array.isArray(course.tools_methods) 
    ? course.tools_methods as string[]
    : [];
  
  const capabilityKeywords = Array.isArray(course.capability_keywords) 
    ? course.capability_keywords as string[]
    : [];

  // Only show capability_text if analysis is complete AND text is not raw syllabus
  const shouldShowCapabilityText = course.capability_text && 
    course.analysis_status === 'completed' && 
    !isRawSyllabus;

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/learn?tab=transcript")} aria-label="Back to transcript">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold font-display">{course.title}</h1>
              {course.analysis_status === 'completed' && !isRawSyllabus && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Analyzed
                </Badge>
              )}
              {analysisNeedsRetry && (
                <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  Needs Analysis
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-muted-foreground">
              {course.code && (
                <span className="flex items-center gap-1">
                  <Code className="h-4 w-4" />
                  {course.code}
                </span>
              )}
              {course.semester && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {course.semester} {course.year}
                </span>
              )}
              {course.instructor && (
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {course.instructor}
                </span>
              )}
              <span className="flex items-center gap-1">
                <BookOpen className="h-4 w-4" />
                {course.credits || 3} credits
              </span>
            </div>
          </div>
          
          {/* Re-analyze button */}
          {analysisNeedsRetry && (
            <Button onClick={() => setShowReanalyzeDialog(true)} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-analyze
            </Button>
          )}
        </div>

        {/* Analysis needed banner */}
        {analysisNeedsRetry && (
          <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-amber-800 dark:text-amber-200">
                    {isRawSyllabus ? 'Capability Analysis Incomplete' : 'Analysis Pending'}
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    {isRawSyllabus 
                      ? 'The syllabus was uploaded but capability extraction failed. Re-upload to extract your skills.'
                      : 'This course hasn\'t been analyzed yet. Upload your syllabus to extract skills.'}
                  </p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => setShowReanalyzeDialog(true)}
                  className="shrink-0"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload Syllabus
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Capability Summary - only show if properly analyzed */}
          {shouldShowCapabilityText && (
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-accent" />
                  What You'll Learn
                </CardTitle>
                <CardDescription>
                  AI-extracted capabilities from your syllabus
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {course.capability_text.split(';').map((capability, index) => {
                    const trimmed = capability.trim();
                    if (!trimmed) return null;
                    return (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-accent mt-1">•</span>
                        <span>{trimmed}</span>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Skills Extracted */}
          {courseCapabilities.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Skills Extracted
                </CardTitle>
                <CardDescription>
                  {courseCapabilities.length} skills identified from this course
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {courseCapabilities.map((cap) => (
                    <Badge key={cap.id} variant="outline">
                      {cap.name}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tools & Methods */}
          {toolsMethods.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-green-500" />
                  Tools & Technologies
                </CardTitle>
                <CardDescription>
                  Technical tools covered in this course
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {toolsMethods.map((tool, index) => (
                    <Badge key={index} variant="secondary">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Keywords */}
          {capabilityKeywords.length > 0 && (
            <Card className={toolsMethods.length === 0 ? "md:col-span-2" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-blue-500" />
                  Capability Keywords
                </CardTitle>
                <CardDescription>
                  Keywords used for job matching
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {capabilityKeywords.map((keyword, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Analysis Info - only show if properly analyzed */}
          {course.ai_model_used && !isRawSyllabus && (
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  AI Analysis Details
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p><strong>Model:</strong> {course.ai_model_used}</p>
                {course.ai_cost_usd && (
                  <p><strong>Cost:</strong> ${course.ai_cost_usd.toFixed(4)}</p>
                )}
                <p><strong>Analyzed:</strong> {new Date(course.updated_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          )}

          {/* Empty state when no analysis data */}
          {!shouldShowCapabilityText && courseCapabilities.length === 0 && toolsMethods.length === 0 && !analysisNeedsRetry && (
            <Card className="md:col-span-2 p-8 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-medium mb-2">No analysis data yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload your syllabus to extract skills and capabilities
              </p>
              <Button onClick={() => setShowReanalyzeDialog(true)}>
                <Upload className="h-4 w-4 mr-2" />
                Upload Syllabus
              </Button>
            </Card>
          )}
        </div>
      </div>

      {/* Re-analyze Dialog */}
      <Dialog open={showReanalyzeDialog} onOpenChange={setShowReanalyzeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-analyze Syllabus</DialogTitle>
            <DialogDescription>
              Upload a new syllabus file to extract skills and capabilities for this course.
            </DialogDescription>
          </DialogHeader>

          {reanalyzeFile ? (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      {isReanalyzing ? (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      ) : (
                        <FileText className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{reanalyzeFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(reanalyzeFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setReanalyzeFile(null)}
                    disabled={isReanalyzing}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                isDragActive 
                  ? "border-primary bg-primary/5" 
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">
                {isDragActive ? "Drop your syllabus here" : "Drag & drop your syllabus"}
              </p>
              <p className="text-xs text-muted-foreground">
                PDF, DOCX, or TXT (max 10MB)
              </p>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowReanalyzeDialog(false);
                setReanalyzeFile(null);
              }}
              disabled={isReanalyzing}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleReanalyze}
              disabled={!reanalyzeFile || isReanalyzing}
            >
              {isReanalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
