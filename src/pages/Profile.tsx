import { useEffect } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { User, Mail, GraduationCap, Calendar, Building2, Loader2, Check } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProfile, useUpdateProfile } from '@/hooks/useProfile';
import { getFieldError, FormFieldWrapper } from '@/lib/tanstack-form';
import { ExportButtons } from '@/components/common/ExportButtons';

const profileSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  university: z.string().optional(),
  graduation_year: z.number().optional().nullable(),
  major: z.string().optional(),
  student_level: z.string().optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

const studentLevels = [
  { value: 'freshman', label: 'Freshman' },
  { value: 'sophomore', label: 'Sophomore' },
  { value: 'junior', label: 'Junior' },
  { value: 'senior', label: 'Senior' },
  { value: 'graduate', label: 'Graduate Student' },
];

export default function ProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();

  // Calculate profile completion percentage
  const completionPercentage = profile ? (() => {
    const fields = [
      profile.full_name,
      profile.email,
      profile.university,
      profile.graduation_year,
      profile.major,
      profile.student_level,
    ];
    const filledFields = fields.filter((field) => field !== null && field !== undefined && field !== '').length;
    return Math.round((filledFields / fields.length) * 100);
  })() : 0;

  const form = useForm({
    defaultValues: {
      full_name: profile?.full_name || '',
      email: profile?.email || '',
      university: profile?.university || '',
      graduation_year: profile?.graduation_year ?? null,
      major: profile?.major || '',
      student_level: profile?.student_level ?? null,
    },
    onSubmit: async ({ value }) => {
      const result = profileSchema.safeParse(value);
      if (!result.success) {
        return;
      }
      await updateProfile.mutateAsync({
        full_name: value.full_name,
        university: value.university || null,
        graduation_year: value.graduation_year,
        major: value.major || null,
        student_level: value.student_level,
      });
    },
  });

  // Update form when profile data loads
  useEffect(() => {
    if (profile) {
      form.setFieldValue('full_name', profile.full_name || '');
      form.setFieldValue('email', profile.email || '');
      form.setFieldValue('university', profile.university || '');
      form.setFieldValue('graduation_year', profile.graduation_year ?? null);
      form.setFieldValue('major', profile.major || '');
      form.setFieldValue('student_level', profile.student_level ?? null);
    }
  }, [profile]);

  if (isLoading) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </div>
          <Card>
            <CardContent className="p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </CardContent>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <p className="text-muted-foreground">
            Manage your account information and preferences
          </p>
          <ExportButtons />
        </div>

        {/* Profile Completion */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Profile Completion</span>
              <span className="text-sm text-muted-foreground">{completionPercentage}%</span>
            </div>
            <Progress value={completionPercentage} className="h-2" />
            {completionPercentage < 100 && (
              <p className="text-xs text-muted-foreground mt-2">
                Complete your profile to get more accurate recommendations.
              </p>
            )}
            {completionPercentage === 100 && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Profile complete!
              </p>
            )}
          </CardContent>
        </Card>

        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>
              Update your personal details and academic information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <form.Field
                  name="full_name"
                  validators={{
                    onBlur: z.string().min(2, 'Name must be at least 2 characters').max(100),
                  }}
                >
                  {(field) => (
                    <FormFieldWrapper
                      label="Full Name"
                      htmlFor="full_name"
                      error={getFieldError(field.state.meta.errors)}
                      touched={field.state.meta.isTouched}
                    >
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="full_name"
                          placeholder="Your name"
                          className="pl-10"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      </div>
                    </FormFieldWrapper>
                  )}
                </form.Field>

                <form.Field name="email">
                  {(field) => (
                    <FormFieldWrapper
                      label="Email"
                      htmlFor="email"
                      error={getFieldError(field.state.meta.errors)}
                      touched={field.state.meta.isTouched}
                      description="Email cannot be changed"
                    >
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="email"
                          placeholder="your@email.com"
                          className="pl-10"
                          value={field.state.value}
                          disabled
                        />
                      </div>
                    </FormFieldWrapper>
                  )}
                </form.Field>

                <form.Field name="university">
                  {(field) => (
                    <FormFieldWrapper
                      label="University"
                      htmlFor="university"
                      error={getFieldError(field.state.meta.errors)}
                      touched={field.state.meta.isTouched}
                    >
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="university"
                          placeholder="Your university"
                          className="pl-10"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      </div>
                    </FormFieldWrapper>
                  )}
                </form.Field>

                <form.Field name="graduation_year">
                  {(field) => (
                    <FormFieldWrapper
                      label="Graduation Year"
                      htmlFor="graduation_year"
                      error={getFieldError(field.state.meta.errors)}
                      touched={field.state.meta.isTouched}
                    >
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="graduation_year"
                          type="number"
                          placeholder="e.g., 2025"
                          className="pl-10"
                          value={field.state.value ?? ''}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </div>
                    </FormFieldWrapper>
                  )}
                </form.Field>

                <form.Field name="major">
                  {(field) => (
                    <FormFieldWrapper
                      label="Major"
                      htmlFor="major"
                      error={getFieldError(field.state.meta.errors)}
                      touched={field.state.meta.isTouched}
                    >
                      <div className="relative">
                        <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="major"
                          placeholder="Your major"
                          className="pl-10"
                          value={field.state.value}
                          onBlur={field.handleBlur}
                          onChange={(e) => field.handleChange(e.target.value)}
                        />
                      </div>
                    </FormFieldWrapper>
                  )}
                </form.Field>

                <form.Field name="student_level">
                  {(field) => (
                    <FormFieldWrapper
                      label="Student Level"
                      htmlFor="student_level"
                      error={getFieldError(field.state.meta.errors)}
                      touched={field.state.meta.isTouched}
                    >
                      <Select 
                        onValueChange={(value) => field.handleChange(value)} 
                        value={field.state.value || ''}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select your level" />
                        </SelectTrigger>
                        <SelectContent>
                          {studentLevels.map((level) => (
                            <SelectItem key={level.value} value={level.value}>
                              {level.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormFieldWrapper>
                  )}
                </form.Field>
              </div>

              <div className="flex justify-end">
                <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                  {([canSubmit, isSubmitting]) => (
                    <Button type="submit" disabled={!canSubmit || isSubmitting || updateProfile.isPending}>
                      {(isSubmitting || updateProfile.isPending) ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  )}
                </form.Subscribe>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
