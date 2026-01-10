import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  PlayCircle,
  BookOpen,
  Award,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  GraduationCap,
  FileText,
  Shield,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  RefreshCw,
  CalendarClock,
  Sparkles,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Filter,
  Upload,
  Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStudentEnrollments } from "@/hooks/useStudentCourses";
import { useCourses, useDeleteCourse, useUpdateCourse, Course } from "@/hooks/useCourses";
import { useCapabilities } from "@/hooks/useCapabilities";
import { analyzeSyllabus } from "@/services";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EnrollmentDialog } from "@/components/student/EnrollmentDialog";
import { AddCourseForm } from "@/components/forms";
import { toast } from "@/hooks/use-toast";

interface SkillProfile {
  skill_name: string;
  proficiency_level: string;
  source_type: string;
  source_name: string;
  verified: boolean;
  acquired_at: string;
  evidence_url: string | null;
}

type SortOption = "newest" | "oldest" | "name" | "skills";
type FilterOption = "all" | "analyzed" | "pending";

// Course completion status - stored in grade field
type CourseStatus = "completed" | "in_progress" | "planned";

// Helper to get course completion status from the course data
const getCourseCompletionStatus = (course: any): CourseStatus => {
  const grade = course.grade;
  if (grade === "in_progress") return "in_progress";
  if (grade === "planned") return "planned";
  // If grade is set (A, B, C, etc.) or "completed", course is completed
  if (grade && grade !== "in_progress" && grade !== "planned") return "completed";
  // Default to in_progress for courses without explicit status
  return "in_progress";
};

// Helper to get display grade (not the status)
const getDisplayGrade = (course: any): string | null => {
  const grade = course.grade;
  if (!grade || grade === "in_progress" || grade === "planned" || grade === "completed") {
    return null;
  }
  return grade;
};

export default function LearnPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Initialize tab from URL params (supports navigation from course detail back button)
  const initialTab = searchParams.get("tab") || "active";
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [transcriptSearch, setTranscriptSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [showAllSkills, setShowAllSkills] = useState(false);
  const SKILLS_DISPLAY_LIMIT = 12;

  // Edit dialog state
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
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
  const [deletingCourse, setDeletingCourse] = useState<any | null>(null);

  // Status change dialog state
  const [statusChangeCourse, setStatusChangeCourse] = useState<any | null>(null);

  // Re-analyze state
  const [reanalyzeCourse, setReanalyzeCourse] = useState<any | null>(null);
  const [reanalyzeFile, setReanalyzeFile] = useState<File | null>(null);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Fetch active courses (instructor enrollments)
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useStudentEnrollments();

  // Fetch personal transcript (My Courses)
  const { data: personalCourses = [], isLoading: coursesLoading } = useCourses();
  const deleteCourse = useDeleteCourse();
  const updateCourse = useUpdateCourse();

  // Fetch capabilities for skill counts
  const { data: capabilities = [] } = useCapabilities();

  // Fetch unified skill profile
  const { data: skillProfile = [], isLoading: skillsLoading } = useQuery({
    queryKey: ["skill-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase.rpc("get_user_skill_profile", {
        p_user_id: user.id
      });

      if (error) {
        console.error("Error fetching skill profile:", error);
        // Fallback to capabilities table if function doesn't exist yet
        const { data: caps } = await supabase
          .from("capabilities")
          .select("name, proficiency_level, created_at, courses(title)")
          .order("created_at", { ascending: false });

        return (caps || []).map((c: any) => ({
          skill_name: c.name,
          proficiency_level: c.proficiency_level,
          source_type: "self_reported",
          source_name: c.courses?.title || "Personal Course",
          verified: false,
          acquired_at: c.created_at,
          evidence_url: null
        }));
      }

      return data as SkillProfile[];
    }
  });

  // Calculate stats
  const activeCoursesCount = enrollments.filter((e: any) => !e.completed_at).length;
  const completedCoursesCount = enrollments.filter((e: any) => e.completed_at).length;
  const transcriptCount = personalCourses.length;
  const verifiedSkillsCount = skillProfile.filter(s => s.verified).length;
  const totalSkillsCount = skillProfile.length;

  // Get skill count for a course
  const getCourseSkillCount = (courseId: string) => {
    return capabilities.filter((c: any) => c.course_id === courseId).length;
  };

  // Get course status
  const getCourseStatus = (course: any) => {
    if (course.analysis_status === 'completed') return 'analyzed';
    if (course.analysis_status === 'analyzing') return 'analyzing';
    if (course.analysis_status === 'failed') return 'failed';
    if (course.capability_text) return 'analyzed';
    return 'pending';
  };

  // Filter and sort transcript courses
  const filteredAndSortedCourses = useMemo(() => {
    let result = [...personalCourses];

    // Apply search filter
    if (transcriptSearch.trim()) {
      const query = transcriptSearch.toLowerCase();
      result = result.filter((c: any) =>
        c.title.toLowerCase().includes(query) ||
        (c.code && c.code.toLowerCase().includes(query)) ||
        (c.semester && c.semester.toLowerCase().includes(query))
      );
    }

    // Apply analysis status filter
    if (filterBy !== "all") {
      result = result.filter((c: any) => {
        const status = getCourseStatus(c);
        return status === filterBy;
      });
    }

    // Apply sorting
    result.sort((a: any, b: any) => {
      switch (sortBy) {
        case "newest":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name":
          return a.title.localeCompare(b.title);
        case "skills":
          return getCourseSkillCount(b.id) - getCourseSkillCount(a.id);
        default:
          return 0;
      }
    });

    return result;
  }, [personalCourses, transcriptSearch, filterBy, sortBy, capabilities]);

  // Filter skills by search
  const filteredSkills = skillProfile.filter(skill =>
    skill.skill_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    skill.source_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group skills by category
  const groupedSkills = filteredSkills.reduce((acc, skill) => {
    const category = skill.verified ? "verified" : "self_reported";
    if (!acc[category]) acc[category] = [];
    acc[category].push(skill);
    return acc;
  }, {} as Record<string, SkillProfile[]>);

  // Limit displayed skills
  const displayedVerifiedSkills = showAllSkills
    ? groupedSkills.verified || []
    : (groupedSkills.verified || []).slice(0, SKILLS_DISPLAY_LIMIT);

  const displayedSelfReportedSkills = showAllSkills
    ? groupedSkills.self_reported || []
    : (groupedSkills.self_reported || []).slice(0, SKILLS_DISPLAY_LIMIT);

  const hasMoreSkills =
    (groupedSkills.verified?.length || 0) > SKILLS_DISPLAY_LIMIT ||
    (groupedSkills.self_reported?.length || 0) > SKILLS_DISPLAY_LIMIT;

  const getProficiencyColor = (level: string) => {
    switch (level) {
      case "expert": return "bg-purple-500";
      case "advanced": return "bg-blue-500";
      case "intermediate": return "bg-green-500";
      case "beginner": return "bg-yellow-500";
      default: return "bg-gray-400";
    }
  };

  const getProficiencyWidth = (level: string) => {
    switch (level) {
      case "expert": return 100;
      case "advanced": return 75;
      case "intermediate": return 50;
      case "beginner": return 25;
      default: return 10;
    }
  };

  // Handle delete course
  const handleDeleteCourse = () => {
    if (deletingCourse) {
      deleteCourse.mutate(deletingCourse.id);
      setDeletingCourse(null);
    }
  };

  // Handle edit course
  const handleEditCourse = (course: any) => {
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
      toast({
        title: "Course updated",
        description: "Your changes have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update course.",
        variant: "destructive",
      });
    } finally {
      setIsEditSaving(false);
    }
  };

  // Update course status (completion status) - uses hook for proper cache invalidation
  const handleUpdateCourseStatus = async (course: any, newStatus: CourseStatus, grade?: string) => {
    try {
      let gradeValue: string | null = null;
      if (newStatus === 'completed') {
        gradeValue = grade || 'completed';
      } else {
        gradeValue = newStatus;
      }

      // Use the updateCourse hook for proper cache invalidation and consistency
      await updateCourse.mutateAsync({
        id: course.id,
        updates: { grade: gradeValue }
      });

      setStatusChangeCourse(null);
    } catch (error) {
      // Error toast already handled by the hook
      console.error('Status update error:', error);
    }
  };

  // Quick status change for a course
  const handleQuickStatusChange = async (course: any, newStatus: CourseStatus) => {
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

  // Open the re-analyze dialog
  const handleReanalyzeClick = (course: any) => {
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

      // Convert file to base64
      const arrayBuffer = await reanalyzeFile.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

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

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-display">My Learning</h1>
            <p className="text-muted-foreground">
              Track your courses, transcript, and skill development
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("active")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <PlayCircle className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activeCoursesCount}</p>
                  <p className="text-xs text-muted-foreground">Active Courses</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("active")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{completedCoursesCount}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("transcript")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{transcriptCount}</p>
                  <p className="text-xs text-muted-foreground">Transcript</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("skills")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Award className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalSkillsCount}</p>
                  <p className="text-xs text-muted-foreground">
                    Skills ({verifiedSkillsCount} verified)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="active" className="gap-2">
              <PlayCircle className="h-4 w-4" />
              Active Courses
            </TabsTrigger>
            <TabsTrigger value="transcript" className="gap-2">
              <BookOpen className="h-4 w-4" />
              My Transcript
            </TabsTrigger>
            <TabsTrigger value="skills" className="gap-2">
              <Award className="h-4 w-4" />
              Skill Profile
            </TabsTrigger>
          </TabsList>

          {/* Active Courses Tab */}
          <TabsContent value="active" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Courses you're enrolled in through instructors
              </p>
              <EnrollmentDialog
                trigger={
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Enroll with Code
                  </Button>
                }
              />
            </div>

            {enrollmentsLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2].map(i => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <Skeleton className="h-6 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2 mb-4" />
                      <Skeleton className="h-2 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : enrollments.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <GraduationCap className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold">No active courses</h3>
                    <p className="text-muted-foreground">
                      Enroll in a course using an access code from your instructor
                    </p>
                  </div>
                  <EnrollmentDialog
                    trigger={
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Enroll Now
                      </Button>
                    }
                  />
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {enrollments.map((enrollment: any) => (
                  <Card
                    key={enrollment.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => navigate(`/learn/course/${enrollment.instructor_course_id}`)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">
                            {enrollment.instructor_course?.title || "Untitled Course"}
                          </CardTitle>
                          <CardDescription>
                            {enrollment.instructor_course?.code}
                          </CardDescription>
                        </div>
                        {enrollment.completed_at ? (
                          <Badge className="bg-green-500">Completed</Badge>
                        ) : (
                          <Badge variant="outline">In Progress</Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">
                            {enrollment.overall_progress || 0}%
                          </span>
                        </div>
                        <Progress value={enrollment.overall_progress || 0} className="h-2" />
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Enrolled {new Date(enrollment.enrolled_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* My Transcript Tab */}
          <TabsContent value="transcript" className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                Courses from your university transcript
              </p>
              <Button onClick={() => setShowAddCourse(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Course
              </Button>
            </div>

            {showAddCourse ? (
              <AddCourseForm
                onSubmit={async () => setShowAddCourse(false)}
                onCancel={() => setShowAddCourse(false)}
              />
            ) : coursesLoading ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-5 w-3/4 mb-2" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : personalCourses.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <BookOpen className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold">No courses in transcript</h3>
                    <p className="text-muted-foreground">
                      Add courses from your university to build your skill profile
                    </p>
                  </div>
                  <Button onClick={() => setShowAddCourse(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Course
                  </Button>
                </div>
              </Card>
            ) : (
              <>
                {/* Search and Filter Controls */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search courses by name, code, or semester..."
                      value={transcriptSearch}
                      onChange={(e) => setTranscriptSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterOption)}>
                      <SelectTrigger className="w-[130px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="analyzed">Analyzed</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                      <SelectTrigger className="w-[130px]">
                        <ArrowUpDown className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest</SelectItem>
                        <SelectItem value="oldest">Oldest</SelectItem>
                        <SelectItem value="name">By Name</SelectItem>
                        <SelectItem value="skills">By Skills</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Results count */}
                {(transcriptSearch || filterBy !== "all") && (
                  <p className="text-sm text-muted-foreground">
                    Showing {filteredAndSortedCourses.length} of {personalCourses.length} courses
                  </p>
                )}

                {/* Course Grid */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredAndSortedCourses.map((course: any) => {
                    const status = getCourseStatus(course);
                    const completionStatus = getCourseCompletionStatus(course);
                    const skillCount = getCourseSkillCount(course.id);
                    const displayGrade = getDisplayGrade(course);

                    return (
                      <Card
                        key={course.id}
                        className={`cursor-pointer hover:shadow-md transition-shadow group ${
                          status === "failed" ? "border-destructive/50" : ""
                        }`}
                        onClick={() => navigate(`/courses/${course.id}`)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0 mr-2">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium line-clamp-1">{course.title}</h4>
                                {/* Course completion status badge */}
                                {completionStatus === "completed" && (
                                  <Badge variant="outline" className="text-green-600 border-green-600 text-xs shrink-0">
                                    <GraduationCap className="h-3 w-3 mr-1" />
                                    {displayGrade || "Done"}
                                  </Badge>
                                )}
                                {completionStatus === "in_progress" && (
                                  <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs shrink-0">
                                    <PlayCircle className="h-3 w-3 mr-1" />
                                    Current
                                  </Badge>
                                )}
                                {completionStatus === "planned" && (
                                  <Badge variant="outline" className="text-amber-600 border-amber-600 text-xs shrink-0">
                                    <CalendarClock className="h-3 w-3 mr-1" />
                                    Planned
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">{course.code}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
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
                                  >
                                    <RefreshCw className="h-4 w-4 mr-2" />
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
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {course.semester && <span>{course.semester}</span>}
                            {course.credits && <span>{course.credits} credits</span>}
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <Badge
                              variant={
                                status === "analyzed" ? "default" :
                                status === "failed" ? "destructive" :
                                status === "analyzing" ? "outline" :
                                "secondary"
                              }
                              className="text-[10px]"
                            >
                              {status === "analyzing" && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                              {status === "analyzed" && <Sparkles className="h-3 w-3 mr-1" />}
                              {status}
                            </Badge>
                            {status === "failed" && course.analysis_error ? (
                              <span
                                className="text-xs text-destructive truncate max-w-[100px]"
                                title={course.analysis_error}
                              >
                                {course.analysis_error}
                              </span>
                            ) : skillCount > 0 ? (
                              <span className="text-xs text-accent font-medium">
                                {skillCount} skills
                              </span>
                            ) : null}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {filteredAndSortedCourses.length === 0 && personalCourses.length > 0 && (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">No courses match your filters.</p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => {
                        setTranscriptSearch("");
                        setFilterBy("all");
                      }}
                    >
                      Clear Filters
                    </Button>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Skill Profile Tab */}
          <TabsContent value="skills" className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-green-500" />
                <span>{verifiedSkillsCount} verified</span>
                <span className="mx-2">•</span>
                <FileText className="h-4 w-4 text-amber-500" />
                <span>{totalSkillsCount - verifiedSkillsCount} self-reported</span>
              </div>
            </div>

            {skillsLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredSkills.length === 0 ? (
              <Card className="p-12 text-center">
                <div className="flex flex-col items-center gap-4">
                  <Award className="h-12 w-12 text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold">No skills yet</h3>
                    <p className="text-muted-foreground">
                      Complete courses or add your transcript to build your skill profile
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Verified Skills */}
                {displayedVerifiedSkills.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4 text-green-500" />
                      <h3 className="font-semibold">Verified Skills</h3>
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        {groupedSkills.verified?.length || 0}
                      </Badge>
                    </div>
                    <div className="grid gap-3">
                      {displayedVerifiedSkills.map((skill, i) => (
                        <Card key={`verified-${i}`} className="border-green-200">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-medium">{skill.skill_name}</h4>
                                  <Badge className="bg-green-500 text-[10px]">Verified</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  via {skill.source_name}
                                </p>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {skill.proficiency_level}
                                  </p>
                                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden mt-1">
                                    <div
                                      className={`h-full ${getProficiencyColor(skill.proficiency_level)}`}
                                      style={{ width: `${getProficiencyWidth(skill.proficiency_level)}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Self-Reported Skills */}
                {displayedSelfReportedSkills.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-amber-500" />
                      <h3 className="font-semibold">Self-Reported Skills</h3>
                      <Badge variant="outline" className="text-amber-600 border-amber-200">
                        {groupedSkills.self_reported?.length || 0}
                      </Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {displayedSelfReportedSkills.map((skill, i) => (
                        <Card key={`self-${i}`} className="border-amber-100">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-sm">{skill.skill_name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {skill.source_name}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] text-muted-foreground capitalize">
                                  {skill.proficiency_level}
                                </p>
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                                  <div
                                    className={`h-full ${getProficiencyColor(skill.proficiency_level)}`}
                                    style={{ width: `${getProficiencyWidth(skill.proficiency_level)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Show More/Less Button */}
                {hasMoreSkills && !searchQuery && (
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      onClick={() => setShowAllSkills(!showAllSkills)}
                      className="gap-2"
                    >
                      {showAllSkills ? (
                        <>
                          <ChevronUp className="h-4 w-4" />
                          Show Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Show All Skills ({totalSkillsCount})
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
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
    </AppShell>
  );
}
