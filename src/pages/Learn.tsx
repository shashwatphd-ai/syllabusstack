import { useState } from "react";
import { AppShell } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  PlayCircle,
  BookOpen,
  Award,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  TrendingUp,
  GraduationCap,
  FileText,
  Shield
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStudentEnrollments } from "@/hooks/useStudentCourses";
import { useCourses } from "@/hooks/useCourses";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EnrollmentDialog } from "@/components/student/EnrollmentDialog";
import { AddCourseForm } from "@/components/forms";

interface SkillProfile {
  skill_name: string;
  proficiency_level: string;
  source_type: string;
  source_name: string;
  verified: boolean;
  acquired_at: string;
  evidence_url: string | null;
}

export default function LearnPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("active");
  const [showEnrollDialog, setShowEnrollDialog] = useState(false);
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch active courses (instructor enrollments)
  const { data: enrollments = [], isLoading: enrollmentsLoading } = useStudentEnrollments();

  // Fetch personal transcript (My Courses)
  const { data: personalCourses = [], isLoading: coursesLoading } = useCourses();

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
        const { data: capabilities } = await supabase
          .from("capabilities")
          .select("name, proficiency_level, created_at, courses(title)")
          .order("created_at", { ascending: false });

        return (capabilities || []).map((c: any) => ({
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
              <Button onClick={() => setShowEnrollDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Enroll with Code
              </Button>
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
                  <Button onClick={() => setShowEnrollDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Enroll Now
                  </Button>
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
                            {enrollment.instructor_courses?.title || "Untitled Course"}
                          </CardTitle>
                          <CardDescription>
                            {enrollment.instructor_courses?.code}
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
                onSuccess={() => setShowAddCourse(false)}
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {personalCourses.map((course: any) => (
                  <Card key={course.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-medium line-clamp-1">{course.title}</h4>
                          <p className="text-sm text-muted-foreground">{course.code}</p>
                        </div>
                        {course.grade && (
                          <Badge variant="outline">{course.grade}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {course.semester && <span>{course.semester}</span>}
                        {course.credits && <span>{course.credits} credits</span>}
                      </div>
                      {course.analysis_status === "completed" && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle2 className="h-3 w-3" />
                          Skills extracted
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Skill Profile Tab */}
          <TabsContent value="skills" className="space-y-4">
            <div className="flex items-center gap-4">
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
                {groupedSkills.verified && groupedSkills.verified.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Shield className="h-4 w-4 text-green-500" />
                      <h3 className="font-semibold">Verified Skills</h3>
                      <Badge variant="outline" className="text-green-600 border-green-200">
                        {groupedSkills.verified.length}
                      </Badge>
                    </div>
                    <div className="grid gap-3">
                      {groupedSkills.verified.map((skill, i) => (
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
                {groupedSkills.self_reported && groupedSkills.self_reported.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="h-4 w-4 text-amber-500" />
                      <h3 className="font-semibold">Self-Reported Skills</h3>
                      <Badge variant="outline" className="text-amber-600 border-amber-200">
                        {groupedSkills.self_reported.length}
                      </Badge>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {groupedSkills.self_reported.map((skill, i) => (
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
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Enrollment Dialog */}
      <EnrollmentDialog
        open={showEnrollDialog}
        onOpenChange={setShowEnrollDialog}
      />
    </AppShell>
  );
}
