import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { toast } from '@/hooks/use-toast';
import type { AddCourseFormValues } from '@/components/forms/AddCourseForm';

// Types
export interface Course {
  id: string;
  user_id: string;
  name: string;
  code?: string;
  university?: string;
  semester?: string;
  syllabus_text?: string;
  syllabus_file_url?: string;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  created_at: string;
  updated_at: string;
}

export interface CourseCapability {
  id: string;
  course_id: string;
  capability_name: string;
  proficiency_level: number;
  evidence: string;
  category: string;
}

// Mock data
const mockCourses: Course[] = [
  {
    id: '1',
    user_id: 'mock-user',
    name: 'Business Analytics',
    code: 'BUS 301',
    university: 'State University',
    semester: 'Fall 2024',
    status: 'complete',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    user_id: 'mock-user',
    name: 'Marketing Fundamentals',
    code: 'MKT 201',
    university: 'State University',
    semester: 'Spring 2024',
    status: 'complete',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// API functions (will be replaced with Supabase calls)
const fetchCourses = async (): Promise<Course[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));
  return mockCourses;
};

const fetchCourseById = async (id: string): Promise<Course | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  return mockCourses.find(c => c.id === id) || null;
};

const createCourse = async (data: AddCourseFormValues): Promise<Course> => {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const newCourse: Course = {
    id: Date.now().toString(),
    user_id: 'mock-user',
    name: data.name,
    code: data.code,
    university: data.university,
    semester: data.semester,
    syllabus_text: data.syllabusText,
    status: 'complete',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockCourses.push(newCourse);
  return newCourse;
};

const deleteCourse = async (id: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 500));
  const index = mockCourses.findIndex(c => c.id === id);
  if (index > -1) {
    mockCourses.splice(index, 1);
  }
};

// Hooks
export function useCourses() {
  return useQuery({
    queryKey: queryKeys.coursesList(),
    queryFn: fetchCourses,
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: queryKeys.courseDetail(id),
    queryFn: () => fetchCourseById(id),
    enabled: !!id,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coursesList() });
      toast({
        title: 'Course added',
        description: 'Your course has been added successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to add course.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.coursesList() });
      toast({
        title: 'Course deleted',
        description: 'Your course has been removed.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete course.',
        variant: 'destructive',
      });
    },
  });
}
