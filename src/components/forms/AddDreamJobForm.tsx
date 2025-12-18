import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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
  const form = useForm<AddDreamJobFormValues>({
    resolver: zodResolver(addDreamJobSchema),
    defaultValues: {
      jobQuery: '',
      targetCompanyType: '',
      targetLocation: '',
    },
  });

  const handleSubmit = async (data: AddDreamJobFormValues) => {
    if (onSubmit) {
      await onSubmit(data);
    }
    form.reset();
  };

  const selectPopularRole = (role: string) => {
    form.setValue('jobQuery', role);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <Card>
          <CardContent className="p-4 space-y-4">
            {!form.watch('jobQuery') && (
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

            <FormField
              control={form.control}
              name="jobQuery"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What role are you targeting? *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="e.g., Product Manager, Data Analyst, Marketing Manager"
                        className="pl-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Enter any job title - our AI will analyze real requirements
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="targetCompanyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companyTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="targetLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., San Francisco, Remote"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              )}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
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
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
