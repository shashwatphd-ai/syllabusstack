import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { AddCourseForm, AddCourseFormValues } from "@/components/forms/AddCourseForm";
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
  Sparkles
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCourses, useCreateCourse, useDeleteCourse, useUpdateCourse, Course } from "@/hooks/useCourses";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useQueryClient } from "@tanstack/react-query";
import { analyzeSyllabus } from "@/services";
import { toast } from "@/hooks/use-toast";

type SortOption = "newest" | "oldest" | "name" | "skills" | "status";
type FilterOption = "all" | "analyzed" | "pending" | "failed";

export default function CoursesPage() {
  const [showUploader, setShowUploader] = useState(false);
  const [uploadMode, setUploadMode] = useState<"bulk" | "single">("bulk");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");

  // Edit dialog state
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState({ title: "", code: "", semester: "", credits: 3 });
  const [isEditSaving, setIsEditSaving] = useState(false);

  // Delete confirmation state
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null);

  // Re-analyze state
  const [reanalyzingCourseId, setReanalyzingCourseId] = useState<string | null>(null);

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

  // Get skill count for a course
  const getCourseSkillCount = (courseId: string) => {
    return capabilities?.filter(c => c.course_id === courseId).length || 0;
  };

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

    // Apply status filter
    if (filterBy !== "all") {
      result = result.filter(c => {
        const status = getCourseStatus(c);
        return status === filterBy;
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
        default:
          return 0;
      }
    });

    return result;
  }, [courses, searchQuery, filterBy, sortBy, capabilities]);

  // Stats
  const analyzedCount = courses?.filter(c =>
    c.analysis_status === 'completed' ||
    (c.analysis_status === null && c.capability_text)
  ).length || 0;
  const failedCount = courses?.filter(c => c.analysis_status === 'failed').length || 0;
  const totalSkills = capabilities?.length || 0;

  const handleBulkUploadSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["courses"] });
    queryClient.invalidateQueries({ queryKey: ["capabilities"] });
    setShowUploader(false);
    toast({
      title: "Courses added!",
      description: "Your capability profile has been updated.",
    });
  };

  const handleAddCourse = async (data: AddCourseFormValues) => {
    setIsAnalyzing(true);
    try {
      const course = await createCourse.mutateAsync({
        title: data.name,
        code: data.code || null,
        semester: data.semester || null,
      });

      if (data.syllabusText) {
        await analyzeSyllabus(data.syllabusText, course.id);
        toast({
          title: "Course analyzed!",
          description: "Skills have been extracted from your syllabus.",
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
    setEditForm({
      title: course.title,
      code: course.code || "",
      semester: course.semester || "",
      credits: course.credits || 3,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCourse) return;

    setIsEditSaving(true);
    try {
      await updateCourse.mutateAsync({
        id: editingCourse.id,
        updates: {
          title: editForm.title,
          code: editForm.code || null,
          semester: editForm.semester || null,
          credits: editForm.credits,
        },
      });
      setEditingCourse(null);
    } catch (error) {
      // Error toast is handled by the mutation
    } finally {
      setIsEditSaving(false);
    }
  };

  const handleReanalyze = async (course: Course) => {
    setReanalyzingCourseId(course.id);

    try {
      // Reset the course status
      await updateCourse.mutateAsync({
        id: course.id,
        updates: {
          analysis_status: "pending",
          analysis_error: null,
        },
      });

      toast({
        title: "Re-analysis started",
        description: "Upload a new syllabus or contact support if the original syllabus needs re-processing.",
      });

      // Navigate to the course detail page where they can see more options
      navigate(`/courses/${course.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset course for re-analysis",
        variant: "destructive",
      });
    } finally {
      setReanalyzingCourseId(null);
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
          <div>
            <h1 className="text-3xl font-bold font-display">My Courses</h1>
            <p className="text-muted-foreground">
              Manage your courses and syllabi
            </p>
          </div>
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
                <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterOption)}>
                  <SelectTrigger className="w-[140px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Courses</SelectItem>
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
                    <SelectItem value="status">By Status</SelectItem>
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
                  const skillCount = getCourseSkillCount(course.id);
                  const isReanalyzing = reanalyzingCourseId === course.id;

                  return (
                    <Card
                      key={course.id}
                      className={`cursor-pointer hover:shadow-md transition-shadow ${
                        status === "failed" ? "border-destructive/50" : ""
                      }`}
                      onClick={() => navigate(`/courses/${course.id}`)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-base truncate">{course.title}</CardTitle>
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
                              {(status === "failed" || status === "pending") && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReanalyze(course);
                                  }}
                                  disabled={isReanalyzing}
                                >
                                  {isReanalyzing ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                  )}
                                  {status === "failed" ? "Retry Analysis" : "Analyze Now"}
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Course</DialogTitle>
            <DialogDescription>
              Update the course details below.
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
            <div className="grid gap-2">
              <Label htmlFor="edit-semester">Semester</Label>
              <Input
                id="edit-semester"
                value={editForm.semester}
                onChange={(e) => setEditForm(prev => ({ ...prev, semester: e.target.value }))}
                placeholder="Fall 2024"
              />
            </div>
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
    </AppShell>
  );
}
