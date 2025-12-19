import { z } from 'zod';

// Common validation schemas
export const emailSchema = z.string().trim().email('Invalid email address').max(255);
export const nameSchema = z.string().trim().min(1, 'Name is required').max(100);
export const urlSchema = z.string().url('Invalid URL').optional().or(z.literal(''));

// Course validation
export const courseSchema = z.object({
  title: z.string().trim().min(1, 'Course name is required').max(200),
  code: z.string().trim().max(20).optional().or(z.literal('')),
  instructor: z.string().trim().max(100).optional().or(z.literal('')),
  semester: z.string().trim().max(50).optional().or(z.literal('')),
  year: z.coerce.number().min(2000).max(2100).optional(),
  credits: z.coerce.number().min(0).max(12).optional(),
  grade: z.string().trim().max(5).optional().or(z.literal('')),
  syllabusText: z.string().min(50, 'Please provide syllabus content (at least 50 characters)').optional(),
});

export type CourseFormValues = z.infer<typeof courseSchema>;

// Dream Job validation
export const dreamJobSchema = z.object({
  title: z.string().trim().min(3, 'Please enter a job title').max(150),
  companyType: z.string().optional().or(z.literal('')),
  location: z.string().trim().max(100).optional().or(z.literal('')),
  salaryRange: z.string().optional(),
  isPrimary: z.boolean().optional().default(false),
});

export type DreamJobFormValues = z.infer<typeof dreamJobSchema>;

// Profile validation  
export const profileSchema = z.object({
  fullName: z.string().trim().min(1, 'Full name is required').max(100),
  email: emailSchema.optional(),
  university: z.string().trim().max(150).optional().or(z.literal('')),
  major: z.string().trim().max(100).optional().or(z.literal('')),
  studentLevel: z.enum(['freshman', 'sophomore', 'junior', 'senior', 'graduate', 'postgrad']).optional(),
  graduationYear: z.coerce.number().min(2020).max(2035).optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

// Company types for dream job selection
export const companyTypes = [
  { value: 'startup', label: 'Startup' },
  { value: 'tech', label: 'Big Tech (FAANG)' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'finance', label: 'Finance/Banking' },
  { value: 'corporate', label: 'Fortune 500' },
  { value: 'nonprofit', label: 'Non-profit' },
  { value: 'agency', label: 'Agency' },
  { value: 'government', label: 'Government' },
  { value: 'any', label: 'Any Company' },
] as const;

// Popular roles for quick selection
export const popularRoles = [
  'Product Manager',
  'Software Engineer',
  'Data Analyst',
  'Data Scientist',
  'Marketing Manager',
  'Business Analyst',
  'UX Designer',
  'Financial Analyst',
  'Consultant',
  'Project Manager',
] as const;

// Student levels
export const studentLevels = [
  { value: 'freshman', label: 'Freshman' },
  { value: 'sophomore', label: 'Sophomore' },
  { value: 'junior', label: 'Junior' },
  { value: 'senior', label: 'Senior' },
  { value: 'graduate', label: 'Graduate Student' },
  { value: 'postgrad', label: 'Post-Graduate' },
] as const;

// Grade options
export const gradeOptions = [
  { value: 'A+', label: 'A+' },
  { value: 'A', label: 'A' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B', label: 'B' },
  { value: 'B-', label: 'B-' },
  { value: 'C+', label: 'C+' },
  { value: 'C', label: 'C' },
  { value: 'C-', label: 'C-' },
  { value: 'D', label: 'D' },
  { value: 'F', label: 'F' },
  { value: 'P', label: 'Pass' },
  { value: 'IP', label: 'In Progress' },
] as const;

// Semester options
export const semesterOptions = [
  'Spring 2024',
  'Fall 2024',
  'Spring 2025',
  'Fall 2025',
  'Spring 2026',
  'Summer 2024',
  'Summer 2025',
] as const;

// Form state persistence
export function saveFormState<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(`form_${key}`, JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save form state:', e);
  }
}

export function loadFormState<T>(key: string): T | null {
  try {
    const saved = sessionStorage.getItem(`form_${key}`);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error('Failed to load form state:', e);
    return null;
  }
}

export function clearFormState(key: string): void {
  try {
    sessionStorage.removeItem(`form_${key}`);
  } catch (e) {
    console.error('Failed to clear form state:', e);
  }
}
