import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getFieldError, FormFieldWrapper } from '@/lib/tanstack-form';
import { profileSchema, studentLevels, type ProfileFormValues } from '@/lib/form-utils';
import { toast } from '@/hooks/use-toast';

interface ProfileFormProps {
  defaultValues?: Partial<ProfileFormValues>;
  onSubmit?: (data: ProfileFormValues) => Promise<void>;
  isLoading?: boolean;
  autoSave?: boolean;
}

const graduationYears = Array.from({ length: 10 }, (_, i) => 2024 + i);

export function ProfileForm({ 
  defaultValues, 
  onSubmit, 
  isLoading = false,
  autoSave = false 
}: ProfileFormProps) {
  const form = useForm({
    defaultValues: {
      fullName: defaultValues?.fullName ?? '',
      email: defaultValues?.email ?? '',
      university: defaultValues?.university ?? '',
      major: defaultValues?.major ?? '',
      studentLevel: defaultValues?.studentLevel ?? undefined,
      graduationYear: defaultValues?.graduationYear ?? undefined,
    },
    onSubmit: async ({ value }) => {
      const result = profileSchema.safeParse(value);
      if (!result.success) {
        toast({
          title: "Validation Error",
          description: result.error.errors[0]?.message || "Please check your input",
          variant: "destructive",
        });
        return;
      }
      
      if (onSubmit) {
        await onSubmit(result.data);
        toast({
          title: "Profile Updated",
          description: "Your profile has been saved successfully.",
        });
      }
    },
  });

  const handleAutoSave = async () => {
    if (!autoSave) return;
    const values = form.state.values;
    const result = profileSchema.safeParse(values);
    if (result.success && onSubmit) {
      await onSubmit(result.data);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          Tell us about yourself so we can personalize your experience
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
              name="fullName"
              validators={{
                onBlur: z.string().min(1, 'Full name is required').max(100),
              }}
            >
              {(field) => (
                <FormFieldWrapper
                  label="Full Name *"
                  htmlFor="fullName"
                  error={getFieldError(field.state.meta.errors)}
                  touched={field.state.meta.isTouched}
                >
                  <Input
                    id="fullName"
                    placeholder="Your full name"
                    value={field.state.value}
                    onBlur={() => {
                      field.handleBlur();
                      handleAutoSave();
                    }}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
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
                >
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={field.state.value}
                    onBlur={() => {
                      field.handleBlur();
                      handleAutoSave();
                    }}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
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
                  <Input
                    id="university"
                    placeholder="e.g., State University"
                    value={field.state.value}
                    onBlur={() => {
                      field.handleBlur();
                      handleAutoSave();
                    }}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
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
                  <Input
                    id="major"
                    placeholder="e.g., Computer Science"
                    value={field.state.value}
                    onBlur={() => {
                      field.handleBlur();
                      handleAutoSave();
                    }}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </FormFieldWrapper>
              )}
            </form.Field>

            <form.Field name="studentLevel">
              {(field) => (
                <FormFieldWrapper
                  label="Student Level"
                  htmlFor="studentLevel"
                  error={getFieldError(field.state.meta.errors)}
                  touched={field.state.meta.isTouched}
                >
                  <Select 
                    onValueChange={(value) => {
                      field.handleChange(value as ProfileFormValues['studentLevel']);
                      handleAutoSave();
                    }} 
                    value={field.state.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
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

            <form.Field name="graduationYear">
              {(field) => (
                <FormFieldWrapper
                  label="Expected Graduation"
                  htmlFor="graduationYear"
                  error={getFieldError(field.state.meta.errors)}
                  touched={field.state.meta.isTouched}
                >
                  <Select 
                    onValueChange={(value) => {
                      field.handleChange(parseInt(value, 10));
                      handleAutoSave();
                    }} 
                    value={field.state.value?.toString()}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      {graduationYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormFieldWrapper>
              )}
            </form.Field>
          </div>

          {!autoSave && (
            <div className="flex justify-end">
              <form.Subscribe selector={(state: any) => ({ canSubmit: state.canSubmit, isSubmitting: state.isSubmitting })}>
                {({ canSubmit, isSubmitting: formIsSubmitting }: any) => (
                  <Button type="submit" disabled={!canSubmit || isLoading || formIsSubmitting}>
                    {(isLoading || formIsSubmitting) ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Profile
                      </>
                    )}
                  </Button>
                )}
              </form.Subscribe>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
