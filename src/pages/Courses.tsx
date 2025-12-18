import { useState } from "react";
import { AppShell } from "@/components/layout";
import { CourseUploader } from "@/components/onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  MoreVertical,
  Trash2,
  Eye
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Course {
  id: string;
  name: string;
  code: string;
  semester: string;
  credits: number;
  status: "analyzed" | "pending" | "error";
  skillsExtracted: number;
}

const mockCourses: Course[] = [
  {
    id: "1",
    name: "Introduction to Machine Learning",
    code: "CS 229",
    semester: "Fall 2023",
    credits: 4,
    status: "analyzed",
    skillsExtracted: 12,
  },
  {
    id: "2",
    name: "Data Structures and Algorithms",
    code: "CS 161",
    semester: "Spring 2023",
    credits: 4,
    status: "analyzed",
    skillsExtracted: 8,
  },
  {
    id: "3",
    name: "Database Systems",
    code: "CS 145",
    semester: "Fall 2023",
    credits: 3,
    status: "analyzed",
    skillsExtracted: 6,
  },
  {
    id: "4",
    name: "Statistical Methods",
    code: "STATS 101",
    semester: "Spring 2024",
    credits: 3,
    status: "pending",
    skillsExtracted: 0,
  },
];

export default function CoursesPage() {
  const [courses, setCourses] = useState(mockCourses);
  const [showUploader, setShowUploader] = useState(false);

  const analyzedCount = courses.filter((c) => c.status === "analyzed").length;
  const totalSkills = courses.reduce((acc, c) => acc + c.skillsExtracted, 0);

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
            {showUploader ? "View Courses" : "Upload Syllabus"}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <BookOpen className="h-8 w-8 text-accent" />
                <div>
                  <p className="text-2xl font-bold">{courses.length}</p>
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
          <CourseUploader />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <Card key={course.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{course.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {course.code} • {course.semester}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">
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
                        variant={course.status === "analyzed" ? "default" : "secondary"}
                      >
                        {course.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {course.credits} credits
                      </span>
                    </div>
                    {course.skillsExtracted > 0 && (
                      <span className="text-sm text-accent">
                        {course.skillsExtracted} skills
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
