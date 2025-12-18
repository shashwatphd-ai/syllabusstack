import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { Search, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getFieldError, FormFieldWrapper } from '@/lib/tanstack-form';

export const addDreamJobSchema = z.object({
  jobQuery: z.string().min(3, 'Please enter a job title or role'),
  targetCompanyType: z.string().optional(),
  targetLocation: z.string().optional(),
});

export type AddDreamJobFormValues = z.infer<typeof addDreamJobSchema>;

interface AddDreamJobFormProps {
  onSubmit?: (data: AddDreamJobFormValues) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

const companyTypes = [
  { value: 'startup', label: 'Startup' },
  { value: 'tech', label: 'Big Tech (FAANG)' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'finance', label: 'Finance/Banking' },
  { value: 'corporate', label: 'Fortune 500' },
  { value: 'nonprofit', label: 'Non-profit' },
  { value: 'agency', label: 'Agency' },
  { value: 'any', label: 'Any Company' },
];

const popularRoles = [
  'Product Manager',
  'Software Engineer',
  'Data Analyst',
  'Marketing Manager',
  'Business Analyst',
  'UX Designer',
  'Financial Analyst',
  'Consultant',
];

export function AddDreamJobForm({ onSubmit, onCancel, isSubmitting = false }: AddDreamJobFormProps) {
  const form = useForm({
    defaultValues: {
      jobQuery: '',
      targetCompanyType: '',
      targetLocation: '',
    },
    onSubmit: async ({ value }) => {
      const result = addDreamJobSchema.safeParse(value);
      if (!result.success) {
        return;
      }
      if (onSubmit) {
        await onSubmit(value);
      }
      form.reset();
    },
  });

  const selectPopularRole = (role: string) => {
    form.setFieldValue('jobQuery', role);
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="space-y-4"
    >
      <Card>
        <CardContent className="p-4 space-y-4">
          <form.Subscribe selector={(state) => state.values.jobQuery}>
            {(jobQuery) => !jobQuery && (
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Popular roles
                </label>
                <div className="flex flex-wrap gap-2">
                  {popularRoles.map((role) => (
                    <Badge
                      key={role}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 hover:border-primary"
                      onClick={() => selectPopularRole(role)}
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </form.Subscribe>

          <form.Field
            name="jobQuery"
            validators={{
              onBlur: z.string().min(3, 'Please enter a job title or role'),
            }}
          >
            {(field) => (
              <FormFieldWrapper
                label="What role are you targeting? *"
                htmlFor="jobQuery"
                error={getFieldError(field.state.meta.errors)}
                touched={field.state.meta.isTouched}
                description="Enter any job title - our AI will analyze real requirements"
              >
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="jobQuery"
                    placeholder="e.g., Product Manager, Data Analyst, Marketing Manager"
                    className="pl-10"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </div>
              </FormFieldWrapper>
            )}
          </form.Field>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <form.Field name="targetCompanyType">
              {(field) => (
                <FormFieldWrapper
                  label="Company Type"
                  htmlFor="targetCompanyType"
                  error={getFieldError(field.state.meta.errors)}
                  touched={field.state.meta.isTouched}
                >
                  <Select 
                    onValueChange={(value) => field.handleChange(value)} 
                    value={field.state.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {companyTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormFieldWrapper>
              )}
            </form.Field>

            <form.Field name="targetLocation">
              {(field) => (
                <FormFieldWrapper
                  label="Location"
                  htmlFor="targetLocation"
                  error={getFieldError(field.state.meta.errors)}
                  touched={field.state.meta.isTouched}
                >
                  <Input
                    id="targetLocation"
                    placeholder="e.g., San Francisco, Remote"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </FormFieldWrapper>
              )}
            </form.Field>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, formIsSubmitting]) => (
                <Button type="submit" disabled={!canSubmit || isSubmitting || formIsSubmitting}>
                  {(isSubmitting || formIsSubmitting) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Analyzing requirements...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Dream Job
                    </>
                  )}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
