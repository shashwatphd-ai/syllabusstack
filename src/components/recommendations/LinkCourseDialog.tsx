import { useState } from "react";
import { Link2, GraduationCap, Loader2, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useStudentEnrollments, type StudentEnrollment } from "@/hooks/useStudentCourses";

interface LinkCourseDialogProps {
  open: boolean;
  onClose: () => void;
  recommendationId: string;
  recommendationTitle: string;
}

export function LinkCourseDialog({
  open,
  onClose,
  recommendationId,
  recommendationTitle,
}: LinkCourseDialogProps) {
  const queryClient = useQueryClient();
  const { data: enrollments = [], isLoading } = useStudentEnrollments();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const linkMutation = useMutation({
    mutationFn: async (courseId: string) => {
      const { error } = await supabase
        .from("recommendation_course_links")
        .upsert({
          recommendation_id: recommendationId,
          instructor_course_id: courseId,
          link_type: "enrolled",
          link_status: "active",
        }, {
          onConflict: "recommendation_id,instructor_course_id",
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      toast({
        title: "Course linked",
        description: "Your enrolled course has been linked to this recommendation.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Failed to link course",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      });
    },
  });

  const handleLink = () => {
    if (selectedCourseId) {
      linkMutation.mutate(selectedCourseId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Link to Enrolled Course
          </DialogTitle>
          <DialogDescription>
            Select an enrolled course that covers "{recommendationTitle}"
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : enrollments.length === 0 ? (
          <div className="text-center py-8">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              You're not enrolled in any courses yet.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Enroll in an instructor course to link it here.
            </p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[300px] pr-4">
              <div className="space-y-2">
                {enrollments.map((enrollment) => (
                  <EnrollmentOption
                    key={enrollment.id}
                    enrollment={enrollment}
                    isSelected={selectedCourseId === enrollment.instructor_course_id}
                    onSelect={() => setSelectedCourseId(enrollment.instructor_course_id)}
                  />
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleLink}
                disabled={!selectedCourseId || linkMutation.isPending}
              >
                {linkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Link Course
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EnrollmentOption({
  enrollment,
  isSelected,
  onSelect,
}: {
  enrollment: StudentEnrollment;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const course = enrollment.instructor_course;
  const progress = enrollment.overall_progress || 0;
  const isCompleted = enrollment.completed_at !== null;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate">
              {course.title}
            </span>
            {isCompleted && (
              <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                <Check className="h-3 w-3 mr-0.5" />
                Done
              </Badge>
            )}
          </div>
          {course.code && (
            <span className="text-xs text-muted-foreground">{course.code}</span>
          )}
        </div>
        <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          isSelected ? "border-primary bg-primary" : "border-muted-foreground"
        }`}>
          {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
        </div>
      </div>
      
      {!isCompleted && (
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}
    </button>
  );
}
