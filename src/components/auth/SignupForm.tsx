import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { Eye, EyeOff, GraduationCap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { getFieldError, FormFieldWrapper } from '@/lib/tanstack-form';

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  university: z.string().optional(),
  studentLevel: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const studentLevels = [
  { value: 'freshman', label: 'Freshman' },
  { value: 'sophomore', label: 'Sophomore' },
  { value: 'junior', label: 'Junior' },
  { value: 'senior', label: 'Senior' },
  { value: 'graduate', label: 'Graduate Student' },
];

export function SignupForm() {
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
      confirmPassword: '',
      university: '',
      studentLevel: '',
    },
    onSubmit: async ({ value }) => {
      const result = signupSchema.safeParse(value);
      if (!result.success) {
        return;
      }
      try {
        console.log('Signup attempt:', value.email);
        toast({
          title: "Account created",
          description: "Authentication will be connected when Lovable Cloud is enabled.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    },
  });

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex flex-1 bg-hero items-center justify-center p-12">
        <div className="max-w-md text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Start Your Career Journey</h2>
          <p className="text-white/80 text-lg mb-8">
            Upload your syllabi, tell us your dream jobs, and get AI-powered gap analysis.
          </p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold mb-1">85%</div>
              <div className="text-white/70">Students improved</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold mb-1">10K+</div>
              <div className="text-white/70">Syllabi analyzed</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-2xl font-bold mb-1">Free</div>
              <div className="text-white/70">For students</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center px-4 sm:px-6 lg:px-20 xl:px-24 py-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold">EduThree</span>
          </Link>

          <h1 className="text-2xl font-bold text-foreground mb-2">Create your account</h1>
          <p className="text-muted-foreground mb-8">Join thousands of students navigating their careers</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-4"
          >
            <form.Field
              name="fullName"
              validators={{
                onBlur: z.string().min(2, 'Name must be at least 2 characters'),
              }}
            >
              {(field) => (
                <FormFieldWrapper
                  label="Full Name"
                  htmlFor="fullName"
                  error={getFieldError(field.state.meta.errors)}
                  touched={field.state.meta.isTouched}
                >
                  <Input
                    id="fullName"
                    placeholder="John Doe"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </FormFieldWrapper>
              )}
            </form.Field>

            <form.Field
              name="email"
              validators={{
                onBlur: z.string().email('Please enter a valid email address'),
              }}
            >
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
                    placeholder="you@university.edu"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </FormFieldWrapper>
              )}
            </form.Field>

            <div className="grid grid-cols-2 gap-4">
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
                      placeholder="Your university"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                  </FormFieldWrapper>
                )}
              </form.Field>

              <form.Field name="studentLevel">
                {(field) => (
                  <FormFieldWrapper
                    label="Level"
                    htmlFor="studentLevel"
                    error={getFieldError(field.state.meta.errors)}
                    touched={field.state.meta.isTouched}
                  >
                    <Select 
                      onValueChange={(value) => field.handleChange(value)} 
                      value={field.state.value}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
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

            <form.Field
              name="password"
              validators={{
                onBlur: z.string().min(8, 'Password must be at least 8 characters'),
              }}
            >
              {(field) => (
                <FormFieldWrapper
                  label="Password"
                  htmlFor="password"
                  error={getFieldError(field.state.meta.errors)}
                  touched={field.state.meta.isTouched}
                >
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </FormFieldWrapper>
              )}
            </form.Field>

            <form.Field
              name="confirmPassword"
              validators={{
                onBlur: z.string().min(1, 'Please confirm your password'),
              }}
            >
              {(field) => (
                <FormFieldWrapper
                  label="Confirm Password"
                  htmlFor="confirmPassword"
                  error={getFieldError(field.state.meta.errors)}
                  touched={field.state.meta.isTouched}
                >
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                  />
                </FormFieldWrapper>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
              {([canSubmit, isSubmitting]) => (
                <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Account
                </Button>
              )}
            </form.Subscribe>
          </form>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/auth" className="text-primary font-medium hover:underline">Sign in</Link>
          </p>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            By creating an account, you agree to our{' '}
            <Link to="/legal#terms" className="underline">Terms</Link> and{' '}
            <Link to="/legal#privacy" className="underline">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
