import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ArrowLeft, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';

export default function ReviewSyllabus() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();

  const { data: course, isLoading } = useQuery({
    queryKey: ['course-review', courseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!courseId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 max-w-2xl space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="container mx-auto p-6 max-w-2xl text-center space-y-4">
        <p className="text-muted-foreground">Course not found.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  // key_capabilities is JSON (array or object), evidence_types is JSON
  const capabilities: string[] = Array.isArray(course.key_capabilities)
    ? course.key_capabilities.map((c: any) => typeof c === 'string' ? c : c?.name || String(c))
    : [];
  const evidenceTypes: string[] = Array.isArray(course.evidence_types)
    ? course.evidence_types.map((e: any) => typeof e === 'string' ? e : e?.name || String(e))
    : [];

  return (
    <div className="container mx-auto p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Review Course Data
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Verify the information extracted from your syllabus.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{course.title || 'Untitled Course'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {course.grade && (
            <div>
              <span className="text-sm font-medium text-muted-foreground">Grade/Level</span>
              <p className="text-sm">{course.grade}</p>
            </div>
          )}
          {course.credits != null && (
            <div>
              <span className="text-sm font-medium text-muted-foreground">Credits</span>
              <p className="text-sm">{course.credits}</p>
            </div>
          )}
          {course.capability_text && (
            <div>
              <span className="text-sm font-medium text-muted-foreground">Description</span>
              <p className="text-sm">{course.capability_text}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {capabilities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key Capabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {capabilities.map((cap, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-primary font-medium shrink-0">{i + 1}.</span>
                  <span>{cap}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {evidenceTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evidence Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {evidenceTypes.map((ev, i) => (
                <Badge key={i} variant="secondary">{ev}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => navigate(-1)} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          onClick={() => navigate(`/student/configure/${courseId}`)}
          className="flex-1 gap-1.5"
        >
          Configure & Generate Projects
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
