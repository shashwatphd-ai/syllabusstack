import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { AddCourseForm, AddCourseSubmitData } from "@/components/forms/AddCourseForm";
import { BulkSyllabusUploader } from "@/components/onboarding/BulkSyllabusUploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  BookOpen,
  Calendar,
  Clock,
  MoreVertical,
  Trash2,
  Eye,
  Plus,
  Upload,
  FileText,
  Search,
  RefreshCw,
  Pencil,
  AlertCircle,
  Loader2,
  ArrowUpDown,
  Filter,
  Sparkles,
  CheckCircle2,
  Square,
  CheckSquare,
  GraduationCap,
  PlayCircle,
  CalendarClock,
  X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useCourses, useCreateCourse, useDeleteCourse, useUpdateCourse, Course } from "@/hooks/useCourses";
import { useBulkSelection } from "@/hooks/useBulkSelection";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useQueryClient } from "@tanstack/react-query";
import { analyzeSyllabus } from "@/services";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type SortOption = "newest" | "oldest" | "name" | "skills" | "status" | "course_status";
type FilterOption = "all" | "analyzed" | "pending" | "failed";
type CourseStatusOption = "all" | "completed" | "in_progress" | "planned";

// Course completion status - stored in grade field as JSON or special value
type CourseStatus = "completed" | "in_progress" | "planned";

// Helper to get course completion status from the course data
// Uses the 'grade' field to store status: "completed", "in_progress", "planned", or actual grade
const getCourseCompletionStatus = (course: Course): CourseStatus => {
  const grade = course.grade;
  if (grade === "in_progress") return "in_progress";
  if (grade === "planned") return "planned";
  // If grade is set (A, B, C, etc.) or "completed", course is completed
  if (grade && grade !== "in_progress" && grade !== "planned") return "completed";
  // Default to in_progress for courses without explicit status
  return "in_progress";
};

// Helper to get display grade (not the status)
const getDisplayGrade = (course: Course): string | null => {
  const grade = course.grade;
  if (!grade || grade === "in_progress" || grade === "planned" || grade === "completed") {
    return null;
  }
  return grade;
};

export default function CoursesPage() {
  const [showUploader, setShowUploader] = useState(false);
  const [uploadMode, setUploadMode] = useState<"bulk" | "single">("bulk");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [courseStatusFilter, setCourseStatusFilter] = useState<CourseStatusOption>("all");

  // Selection state for bulk operations using shared hook
  const {
    selectedItems: selectedCourses,
    isSelectionMode,
    selectedCount,
    toggleSelection: toggleCourseSelection,
    selectAll: selectAllVisible,
    clearSelection,
    enterSelectionMode,
    isAllSelected,
    selectedArray,
  } = useBulkSelection<string>();
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Edit dialog state
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    code: "",
    semester: "",
    credits: 3,
    courseStatus: "in_progress" as CourseStatus,
    grade: "",
    expectedTerm: ""
  });
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Delete confirmation state
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);

  // Re-analyze state
  const [reanalyzeCourse, setReanalyzeCourse] = useState<Course | null>(null);
  const [reanalyzeFile, setReanalyzeFile] = useState<File | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Status change dialog
  const [statusChangeCourse, setStatusChangeCourse] = useState<Course | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: courses, isLoading: coursesLoading } = useCourses();
  const { data: capabilities } = useCapabilities();
  const createCourse = useCreateCourse();
  const deleteCourse = useDeleteCourse();
  const updateCourse = useUpdateCourse();

  // Get course status
  const getCourseStatus = (course: Course) => {
    if (course.analysis_status === 'completed') return 'analyzed';
    if (course.analysis_status === 'analyzing') return 'analyzing';
    if (course.analysis_status === 'failed') return 'failed';
    if (course.capability_text) return 'analyzed';
    return 'pending';
  };

  // Pre-compute skill counts ONCE using Map for O(1) lookups instead of O(n) filter per call
  const skillCountMap = useMemo(() => {
    const map = new Map<string, number>();
    capabilities?.forEach(c => {
      map.set(c.course_id, (map.get(c.course_id) || 0) + 1);
    });
    return map;
  }, [capabilities]);

  // Get skill count for a course - now O(1) instead of O(n)
  const getCourseSkillCount = useCallback((courseId: string) => {
    return skillCountMap.get(courseId) || 0;
  }, [skillCountMap]);

  // Filter and sort courses
  const filteredAndSortedCourses = useMemo(() => {
    if (!courses) return [];

    let result = [...courses];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(query) ||
        (c.code && c.code.toLowerCase().includes(query)) ||
        (c.semester && c.semester.toLowerCase().includes(query))
      );
    }

    // Apply analysis status filter
    if (filterBy !== "all") {
      result = result.filter(c => {
        const status = getCourseStatus(c);
        return status === filterBy;
      });
    }

    // Apply course completion status filter
    if (courseStatusFilter !== "all") {
      result = result.filter(c => {
        const status = getCourseCompletionStatus(c);
        return status === courseStatusFilter;
      });
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name":
          return a.title.localeCompare(b.title);
        case "skills":
          return getCourseSkillCount(b.id) - getCourseSkillCount(a.id);
        case "status":
          const statusOrder = { analyzed: 0, analyzing: 1, pending: 2, failed: 3 };
          return statusOrder[getCourseStatus(a)] - statusOrder[getCourseStatus(b)];
        case "course_status":
          const courseStatusOrder = { completed: 0, in_progress: 1, planned: 2 };
          return courseStatusOrder[getCourseCompletionStatus(a)] - courseStatusOrder[getCourseCompletionStatus(b)];
        default:
          return 0;
      }
    });

    return result;
  }, [courses, searchQuery, filterBy, courseStatusFilter, sortBy, skillCountMap]);

  // Computed: are all visible courses selected?
  const allVisibleSelected = isAllSelected(filteredAndSortedCourses.map(c => c.id));

  // Stats
  const analyzedCount = courses?.filter(c =>
    c.analysis_status === 'completed' ||
    (c.analysis_status === null && c.capability_text)
  ).length || 0;
  const failedCount = courses?.filter(c => c.analysis_status === 'failed').length || 0;
  const totalSkills = capabilities?.length || 0;

  // Course status counts
  const completedCount = courses?.filter(c => getCourseCompletionStatus(c) === 'completed').length || 0;
  const inProgressCount = courses?.filter(c => getCourseCompletionStatus(c) === 'in_progress').length || 0;
  const plannedCount = courses?.filter(c => getCourseCompletionStatus(c) === 'planned').length || 0;

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (selectedCount === 0) return;

    setIsBulkDeleting(true);
    try {
      // Delete capabilities first
      for (const courseId of selectedCourses) {
        await supabase.from('capabilities').delete().eq('course_id', courseId);
      }

      // Delete courses
      const { error } = await supabase
        .from('courses')
        .delete()
        .in('id', Array.from(selectedCourses));

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["capabilities"] });

      toast({
        title: "Courses deleted",
        description: `${selectedCount} course(s) have been removed.`,
      });

      clearSelection();
      setShowBulkDeleteConfirm(false);
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete some courses. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Update course status (completion status)
  const handleUpdateCourseStatus = async (course: Course, newStatus: CourseStatus, grade?: string) => {
    try {
      // Use grade field to store status or actual grade
      let gradeValue: string | null = null;
      if (newStatus === 'completed') {
        gradeValue = grade || 'completed';
      } else {
        gradeValue = newStatus; // 'in_progress' or 'planned'
      }

      await supabase
        .from('courses')
        .update({ grade: gradeValue })
        .eq('id', course.id);

      queryClient.invalidateQueries({ queryKey: ["courses"] });

      toast({
        title: "Status updated",
        description: `Course marked as ${newStatus.replace('_', ' ')}.`,
      });

      setStatusChangeCourse(null);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update course status.",
        variant: "destructive",
      });
    }
  };

  // Quick status change for a course
  const handleQuickStatusChange = async (course: Course, newStatus: CourseStatus) => {
    if (newStatus === 'completed') {
      // Open dialog to optionally enter grade
      setStatusChangeCourse(course);
      setEditForm(prev => ({
        ...prev,
        courseStatus: newStatus,
        grade: ''
      }));
    } else {
      await handleUpdateCourseStatus(course, newStatus);
    }
  };

  const handleBulkUploadSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["capabilities"] });
    setShowUploader(false);
    toast({
      title: "Courses added!",
      description: "Your capability profile has been updated.",
    });
  };

  const handleAddCourse = async (data: AddCourseSubmitData) => {
    setIsAnalyzing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // If we have analysis result from file processing, use it directly
      if (data.analysisResult && data.analysisResult.capabilities.length > 0) {
        const { capabilities, extractedText } = data.analysisResult;
        const capabilityText = capabilities.map(c => c.name).join("; ");

        // Cast capabilities to Json-compatible format for Supabase
        const keyCapabilities = capabilities.map(cap => ({
          name: cap.name,
          category: cap.category,
          proficiency_level: cap.proficiency_level,
        }));

        // Create course with analysis data already populated
        const course = await createCourse.mutateAsync({
          title: data.name,
          code: data.code || null,
          semester: data.semester || null,
          capability_text: capabilityText,
          key_capabilities: keyCapabilities as unknown as import('@/integrations/supabase/types').Json,
          analysis_status: "completed",
        });

        // Insert capabilities into the capabilities table
        if (capabilities.length > 0) {
          const capabilitiesToInsert = capabilities.map(cap => ({
            user_id: user.id,
            course_id: course.id,
            name: cap.name,
            category: cap.category,
            proficiency_level: cap.proficiency_level,
            source: 'course',
          }));

          const { error: capError } = await supabase.from('capabilities').insert(capabilitiesToInsert);
          if (capError) {
            console.error('Failed to save capabilities:', capError);
          }
        }

        // Invalidate capabilities query to refresh the skill counts
        queryClient.invalidateQueries({ queryKey: ["capabilities"] });

        toast({
          title: "Course added!",
          description: `${capabilities.length} skills extracted from your syllabus.`,
        });
      } else if (data.syllabusText) {
        // Fallback: Create course first, then analyze (for pasted text without pre-analysis)
        const course = await createCourse.mutateAsync({
          title: data.name,
          code: data.code || null,
          semester: data.semester || null,
          analysis_status: "pending",
        });

        // Analyze the pasted syllabus text
        await analyzeSyllabus(data.syllabusText, course.id);

        // Refresh data after analysis
        queryClient.invalidateQueries({ queryKey: ["courses"] });
        queryClient.invalidateQueries({ queryKey: ["capabilities"] });

        toast({
          title: "Course analyzed!",
          description: "Skills have been extracted from your syllabus.",
        });
      } else {
        // No syllabus content - just create the course
        await createCourse.mutateAsync({
          title: data.name,
          code: data.code || null,
          semester: data.semester || null,
          analysis_status: "pending",
        });

        toast({
          title: "Course added",
          description: "Upload a syllabus later to extract skills.",
        });
      }

      setShowUploader(false);
    } catch (error) {
      console.error('Error adding course:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add course",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteCourse = () => {
    if (deletingCourse) {
      deleteCourse.mutate(deletingCourse.id);
      setDeletingCourse(null);
    }
  };

  const handleEditCourse = (course: Course) => {
    setEditingCourse(course);
    const displayGrade = getDisplayGrade(course);
    setEditForm({
      title: course.title,
      code: course.code || "",
      semester: course.semester || "",
      credits: course.credits || 3,
      courseStatus: getCourseCompletionStatus(course),
      grade: displayGrade || "",
      expectedTerm: course.semester || ""
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCourse) return;

    setIsEditSaving(true);
    try {
      // Determine grade value based on status
      let gradeValue: string | null = null;
      if (editForm.courseStatus === 'completed') {
        gradeValue = editForm.grade || 'completed';
      } else {
        gradeValue = editForm.courseStatus; // 'in_progress' or 'planned'
      }

      // For planned courses, use expectedTerm as semester
      const semesterValue = editForm.courseStatus === 'planned'
        ? editForm.expectedTerm || editForm.semester
        : editForm.semester;

      await updateCourse.mutateAsync({
        id: editingCourse.id,
        updates: {
          title: editForm.title,
          code: editForm.code || null,
          semester: semesterValue || null,
          credits: editForm.credits,
          grade: gradeValue,
        },
      });
      setEditingCourse(null);
    } catch (error) {
      // Error toast is handled by the mutation
    } finally {
      setIsEditSaving(false);
    }
  };

  // Open the re-analyze dialog
  const handleReanalyzeClick = (course: Course) => {
    setReanalyzeCourse(course);
    setReanalyzeFile(null);
  };

  // Process the re-analysis with new file
  const handleReanalyzeSubmit = async () => {
    if (!reanalyzeCourse || !reanalyzeFile) return;

    setIsReanalyzing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Convert file to base64 using chunked approach (O(n) instead of O(n²))
      const arrayBuffer = await reanalyzeFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const chunkSize = 0x8000; // 32KB chunks
      const chunks: string[] = [];
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
        chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
      }
      const base64 = btoa(chunks.join(''));

      // First, delete existing capabilities for this course
      await supabase
        .from('capabilities')
        .delete()
        .eq('course_id', reanalyzeCourse.id);

      // Update course status to analyzing
      await supabase
        .from('courses')
        .update({ analysis_status: 'analyzing', analysis_error: null })
        .eq('id', reanalyzeCourse.id);

      // Call parse-syllabus-document with the course_id to trigger analysis
      const { data, error } = await supabase.functions.invoke("parse-syllabus-document", {
        body: {
          document_base64: base64,
          file_name: reanalyzeFile.name,
          course_id: reanalyzeCourse.id,
        },
      });

      if (error) throw error;

      // If analysis returned capabilities, also insert them manually
      // (The edge function should have done this, but let's be safe)
      const capabilities = data.analysis?.capabilities || [];
      if (capabilities.length > 0) {
        const capabilitiesToInsert = capabilities.map((cap: any) => ({
          user_id: user.id,
          course_id: reanalyzeCourse.id,
          name: typeof cap === 'string' ? cap : cap.name,
          category: typeof cap === 'object' && cap.category ? cap.category : 'technical',
          proficiency_level: typeof cap === 'object' && cap.proficiency_level ? cap.proficiency_level : 'intermediate',
          source: 'course',
        }));

        // Check if capabilities were already inserted by the edge function
        const { count } = await supabase
          .from('capabilities')
          .select('*', { count: 'exact', head: true })
          .eq('course_id', reanalyzeCourse.id);

        if (!count || count === 0) {
          await supabase.from('capabilities').insert(capabilitiesToInsert);
        }
      }

      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["capabilities"] });

      toast({
        title: "Re-analysis complete!",
        description: `${capabilities.length} skills extracted from your updated syllabus.`,
      });

      setReanalyzeCourse(null);
      setReanalyzeFile(null);
    } catch (error) {
      console.error('Re-analysis error:', error);

      // Update course status to failed
      if (reanalyzeCourse) {
        await supabase
          .from('courses')
          .update({
            analysis_status: 'failed',
            analysis_error: error instanceof Error ? error.message : 'Re-analysis failed',
          })
          .eq('id', reanalyzeCourse.id);
      }

      queryClient.invalidateQueries({ queryKey: ["courses"] });

      toast({
        title: "Re-analysis failed",
        description: error instanceof Error ? error.message : "Failed to re-analyze syllabus",
        variant: "destructive",
      });
    } finally {
      setIsReanalyzing(false);
    }
  };

  if (coursesLoading) {
    return (
      <AppShell>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-9 w-48 mb-2" />
              <Skeleton className="h-5 w-64" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            Manage your courses and syllabi
          </p>
          <Button onClick={() => setShowUploader(!showUploader)}>
            {showUploader ? "View Courses" : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Course
              </>
            )}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <BookOpen className="h-8 w-8 text-accent" />
                <div>
                  <p className="text-2xl font-bold">{courses?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Courses</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Clock className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{analyzedCount}</p>
                  <p className="text-sm text-muted-foreground">Analyzed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Sparkles className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalSkills}</p>
                  <p className="text-sm text-muted-foreground">Skills Extracted</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {showUploader ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add Courses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={uploadMode} onValueChange={(v) => setUploadMode(v as "bulk" | "single")}>
                <TabsList className="mb-4">
                  <TabsTrigger value="bulk" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Bulk Upload
                  </TabsTrigger>
                  <TabsTrigger value="single" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Single Course
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="bulk">
                  <BulkSyllabusUploader
                    onSuccess={handleBulkUploadSuccess}
                    onCancel={() => setShowUploader(false)}
                  />
                </TabsContent>
                <TabsContent value="single">
                  <AddCourseForm
                    onSubmit={handleAddCourse}
                    onCancel={() => setShowUploader(false)}
                    isSubmitting={isAnalyzing}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        ) : courses && courses.length > 0 ? (
          <>
            {/* Selection Toolbar */}
            {isSelectionMode && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={(checked) => {
                          if (checked) selectAllVisible(filteredAndSortedCourses.map(c => c.id));
                          else clearSelection();
                        }}
                      />
                      <span className="text-sm font-medium">
                        {selectedCount} of {filteredAndSortedCourses.length} selected
                      </span>
                      {selectedCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearSelection}
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedCount > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setShowBulkDeleteConfirm(true)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete ({selectedCount})
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Exit Selection
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Course Status Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={courseStatusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setCourseStatusFilter("all")}
              >
                All ({courses.length})
              </Button>
              <Button
                variant={courseStatusFilter === "completed" ? "default" : "outline"}
                size="sm"
                onClick={() => setCourseStatusFilter("completed")}
                className="gap-2"
              >
                <GraduationCap className="h-4 w-4" />
                Completed ({completedCount})
              </Button>
              <Button
                variant={courseStatusFilter === "in_progress" ? "default" : "outline"}
                size="sm"
                onClick={() => setCourseStatusFilter("in_progress")}
                className="gap-2"
              >
                <PlayCircle className="h-4 w-4" />
                In Progress ({inProgressCount})
              </Button>
              <Button
                variant={courseStatusFilter === "planned" ? "default" : "outline"}
                size="sm"
                onClick={() => setCourseStatusFilter("planned")}
                className="gap-2"
              >
                <CalendarClock className="h-4 w-4" />
                Planned ({plannedCount})
              </Button>
            </div>

            {/* Search, Filter, Sort Controls */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search courses by name, code, or semester..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                {!isSelectionMode && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={enterSelectionMode}
                    title="Select multiple courses"
                  >
                    <CheckSquare className="h-4 w-4" />
                  </Button>
                )}
                <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterOption)}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Analysis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Analysis</SelectItem>
                    <SelectItem value="analyzed">Analyzed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                  <SelectTrigger className="w-[140px]">
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="name">By Name</SelectItem>
                    <SelectItem value="skills">By Skills</SelectItem>
                    <SelectItem value="status">By Analysis</SelectItem>
                    <SelectItem value="course_status">By Progress</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Results count */}
            {(searchQuery || filterBy !== "all") && (
              <p className="text-sm text-muted-foreground">
                Showing {filteredAndSortedCourses.length} of {courses.length} courses
              </p>
            )}

            {/* Failed courses alert */}
            {failedCount > 0 && filterBy === "all" && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <div className="flex-1">
                      <p className="font-medium text-destructive">
                        {failedCount} course{failedCount > 1 ? 's' : ''} failed analysis
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Click on a failed course to retry or upload a new syllabus.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setFilterBy("failed")}
                    >
                      View Failed
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Course Grid */}
            {filteredAndSortedCourses.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredAndSortedCourses.map((course) => {
                  const status = getCourseStatus(course);
                  const completionStatus = getCourseCompletionStatus(course);
                  const skillCount = getCourseSkillCount(course.id);
                  const displayGrade = getDisplayGrade(course);
                  const isSelected = selectedCourses.has(course.id);

                  return (
                    <Card
                      key={course.id}
                      className={`cursor-pointer hover:shadow-md transition-shadow ${
                        status === "failed" ? "border-destructive/50" : ""
                      } ${isSelected ? "ring-2 ring-primary" : ""}`}
                      onClick={() => {
                        if (isSelectionMode) {
                          toggleCourseSelection(course.id);
                        } else {
                          navigate(`/courses/${course.id}`);
                        }
                      }}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          {/* Selection checkbox */}
                          {isSelectionMode && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleCourseSelection(course.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base truncate">{course.title}</CardTitle>
                              {/* Course completion status badge */}
                              {completionStatus === "completed" && (
                                <Badge variant="outline" className="text-green-600 border-green-600 text-xs">
                                  <GraduationCap className="h-3 w-3 mr-1" />
                                  {displayGrade || "Done"}
                                </Badge>
                              )}
                              {completionStatus === "in_progress" && (
                                <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs">
                                  <PlayCircle className="h-3 w-3 mr-1" />
                                  Current
                                </Badge>
                              )}
                              {completionStatus === "planned" && (
                                <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs">
                                  <CalendarClock className="h-3 w-3 mr-1" />
                                  Planned
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {course.code && `${course.code} • `}{course.semester || 'No semester'}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/courses/${course.id}`);
                              }}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleEditCourse(course);
                              }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Course
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {/* Quick status change */}
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickStatusChange(course, "completed");
                                }}
                                disabled={completionStatus === "completed"}
                              >
                                <GraduationCap className="h-4 w-4 mr-2" />
                                Mark Completed
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickStatusChange(course, "in_progress");
                                }}
                                disabled={completionStatus === "in_progress"}
                              >
                                <PlayCircle className="h-4 w-4 mr-2" />
                                Mark In Progress
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuickStatusChange(course, "planned");
                                }}
                                disabled={completionStatus === "planned"}
                              >
                                <CalendarClock className="h-4 w-4 mr-2" />
                                Mark Planned
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {(status === "failed" || status === "pending") && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReanalyzeClick(course);
                                  }}
                                  disabled={isReanalyzing && reanalyzeCourse?.id === course.id}
                                >
                                  {isReanalyzing && reanalyzeCourse?.id === course.id ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                  )}
                                  {status === "failed" ? "Retry Analysis" : "Analyze Now"}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingCourse(course);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Course
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                status === "analyzed" ? "default" :
                                status === "failed" ? "destructive" :
                                status === "analyzing" ? "outline" :
                                "secondary"
                              }
                            >
                              {status === "analyzing" && (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              )}
                              {status}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {course.credits || 3} credits
                            </span>
                          </div>
                          {status === "failed" && course.analysis_error ? (
                            <span
                              className="text-xs text-destructive truncate max-w-[150px]"
                              title={course.analysis_error}
                            >
                              {course.analysis_error}
                            </span>
                          ) : skillCount > 0 ? (
                            <span className="text-sm text-accent font-medium">
                              {skillCount} skills
                            </span>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No courses found</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Try adjusting your search or filter criteria.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterBy("all");
                      setCourseStatusFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
              <p className="text-muted-foreground text-center mb-4 max-w-md">
                Add your courses and syllabi to extract skills and capabilities.
                This helps you understand your strengths and identify gaps for your dream job.
              </p>
              <Button onClick={() => setShowUploader(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Course
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Edit Course Dialog */}
      <Dialog open={!!editingCourse} onOpenChange={(open) => !open && setEditingCourse(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update the course details and status below.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-title">Course Title *</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Introduction to Marketing"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-code">Course Code</Label>
                <Input
                  id="edit-code"
                  value={editForm.code}
                  onChange={(e) => setEditForm(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="MKT 101"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-credits">Credits</Label>
                <Input
                  id="edit-credits"
                  type="number"
                  min={1}
                  max={6}
                  value={editForm.credits}
                  onChange={(e) => setEditForm(prev => ({ ...prev, credits: parseInt(e.target.value) || 3 }))}
                />
              </div>
            </div>

            {/* Course Status Section */}
            <div className="grid gap-2">
              <Label>Course Status</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={editForm.courseStatus === "completed" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditForm(prev => ({ ...prev, courseStatus: "completed" }))}
                >
                  <GraduationCap className="h-4 w-4 mr-1" />
                  Completed
                </Button>
                <Button
                  type="button"
                  variant={editForm.courseStatus === "in_progress" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditForm(prev => ({ ...prev, courseStatus: "in_progress" }))}
                >
                  <PlayCircle className="h-4 w-4 mr-1" />
                  In Progress
                </Button>
                <Button
                  type="button"
                  variant={editForm.courseStatus === "planned" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setEditForm(prev => ({ ...prev, courseStatus: "planned" }))}
                >
                  <CalendarClock className="h-4 w-4 mr-1" />
                  Planned
                </Button>
              </div>
            </div>

            {/* Conditional fields based on status */}
            {editForm.courseStatus === "completed" && (
              <div className="grid gap-2">
                <Label htmlFor="edit-grade">Grade (optional)</Label>
                <Select
                  value={editForm.grade || "completed"}
                  onValueChange={(v) => setEditForm(prev => ({ ...prev, grade: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select grade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">No grade / Pass</SelectItem>
                    <SelectItem value="A+">A+</SelectItem>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="A-">A-</SelectItem>
                    <SelectItem value="B+">B+</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="B-">B-</SelectItem>
                    <SelectItem value="C+">C+</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="C-">C-</SelectItem>
                    <SelectItem value="D">D</SelectItem>
                    <SelectItem value="P">Pass</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {editForm.courseStatus === "in_progress" && (
              <div className="grid gap-2">
                <Label htmlFor="edit-semester">Current Semester</Label>
                <Input
                  id="edit-semester"
                  value={editForm.semester}
                  onChange={(e) => setEditForm(prev => ({ ...prev, semester: e.target.value }))}
                  placeholder="Fall 2024"
                />
              </div>
            )}

            {editForm.courseStatus === "planned" && (
              <div className="grid gap-2">
                <Label htmlFor="edit-expected-term">Expected Term</Label>
                <Input
                  id="edit-expected-term"
                  value={editForm.expectedTerm}
                  onChange={(e) => setEditForm(prev => ({ ...prev, expectedTerm: e.target.value }))}
                  placeholder="Spring 2025"
                />
                <p className="text-xs text-muted-foreground">When do you plan to take this course?</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCourse(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={!editForm.title.trim() || isEditSaving}
            >
              {isEditSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingCourse} onOpenChange={(open) => !open && setDeletingCourse(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingCourse?.title}"? This will also remove
              all associated skills and capabilities. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteCourse}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Re-analyze Dialog */}
      <Dialog open={!!reanalyzeCourse} onOpenChange={(open) => !open && setReanalyzeCourse(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-analyze Syllabus</DialogTitle>
            <DialogDescription>
              Upload a new syllabus file to re-analyze "{reanalyzeCourse?.title}" and extract updated skills.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                reanalyzeFile ? "border-green-500 bg-green-50" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.pdf,.docx,.txt';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) setReanalyzeFile(file);
                };
                input.click();
              }}
            >
              {reanalyzeFile ? (
                <div className="flex items-center justify-center gap-3">
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                  <div className="text-left">
                    <p className="font-medium">{reanalyzeFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(reanalyzeFile.size / 1024).toFixed(1)} KB - Click to change
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to select a syllabus file</p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX, or TXT</p>
                </>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReanalyzeCourse(null);
                setReanalyzeFile(null);
              }}
              disabled={isReanalyzing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReanalyzeSubmit}
              disabled={!reanalyzeFile || isReanalyzing}
            >
              {isReanalyzing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-analyze
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedCount} Course{selectedCount > 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the selected course{selectedCount > 1 ? 's' : ''}?
              This will also remove all associated skills and capabilities. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedCount} Course${selectedCount > 1 ? 's' : ''}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Mark Complete Dialog (for entering grade) */}
      <Dialog open={!!statusChangeCourse} onOpenChange={(open) => !open && setStatusChangeCourse(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Course as Completed</DialogTitle>
            <DialogDescription>
              Optionally enter your grade for "{statusChangeCourse?.title}".
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid gap-2">
              <Label htmlFor="status-grade">Grade (optional)</Label>
              <Select
                value={editForm.grade || "completed"}
                onValueChange={(v) => setEditForm(prev => ({ ...prev, grade: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select grade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">No grade / Pass</SelectItem>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A">A</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B">B</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="C+">C+</SelectItem>
                  <SelectItem value="C">C</SelectItem>
                  <SelectItem value="C-">C-</SelectItem>
                  <SelectItem value="D">D</SelectItem>
                  <SelectItem value="P">Pass</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusChangeCourse(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (statusChangeCourse) {
                  handleUpdateCourseStatus(statusChangeCourse, "completed", editForm.grade || "completed");
                }
              }}
            >
              <GraduationCap className="h-4 w-4 mr-2" />
              Mark Completed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
