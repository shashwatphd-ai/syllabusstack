import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from '@/components/common/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCourseStudents } from '@/hooks/useInstructorCourses';
import { useAssignStudent } from '@/hooks/useCapstoneProjects';

interface AssignStudentDialogProps {
  projectId: string;
  courseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AssignStudentDialog({ projectId, courseId, open, onOpenChange }: AssignStudentDialogProps) {
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const { data: studentData } = useCourseStudents(courseId);
  const assignStudent = useAssignStudent();

  const students = studentData?.enrollments || [];

  const handleAssign = () => {
    if (!selectedStudentId) return;
    assignStudent.mutate(
      { projectId, studentId: selectedStudentId, courseId },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Assign Student</ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Select an enrolled student to assign to this capstone project.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="py-4">
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a student..." />
            </SelectTrigger>
            <SelectContent>
              {students.map(s => (
                <SelectItem key={s.student_id} value={s.student_id}>
                  {s.profile?.full_name || s.profile?.email || s.student_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {students.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">No students enrolled in this course yet.</p>
          )}
        </div>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedStudentId || assignStudent.isPending}
            className="gap-2"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {assignStudent.isPending ? 'Assigning...' : 'Assign'}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
