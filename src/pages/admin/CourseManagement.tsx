import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BookOpen, ArrowLeft, Search, MoreHorizontal, Eye,
  Trash2, Users, Calendar, BarChart3
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSubscription } from '@/hooks/useSubscription';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface OrgCourse {
  id: string;
  title: string;
  code: string | null;
  created_at: string;
  creator_name: string | null;
  enrollments_count: number;
  modules_count: number;
}

export default function CourseManagement() {
  const { tier } = useSubscription();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  if (tier !== 'university') {
    navigate('/dashboard');
    return null;
  }

  const { data: courses, isLoading } = useQuery({
    queryKey: ['admin', 'courses'],
    queryFn: async (): Promise<OrgCourse[]> => {
      const { data, error } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          code,
          created_at,
          profiles!courses_created_by_fkey(full_name),
          enrollments(id),
          modules(id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []).map((c: any) => ({
        id: c.id,
        title: c.title,
        code: c.code,
        created_at: c.created_at,
        creator_name: c.profiles?.full_name,
        enrollments_count: c.enrollments?.length || 0,
        modules_count: c.modules?.length || 0,
      }));
    },
  });

  const filteredCourses = courses?.filter(course =>
    course.title.toLowerCase().includes(search.toLowerCase()) ||
    course.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/admin">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Course Management
          </h1>
          <p className="text-muted-foreground">
            View and manage all courses across your organization
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <BookOpen className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{courses?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total Courses</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <Users className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">
                {courses?.reduce((sum, c) => sum + c.enrollments_count, 0) || 0}
              </p>
              <p className="text-sm text-muted-foreground">Total Enrollments</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <BarChart3 className="h-8 w-8 text-success" />
            <div>
              <p className="text-2xl font-bold">
                {courses?.reduce((sum, c) => sum + c.modules_count, 0) || 0}
              </p>
              <p className="text-sm text-muted-foreground">Total Modules</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by course title or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Courses Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !filteredCourses?.length ? (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No courses found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-center">Modules</TableHead>
                  <TableHead className="text-center">Enrollments</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCourses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{course.title}</p>
                        {course.code && (
                          <p className="text-sm text-muted-foreground">{course.code}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {course.creator_name || <span className="text-muted-foreground">Unknown</span>}
                    </TableCell>
                    <TableCell>
                      {format(new Date(course.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{course.modules_count}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{course.enrollments_count}</Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/instructor/course/${course.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
