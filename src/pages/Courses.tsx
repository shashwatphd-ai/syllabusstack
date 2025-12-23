import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout";
import { AddCourseForm, AddCourseFormValues } from "@/components/forms/AddCourseForm";
import { BulkSyllabusUploader } from "@/components/onboarding/BulkSyllabusUploader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  MoreVertical,
  Trash2,
  Eye,
  Plus,
  Upload,
  FileText
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCourses, useCreateCourse, useDeleteCourse } from "@/hooks/useCourses";
import { useCapabilities } from "@/hooks/useCapabilities";
import { useQueryClient } from "@tanstack/react-query";
import { analyzeSyllabus } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

export default function CoursesPage() {
  const [showUploader, setShowUploader] = useState(false);
  const [uploadMode, setUploadMode] = useState<"bulk" | "single">("bulk");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: courses, isLoading: coursesLoading } = useCourses();
  const { data: capabilities } = useCapabilities();
  const createCourse = useCreateCourse();
  const deleteCourse = useDeleteCourse();

  const analyzedCourseIds = new Set(capabilities?.map(c => c.course_id).filter(Boolean) || []);
  const analyzedCount = courses?.filter(c => analyzedCourseIds.has(c.id)).length || 0;
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
      // Create course in database
      const course = await createCourse.mutateAsync({
        title: data.name,
        code: data.code || null,
        semester: data.semester || null,
      });

      // Analyze syllabus with AI
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

  const handleDeleteCourse = (courseId: string) => {
    deleteCourse.mutate(courseId);
  };

  const getCourseStatus = (courseId: string) => {
    return analyzedCourseIds.has(courseId) ? "analyzed" : "pending";
  };

  const getCourseSkillCount = (courseId: string) => {
    return capabilities?.filter(c => c.course_id === courseId).length || 0;
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
                <Calendar className="h-8 w-8 text-primary" />
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
          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => {
              const status = getCourseStatus(course.id);
              const skillCount = getCourseSkillCount(course.id);
              
              return (
                <Card key={course.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{course.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {course.code && `${course.code} • `}{course.semester || 'No semester'}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/courses/${course.id}`)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleDeleteCourse(course.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={status === "analyzed" ? "default" : "secondary"}
                        >
                          {status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {course.credits || 3} credits
                        </span>
                      </div>
                      {skillCount > 0 && (
                        <span className="text-sm text-accent">
                          {skillCount} skills
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Add your first course to start building your capability profile.
              </p>
              <Button onClick={() => setShowUploader(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Course
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
