import { useState } from 'react';
import { Navigate, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/common/Logo';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character (!@#$%^&*)');

const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Please enter a valid email'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

const studentCopy = {
  headline: "Transform Your Education Into Career Readiness",
  description: "SyllabusStack helps you connect your coursework to your dream job through AI-powered analysis and personalized recommendations.",
  features: [
    "✓ AI-powered syllabus analysis",
    "✓ Personalized skill gap identification",
    "✓ Smart course recommendations",
  ],
};

const instructorCopy = {
  headline: "Turn Your Syllabus Into an Engaging Video Course",
  description: "Upload your syllabus and we'll match each topic with quality video content, complete with built-in comprehension checks.",
  features: [
    "✓ AI-powered content matching",
    "✓ Built-in comprehension checks",
    "✓ Learning outcome analytics",
  ],
};

export default function Auth() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');
  const isInstructor = role === 'instructor';
  const copy = isInstructor ? instructorCopy : studentCopy;
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading, signIn, signUp } = useAuth();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: '', email: '', password: '', confirmPassword: '' },
  });

  if (!authLoading && user) {
    return <Navigate to="/dashboard" replace />;
  }

  const onLogin = async (data: LoginFormValues) => {
    setIsLoading(true);
    const { error } = await signIn(data.email, data.password);
    
    if (error) {
      toast({ title: 'Login Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Welcome back!', description: 'You have successfully logged in.' });
      navigate('/dashboard');
    }
    setIsLoading(false);
  };

  const onSignup = async (data: SignupFormValues) => {
    setIsLoading(true);
    const { error } = await signUp(data.email, data.password, { full_name: data.fullName });
    
    if (error) {
      toast({ title: 'Signup Failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Account Created!', description: "Welcome to SyllabusStack. Let's get you set up." });
      navigate('/onboarding');
    }
    setIsLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary/80 p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-3">
          <Logo size="md" variant="light" />
        </Link>
        
        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-primary-foreground leading-tight">
            {copy.headline}
          </h1>
          <p className="text-xl text-primary-foreground/80">
            {copy.description}
          </p>
        </div>

        <div className="space-y-4 text-primary-foreground/70">
          {copy.features.map((feature) => (
            <p key={feature}>{feature}</p>
          ))}
        </div>
      </div>

      {/* Right Panel - Auth Forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md border-0 shadow-none lg:shadow-lg lg:border">
          <CardHeader className="text-center lg:hidden">
            <Link to="/" className="flex items-center justify-center gap-2 mb-4">
              <Logo size="sm" variant="dark" />
            </Link>
          </CardHeader>
          
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={loginForm.handleSubmit(onLogin)}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="you@university.edu" {...loginForm.register('email')} />
                    {loginForm.formState.errors.email && (
                      <p className="text-sm text-destructive">{loginForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...loginForm.register('password')} />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-destructive">{loginForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <Link to="/forgot-password" className="text-sm text-primary hover:underline">Forgot password?</Link>
                  </div>
                </CardContent>
                
                <CardFooter className="flex-col gap-4">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Log In
                  </Button>
                </CardFooter>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signupForm.handleSubmit(onSignup)}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input id="signup-name" type="text" placeholder="Jane Doe" {...signupForm.register('fullName')} />
                    {signupForm.formState.errors.fullName && (
                      <p className="text-sm text-destructive">{signupForm.formState.errors.fullName.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" type="email" placeholder="you@university.edu" {...signupForm.register('email')} />
                    {signupForm.formState.errors.email && (
                      <p className="text-sm text-destructive">{signupForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input id="signup-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...signupForm.register('password')} />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    {signupForm.formState.errors.password && (
                      <p className="text-sm text-destructive">{signupForm.formState.errors.password.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm">Confirm Password</Label>
                    <Input id="signup-confirm" type={showPassword ? 'text' : 'password'} placeholder="••••••••" {...signupForm.register('confirmPassword')} />
                    {signupForm.formState.errors.confirmPassword && (
                      <p className="text-sm text-destructive">{signupForm.formState.errors.confirmPassword.message}</p>
                    )}
                  </div>
                </CardContent>
                
                <CardFooter className="flex-col gap-4">
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Create Account
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    By signing up, you agree to our Terms of Service and Privacy Policy.
                  </p>
                </CardFooter>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}
