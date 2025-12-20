import { useParams, useNavigate } from "react-router-dom";
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
  Sparkles
} from "lucide-react";
import { useCourse } from "@/hooks/useCourses";
import { useCapabilities } from "@/hooks/useCapabilities";

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: course, isLoading: courseLoading, error: courseError } = useCourse(id || "");
  const { data: allCapabilities, isLoading: capabilitiesLoading } = useCapabilities();

  const courseCapabilities = allCapabilities?.filter(c => c.course_id === id) || [];
  const isLoading = courseLoading || capabilitiesLoading;

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
          <Button onClick={() => navigate("/courses")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Courses
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

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/courses")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold font-display">{course.title}</h1>
              {course.ai_model_used && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI Analyzed
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
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Capability Summary */}
          {course.capability_text && (
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
                  {course.capability_text.split(';').map((capability, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <span className="text-accent mt-1">•</span>
                      <span>{capability.trim()}</span>
                    </li>
                  ))}
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

          {/* AI Analysis Info */}
          {course.ai_model_used && (
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
        </div>
      </div>
    </AppShell>
  );
}
